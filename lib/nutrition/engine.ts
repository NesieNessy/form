import { KJ_PER_KCAL, NUTRIENTS, NUTRIENT_ORDER, type Food, type FoodLogEntry, type FoodSnapshot, type NutrientKey, type Nutrients, type Quantity } from './model';

/**
 * The deterministic nutrition engine: portion conversion, nutrient scaling,
 * daily totals and logging coverage. No model ever does this arithmetic.
 * Unknown values stay unknown: a total over entries where some lack a
 * nutrient is reported as "at least" that much, never as complete.
 */

type FoodLike = Pick<Food, 'basis' | 'nutrients' | 'servings' | 'densityGPerMl' | 'isFluid'>;

export const kjToKcal = (kj: number) => kj / KJ_PER_KCAL;

/** Grams and millilitres a quantity amounts to, where they can be known. */
export function resolveAmount(food: FoodLike, q: Quantity): { grams?: number; ml?: number; servings?: number } {
  const density = food.densityGPerMl;
  if (q.unit === 'g') return { grams: q.value, ml: density ? q.value / density : undefined };
  if (q.unit === 'ml') return { ml: q.value, grams: density ? q.value * density : undefined };
  const serving = food.servings.find((s) => s.label === q.servingLabel) ?? food.servings[0];
  const grams = serving?.grams !== undefined ? serving.grams * q.value : serving?.ml !== undefined && density ? serving.ml * density * q.value : undefined;
  const ml = serving?.ml !== undefined ? serving.ml * q.value : grams !== undefined && density ? grams / density : undefined;
  // For a per-serving food, the first serving is "one serving" of the label.
  const base = food.servings[0];
  const servings = !serving || serving === base ? q.value : base.grams && grams !== undefined ? grams / base.grams : base.ml && ml !== undefined ? ml / base.ml : undefined;
  return { grams, ml, servings };
}

/** How many multiples of the food's stated basis a quantity is, or undefined when it cannot be known. */
export function basisFactor(food: FoodLike, q: Quantity): number | undefined {
  const amount = resolveAmount(food, q);
  if (food.basis === 'per_100g') return amount.grams !== undefined ? amount.grams / 100 : undefined;
  if (food.basis === 'per_100ml') return amount.ml !== undefined ? amount.ml / 100 : undefined;
  if (q.unit === 'serving') return amount.servings;
  const base = food.servings[0];
  if (q.unit === 'g' && base?.grams) return q.value / base.grams;
  if (q.unit === 'ml' && base?.ml) return q.value / base.ml;
  return undefined;
}

/** The units a food can be logged in. */
export function unitsFor(food: FoodLike): ('g' | 'ml' | 'serving')[] {
  const units: ('g' | 'ml' | 'serving')[] = [];
  const probe = (unit: 'g' | 'ml') => basisFactor(food, { value: 100, unit }) !== undefined;
  if (probe('g')) units.push('g');
  if (probe('ml')) units.push('ml');
  if (food.servings.length) units.push('serving');
  return units;
}

export function scaleNutrients(nutrients: Nutrients, factor: number): Nutrients {
  const out: Nutrients = {};
  for (const key of NUTRIENT_ORDER) {
    const v = nutrients[key];
    if (v === undefined) continue;
    out[key] = v === null ? null : v * factor;
  }
  return out;
}

/** Nutrients and fluid for a quantity of a food, or undefined when the quantity cannot be converted. */
export function nutrientsFor(food: FoodLike, q: Quantity): { nutrients: Nutrients; fluidMl?: number } | undefined {
  const factor = basisFactor(food, q);
  if (factor === undefined) return undefined;
  const ml = resolveAmount(food, q).ml;
  return { nutrients: scaleNutrients(food.nutrients, factor), fluidMl: food.isFluid && ml !== undefined ? ml : undefined };
}

export function snapshotOf(food: Food): FoodSnapshot {
  const { id, name, brand, basis, nutrients, servings, densityGPerMl, isFluid, source, sourceNote } = food;
  return JSON.parse(JSON.stringify({ id, name, brand, basis, nutrients, servings, densityGPerMl, isFluid, source, sourceNote }));
}

// ---------------------------------------------------------------- totals

export type NutrientTotal = {
  /** Sum of the entries that state this nutrient. */
  value: number;
  /** Entries that do not state it; when above zero the true total is higher than `value` or unknown. */
  missing: number;
};

export type DayTotals = {
  nutrients: Record<NutrientKey, NutrientTotal>;
  fluidMl: number;
  entries: number;
  estimated: number;
};

export function totals(entries: FoodLogEntry[]): DayTotals {
  const live = entries.filter((e) => !e.deletedAt);
  const nutrients = {} as Record<NutrientKey, NutrientTotal>;
  for (const key of NUTRIENT_ORDER) {
    let value = 0;
    let missing = 0;
    for (const e of live) {
      const v = e.nutrients[key];
      if (typeof v === 'number') value += v;
      else missing++;
    }
    nutrients[key] = { value, missing };
  }
  return {
    nutrients,
    fluidMl: live.reduce((sum, e) => sum + (e.fluidMl ?? 0), 0),
    entries: live.length,
    estimated: live.filter((e) => e.estimated).length,
  };
}

