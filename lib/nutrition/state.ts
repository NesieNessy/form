import { tr } from '../i18n/tr';
import { newUuid } from '../id';
import { mark, type WorkoutData } from '../workout/state';
import { nutrientsFor, snapshotOf, validateFood, validateQuantity, validateQuickAdd, type Issue } from './engine';
import type { EntryMethod, Food, FoodLogEntry, FoodSnapshot, MealType, Nutrients, Quantity, SavedMeal } from './model';

/**
 * State transitions for the nutrition log, on the same local store and sync
 * bookkeeping as workouts. Every write is validated here, so whatever the
 * screen (or a future AI draft) sends, nothing implausible is stored.
 */

const localDateOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Result<T> = { ok: true; data: WorkoutData } & T | { ok: false; issues: Issue[] };

const errorsOnly = (issues: Issue[]) => issues.filter((i) => i.severity === 'error');

// ------------------------------------------------------------------ foods

export type FoodInput = Pick<Food, 'name' | 'brand' | 'basis' | 'nutrients' | 'servings' | 'densityGPerMl' | 'isFluid' | 'sourceNote'>;

export function addFood(data: WorkoutData, input: FoodInput, nowMs: number): Result<{ foodId: string }> {
  const errors = errorsOnly(validateFood(input));
  if (errors.length) return { ok: false, issues: errors };
  const foodId = newUuid();
  const food: Food = { ...input, name: input.name.trim(), brand: input.brand?.trim() || undefined, id: foodId, source: 'user', createdAt: nowMs, updatedAt: nowMs };
  return { ok: true, foodId, data: { ...data, foods: { ...data.foods, [foodId]: food }, dirty: mark(data.dirty, { foods: [foodId] }) } };
}

export function removeFood(data: WorkoutData, foodId: string, nowMs: number): WorkoutData {
  const food = data.foods[foodId];
  if (!food) return data;
  return { ...data, foods: { ...data.foods, [foodId]: { ...food, deletedAt: nowMs, updatedAt: nowMs } }, dirty: mark(data.dirty, { foods: [foodId] }) };
}

// -------------------------------------------------------------- the log

export type LogContext = {
  mealType: MealType;
  consumedAt: number;
  sessionId?: string;
  estimated?: boolean;
  note?: string;
  entryMethod?: EntryMethod;
};

function put(data: WorkoutData, entry: FoodLogEntry): WorkoutData {
  return { ...data, foodLog: { ...data.foodLog, [entry.id]: entry }, dirty: mark(data.dirty, { foodLog: [entry.id] }) };
}

/** Logs an amount of a food. The food is copied into the entry, so later edits to it do not rewrite this entry. */
export function logFood(data: WorkoutData, food: Food | FoodSnapshot, quantity: Quantity, ctx: LogContext, nowMs: number): Result<{ entryId: string }> {
  const issues = errorsOnly(validateQuantity(food, quantity));
  if (ctx.consumedAt > nowMs + 3_600_000) issues.push({ field: 'consumedAt', message: tr('The time cannot be in the future.', 'Die Zeit kann nicht in der Zukunft liegen.'), severity: 'error' });
  const computed = nutrientsFor(food, quantity);
  if (issues.length || !computed) return { ok: false, issues };
  const snapshot = 'createdAt' in food ? snapshotOf(food as Food) : (JSON.parse(JSON.stringify(food)) as FoodSnapshot);
  const entryId = newUuid();
  const entry: FoodLogEntry = {
    id: entryId,
    consumedAt: ctx.consumedAt,
    localDate: localDateOf(ctx.consumedAt),
    mealType: ctx.mealType,
    food: snapshot,
    quantity,
    nutrients: computed.nutrients,
    ...(computed.fluidMl !== undefined ? { fluidMl: computed.fluidMl } : {}),
    ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
    entryMethod: ctx.entryMethod ?? 'search',
    estimated: ctx.estimated ?? false,
    ...(ctx.note?.trim() ? { note: ctx.note.trim() } : {}),
    revision: 1,
    createdAt: nowMs,
    updatedAt: nowMs,
  };
  return { ok: true, entryId, data: put(data, entry) };
}

/** Logs nutrients without a food, e.g. "about 600 kcal at a restaurant". What is not entered stays unknown. */
export function logQuickAdd(data: WorkoutData, input: { label?: string; nutrients: Nutrients; fluidMl?: number }, ctx: LogContext, nowMs: number): Result<{ entryId: string }> {
  const issues = errorsOnly(validateQuickAdd(input.nutrients, input.fluidMl));
  if (issues.length) return { ok: false, issues };
  const entryId = newUuid();
  const nutrients: Nutrients = {};
  for (const [k, v] of Object.entries(input.nutrients)) if (typeof v === 'number') nutrients[k as keyof Nutrients] = v;
  const entry: FoodLogEntry = {
    id: entryId,
    consumedAt: ctx.consumedAt,
    localDate: localDateOf(ctx.consumedAt),
    mealType: ctx.mealType,
    label: input.label?.trim() || undefined,
    nutrients,
    ...(input.fluidMl ? { fluidMl: input.fluidMl } : {}),
    ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
    entryMethod: 'quick_add',
    estimated: ctx.estimated ?? true,
    ...(ctx.note?.trim() ? { note: ctx.note.trim() } : {}),
    revision: 1,
    createdAt: nowMs,
    updatedAt: nowMs,
  };
  return { ok: true, entryId, data: put(data, entry) };
}

/** Corrects an entry. Nutrients are recomputed from the food as it was logged; the revision counts up. */
export function updateEntry(
  data: WorkoutData,
  entryId: string,
  patch: Partial<Pick<FoodLogEntry, 'quantity' | 'mealType' | 'consumedAt' | 'note' | 'estimated' | 'sessionId' | 'label'>> & { nutrients?: Nutrients; fluidMl?: number },
  nowMs: number
): Result<object> {
  const entry = data.foodLog[entryId];
  if (!entry || entry.deletedAt) return { ok: false, issues: [{ field: 'entry', message: tr('This entry no longer exists.', 'Diesen Eintrag gibt es nicht mehr.'), severity: 'error' }] };
  let next: FoodLogEntry = { ...entry, ...patch, revision: entry.revision + 1, updatedAt: nowMs };
  if (patch.consumedAt !== undefined) next.localDate = localDateOf(patch.consumedAt);
  if (entry.food && patch.quantity) {
    const issues = errorsOnly(validateQuantity(entry.food, patch.quantity));
    const computed = nutrientsFor(entry.food, patch.quantity);
    if (issues.length || !computed) return { ok: false, issues };
    next = { ...next, nutrients: computed.nutrients, fluidMl: computed.fluidMl };
  } else if (!entry.food && (patch.nutrients || patch.fluidMl !== undefined)) {
    const issues = errorsOnly(validateQuickAdd(next.nutrients, next.fluidMl));
    if (issues.length) return { ok: false, issues };
  }
  if (next.note !== undefined && !next.note.trim()) delete next.note;
  if (next.label !== undefined && !next.label.trim()) delete next.label;
  return { ok: true, data: put(data, next) };
}

export function removeEntry(data: WorkoutData, entryId: string, nowMs: number): WorkoutData {
  const entry = data.foodLog[entryId];
  if (!entry) return data;
  return put(data, { ...entry, deletedAt: nowMs, updatedAt: nowMs });
}

// ----------------------------------------------------------- saved meals

/** Saves the food entries given as a reusable meal. Quick-adds have no food to repeat and are left out. */
export function saveMeal(data: WorkoutData, name: string, entryIds: string[], nowMs: number): Result<{ mealId: string }> {
  const items = entryIds
    .map((id) => data.foodLog[id])
    .filter((e): e is FoodLogEntry => !!e && !e.deletedAt && !!e.food && !!e.quantity)
    .map((e) => ({ food: e.food as FoodSnapshot, quantity: e.quantity as Quantity }));
  if (!name.trim()) return { ok: false, issues: [{ field: 'name', message: tr('Give the meal a name.', 'Gib der Mahlzeit einen Namen.'), severity: 'error' }] };
  if (!items.length) return { ok: false, issues: [{ field: 'items', message: tr('A saved meal needs at least one food.', 'Eine gespeicherte Mahlzeit braucht mindestens ein Lebensmittel.'), severity: 'error' }] };
  const mealId = newUuid();
  const meal: SavedMeal = { id: mealId, name: name.trim(), items, createdAt: nowMs, updatedAt: nowMs };
  return { ok: true, mealId, data: { ...data, savedMeals: { ...data.savedMeals, [mealId]: meal }, dirty: mark(data.dirty, { savedMeals: [mealId] }) } };
}

/** Logs every item of a saved meal as its own entry, so each portion can still be corrected. */
export function logSavedMeal(data: WorkoutData, mealId: string, ctx: LogContext, nowMs: number): Result<{ entryIds: string[] }> {
  const meal = data.savedMeals[mealId];
  if (!meal || meal.deletedAt) return { ok: false, issues: [{ field: 'meal', message: tr('This saved meal no longer exists.', 'Diese gespeicherte Mahlzeit gibt es nicht mehr.'), severity: 'error' }] };
  let next = data;
  const entryIds: string[] = [];
  for (const item of meal.items) {
    const res = logFood(next, item.food, item.quantity, { ...ctx, entryMethod: 'saved_meal' }, nowMs);
    if (!res.ok) return res;
    next = res.data;
    entryIds.push(res.entryId);
  }
  return { ok: true, entryIds, data: next };
}

export function removeSavedMeal(data: WorkoutData, mealId: string, nowMs: number): WorkoutData {
  const meal = data.savedMeals[mealId];
  if (!meal) return data;
  return { ...data, savedMeals: { ...data.savedMeals, [mealId]: { ...meal, deletedAt: nowMs, updatedAt: nowMs } }, dirty: mark(data.dirty, { savedMeals: [mealId] }) };
}