export function entriesOn(entries: FoodLogEntry[], localDate: string): FoodLogEntry[] {
  return entries.filter((e) => !e.deletedAt && e.localDate === localDate).sort((a, b) => a.consumedAt - b.consumedAt);
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type WeekSummary = {
  days: number;
  /** Days with at least one entry. Averages are over these days only. */
  loggedDays: number;
  /** Average per logged day, and whether some entries on those days lacked the nutrient. */
  average: Record<NutrientKey, { value: number; incomplete: boolean }>;
  averageFluidMl: number;
};

/** The `days` days ending with `endDate`. Days without entries are unknown, not zero, so they are left out of the averages. */
export function weekSummary(entries: FoodLogEntry[], endDate: string, days = 7): WeekSummary {
  const perDay = Array.from({ length: days }, (_, i) => entriesOn(entries, shiftDate(endDate, -i))).filter((d) => d.length > 0);
  const average = {} as WeekSummary['average'];
  for (const key of NUTRIENT_ORDER) {
    const dayTotals = perDay.map((d) => totals(d).nutrients[key]);
    average[key] = {
      value: perDay.length ? dayTotals.reduce((s, t) => s + t.value, 0) / perDay.length : 0,
      incomplete: dayTotals.some((t) => t.missing > 0),
    };
  }
  return {
    days,
    loggedDays: perDay.length,
    average,
    averageFluidMl: perDay.length ? perDay.reduce((s, d) => s + totals(d).fluidMl, 0) / perDay.length : 0,
  };
}

// ------------------------------------------------------------ validation

export type Issue = { field: string; message: string; severity: 'error' | 'warning' };

/** Checks a food the athlete enters from a label. Values are per the stated basis. */
export function validateFood(food: Pick<Food, 'name' | 'basis' | 'nutrients' | 'servings'>): Issue[] {
  const issues: Issue[] = [];
  if (!food.name.trim()) issues.push({ field: 'name', message: 'Give the food a name.', severity: 'error' });
  if (food.basis === 'per_serving' && !food.servings[0]?.label.trim()) {
    issues.push({ field: 'servings', message: 'Describe the serving the values refer to, e.g. "1 bar (40 g)".', severity: 'error' });
  }
  const known = NUTRIENT_ORDER.filter((k) => typeof food.nutrients[k] === 'number');
  if (known.length === 0) issues.push({ field: 'nutrients', message: 'Enter at least one value from the label.', severity: 'error' });
  for (const key of known) {
    const v = food.nutrients[key] as number;
    if (v < 0) issues.push({ field: key, message: `${NUTRIENTS[key].label} cannot be negative.`, severity: 'error' });
    else if (food.basis !== 'per_serving' && v > NUTRIENTS[key].maxPer100) {
      issues.push({ field: key, message: `${NUTRIENTS[key].label} of ${v} ${NUTRIENTS[key].unit} per 100 is not possible. Check the unit.`, severity: 'error' });
    }
  }
  if (food.basis !== 'per_serving') {
    // Fiber is left out: many labels count it inside carbohydrate.
    const mass = (['protein_g', 'carbohydrate_g', 'fat_g'] as const).reduce((s, k) => s + (food.nutrients[k] ?? 0), 0);
    if (mass > 105) issues.push({ field: 'nutrients', message: 'Protein, carbohydrate and fat add up to more than 100 g per 100. Check the values.', severity: 'error' });
  }
  const energy = food.nutrients.energy_kcal;
  const p = food.nutrients.protein_g;
  const c = food.nutrients.carbohydrate_g;
  const f = food.nutrients.fat_g;
  if (typeof energy === 'number' && typeof p === 'number' && typeof c === 'number' && typeof f === 'number') {
    const fromMacros = 4 * p + 4 * c + 9 * f;
    if (Math.abs(fromMacros - energy) > Math.max(40, energy * 0.25)) {
      issues.push({
        field: 'energy_kcal',
        message: `The macros suggest about ${Math.round(fromMacros)} kcal, the label says ${Math.round(energy)} kcal. Check whether the energy is in kJ.`,
        severity: 'warning',
      });
    }
  }
  return issues;
}

export function validateQuantity(food: FoodLike, q: Quantity): Issue[] {
  if (!(q.value > 0)) return [{ field: 'quantity', message: 'Enter an amount above zero.', severity: 'error' }];
  const amount = resolveAmount(food, q);
  if ((amount.grams ?? 0) > 5000 || (amount.ml ?? 0) > 5000 || (q.unit === 'serving' && q.value > 50)) {
    return [{ field: 'quantity', message: 'That is more than anyone eats or drinks at once. Check the amount and unit.', severity: 'error' }];
  }
  if (basisFactor(food, q) === undefined) return [{ field: 'quantity', message: 'This food cannot be measured in that unit. Choose another.', severity: 'error' }];
  return [];
}

export function validateQuickAdd(nutrients: Nutrients, fluidMl?: number): Issue[] {
  const known = NUTRIENT_ORDER.filter((k) => typeof nutrients[k] === 'number');
  if (known.length === 0 && !(fluidMl && fluidMl > 0)) return [{ field: 'nutrients', message: 'Enter at least one value.', severity: 'error' }];
  const issues: Issue[] = [];
  for (const key of known) if ((nutrients[key] as number) < 0) issues.push({ field: key, message: `${NUTRIENTS[key].label} cannot be negative.`, severity: 'error' });
  if ((nutrients.energy_kcal ?? 0) > 6000) issues.push({ field: 'energy_kcal', message: 'More than 6000 kcal in one entry. Check the number.', severity: 'error' });
  if ((fluidMl ?? 0) > 5000) issues.push({ field: 'fluidMl', message: 'More than 5 litres in one entry. Check the number.', severity: 'error' });
  return issues;
}
