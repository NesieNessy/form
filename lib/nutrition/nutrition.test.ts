import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { HealthObservation } from '../health/model';
import { newUuid } from '../id';
import type { WorkoutContent } from '../workout/model';
import { EMPTY_DATA, createWorkout, withCurrentShape } from '../workout/state';
import { CATALOG, searchFoods } from './catalog';
import { basisFactor, kjToKcal, nutrientsFor, totals, unitsFor, validateFood, weekSummary } from './engine';
import type { Food } from './model';
import { addFood, logFood, logQuickAdd, logSavedMeal, removeEntry, saveMeal, updateEntry } from './state';
import { checkTargets, dayTypeFor, plannedMinutes, suggestTargets, targetsForDay, trainingDay } from './targets';

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const at = (h: number, dayOffset = 0) => new Date(2026, 9, 14 + dayOffset, h, 0).getTime();
const food = (id: string) => CATALOG.find((f) => f.id === `catalog:${id}`) as Food;
const close = (a: number | null | undefined, b: number, eps = 0.05) => assert.ok(typeof a === 'number' && Math.abs(a - b) <= eps, `${a} != ${b}`);

describe('portions and units', () => {
  it('scales per-100 g values by weight and by a named serving', () => {
    const oats = food('oats');
    close(nutrientsFor(oats, { value: 80, unit: 'g' })?.nutrients.energy_kcal, 389 * 0.8);
    close(nutrientsFor(oats, { value: 2, unit: 'serving', servingLabel: '1/2 cup' })?.nutrients.carbohydrate_g, 66.3 * 0.8);
  });

  it('converts between millilitres and grams only when the density is known', () => {
    const milk = food('milk_whole');
    const glass = nutrientsFor(milk, { value: 250, unit: 'ml' });
    close(glass?.nutrients.protein_g, 3.2 * 2.5 * 1.03);
    assert.equal(glass?.fluidMl, 250, 'a drink counts towards fluid');
    const oats = food('oats');
    assert.equal(basisFactor(oats, { value: 100, unit: 'ml' }), undefined, 'oats have no density, so millilitres mean nothing');
    assert.deepEqual(unitsFor(oats), ['g', 'serving']);
    assert.deepEqual(unitsFor(milk), ['g', 'ml', 'serving']);
  });

  it('handles per-serving labels by count and by weight', () => {
    const gel = food('energy_gel');
    close(nutrientsFor(gel, { value: 2, unit: 'serving' })?.nutrients.carbohydrate_g, 50);
    close(nutrientsFor(gel, { value: 16, unit: 'g' })?.nutrients.energy_kcal, 50);
    assert.equal(nutrientsFor(gel, { value: 100, unit: 'ml' }), undefined);
  });

  it('keeps unknown nutrients unknown instead of zero', () => {
    const tuna = nutrientsFor(food('tuna_canned'), { value: 120, unit: 'g' });
    assert.equal(tuna?.nutrients.sodium_mg, null);
    assert.equal('caffeine_mg' in (tuna?.nutrients ?? {}), false);
  });

  it('converts kilojoules exactly', () => {
    close(kjToKcal(1674), 400.1, 0.1);
  });
});

describe('the starter catalog', () => {
  it('states energy consistent with its macros for every food', () => {
    for (const f of CATALOG) {
      const { energy_kcal: e, protein_g: p, carbohydrate_g: c, fat_g: fat, fiber_g: fiber } = f.nutrients;
      if ([e, p, c, fat].some((v) => typeof v !== 'number')) continue;
      // Atwater factors, with fiber counted at about 2 kcal/g.
      const estimate = 4 * (p as number) + 4 * ((c as number) - ((fiber as number) ?? 0)) + 2 * ((fiber as number) ?? 0) + 9 * (fat as number);
      assert.ok(Math.abs(estimate - (e as number)) <= Math.max(15, (e as number) * 0.15), `${f.name}: ${e} kcal stated, ${Math.round(estimate)} from macros`);
    }
  });

  it('passes the same validation as a food the athlete enters', () => {
    for (const f of CATALOG) assert.deepEqual(validateFood(f).filter((i) => i.severity === 'error'), [], f.name);
  });

  it('finds foods regardless of case and accents, own foods first', () => {
    assert.deepEqual(searchFoods('GREEK yog', []).map((f) => f.id), ['catalog:greek_yogurt']);
    const mine = { ...food('banana'), id: 'mine', name: 'Banane (Bio)', source: 'user' as const, updatedAt: 1 };
    assert.equal(searchFoods('banane', [mine])[0].id, 'mine');
    assert.equal(searchFoods('', [mine])[0].id, 'mine');
  });
});

describe('the log', () => {
  it('logs a food with a snapshot, so editing the food later does not rewrite history', () => {
    const added = addFood(EMPTY_DATA, { name: 'Protein bar', basis: 'per_serving', nutrients: { energy_kcal: 200, protein_g: 20 }, servings: [{ label: '1 bar', grams: 60 }] }, NOW);
    assert.ok(added.ok);
    const bar = added.data.foods[added.foodId];
    const logged = logFood(added.data, bar, { value: 1, unit: 'serving' }, { mealType: 'snack', consumedAt: at(10) }, NOW);
    assert.ok(logged.ok);
    const entry = logged.data.foodLog[logged.entryId];
    assert.equal(entry.food?.name, 'Protein bar');
    assert.equal(entry.localDate, '2026-10-14');
    assert.deepEqual(logged.data.dirty.foodLog, [logged.entryId]);
    const changed = { ...logged.data, foods: { ...logged.data.foods, [bar.id]: { ...bar, nutrients: { energy_kcal: 999 } } } };
    assert.equal(changed.foodLog[logged.entryId].nutrients.energy_kcal, 200);
  });

  it('refuses implausible amounts and future times', () => {
    const banana = food('banana');
    const tooMuch = logFood(EMPTY_DATA, banana, { value: 9000, unit: 'g' }, { mealType: 'snack', consumedAt: NOW }, NOW);
    assert.equal(tooMuch.ok, false);
    const zero = logFood(EMPTY_DATA, banana, { value: 0, unit: 'g' }, { mealType: 'snack', consumedAt: NOW }, NOW);
    assert.equal(zero.ok, false);
    const future = logFood(EMPTY_DATA, banana, { value: 100, unit: 'g' }, { mealType: 'snack', consumedAt: NOW + 5 * 3_600_000 }, NOW);
    assert.equal(future.ok, false);
  });

  it('corrects an entry by recomputing from the logged food and counting the revision', () => {
    const logged = logFood(EMPTY_DATA, food('rice_white'), { value: 100, unit: 'g' }, { mealType: 'lunch', consumedAt: at(13) }, NOW);
    assert.ok(logged.ok);
    const fixed = updateEntry(logged.data, logged.entryId, { quantity: { value: 250, unit: 'g' } }, NOW + 1);
    assert.ok(fixed.ok);
    const e = fixed.data.foodLog[logged.entryId];
    close(e.nutrients.energy_kcal, 325);
    assert.equal(e.revision, 2);
  });

  it('totals a day, saying "at least" where an entry lacks a nutrient', () => {
    let data = EMPTY_DATA;
    const add = (r: ReturnType<typeof logFood>) => {
      assert.ok(r.ok);
      data = r.data;
    };
    add(logFood(data, food('oats'), { value: 80, unit: 'g' }, { mealType: 'breakfast', consumedAt: at(7) }, NOW));
    add(logFood(data, food('milk_whole'), { value: 200, unit: 'ml' }, { mealType: 'breakfast', consumedAt: at(7) }, NOW));
    add(logQuickAdd(data, { label: 'Restaurant pasta', nutrients: { energy_kcal: 800 } }, { mealType: 'dinner', consumedAt: at(19) }, NOW));
    add(logQuickAdd(data, { nutrients: {}, fluidMl: 500 }, { mealType: 'snack', consumedAt: at(15) }, NOW));
    const t = totals(Object.values(data.foodLog));
    close(t.nutrients.energy_kcal.value, 311.2 + 61 * 2 * 1.03 + 800, 0.5);
    assert.equal(t.nutrients.energy_kcal.missing, 1, 'the water-only entry states no energy');
    assert.equal(t.nutrients.protein_g.missing, 2, 'the quick-adds state no protein');
    assert.equal(t.fluidMl, 700);
    assert.deepEqual([t.entries, t.estimated], [4, 2], 'quick-adds count as estimates');

    const gone = removeEntry(data, Object.keys(data.foodLog)[0], NOW);
    assert.equal(totals(Object.values(gone.foodLog)).entries, 3);
  });

  it('averages a week over the days that were logged, never counting gaps as zero', () => {
    let data = EMPTY_DATA;
    for (const d of [0, -1, -3]) {
      const r = logQuickAdd(data, { nutrients: { energy_kcal: 2000, protein_g: 120 } }, { mealType: 'lunch', consumedAt: at(12, d) }, NOW);
      assert.ok(r.ok);
      data = r.data;
    }
    const w = weekSummary(Object.values(data.foodLog), '2026-10-14');
    assert.deepEqual([w.loggedDays, w.days, w.average.energy_kcal.value, w.average.energy_kcal.incomplete], [3, 7, 2000, false]);
    assert.equal(w.average.fat_g.incomplete, true);
  });

  it('saves a meal and logs it again as separate, correctable entries', () => {
    const a = logFood(EMPTY_DATA, food('greek_yogurt'), { value: 170, unit: 'g' }, { mealType: 'breakfast', consumedAt: at(7) }, NOW);
    assert.ok(a.ok);
    const b = logFood(a.data, food('blueberries'), { value: 80, unit: 'g' }, { mealType: 'breakfast', consumedAt: at(7) }, NOW);
    assert.ok(b.ok);
    const q = logQuickAdd(b.data, { nutrients: { energy_kcal: 50 } }, { mealType: 'breakfast', consumedAt: at(7) }, NOW);
    assert.ok(q.ok);
    const saved = saveMeal(q.data, 'Yogurt bowl', [a.entryId, b.entryId, q.entryId], NOW);
    assert.ok(saved.ok);
    assert.equal(saved.data.savedMeals[saved.mealId].items.length, 2, 'the quick-add has no food to repeat');
    const again = logSavedMeal(saved.data, saved.mealId, { mealType: 'snack', consumedAt: at(11) }, NOW);
    assert.ok(again.ok);
    assert.deepEqual(again.entryIds.map((id) => again.data.foodLog[id].entryMethod), ['saved_meal', 'saved_meal']);
  });

  it('links fuel to a workout session', () => {
    const r = logFood(EMPTY_DATA, food('energy_gel'), { value: 1, unit: 'serving' }, { mealType: 'during_workout', consumedAt: at(9), sessionId: 's1' }, NOW);
    assert.ok(r.ok);
    assert.equal(r.data.foodLog[r.entryId].sessionId, 's1');
  });

  it('upgrades a v4 store with empty nutrition collections', () => {
    const v4 = { ...EMPTY_DATA } as Partial<typeof EMPTY_DATA>;
    delete v4.foods;
    delete v4.foodLog;
    delete v4.savedMeals;
    const up = withCurrentShape(v4);
    assert.deepEqual([up.foods, up.foodLog, up.savedMeals, up.dirty.foodLog], [{}, {}, {}, []]);
  });
});

describe('food validation', () => {
  it('rejects impossible label values and flags energy that looks like kilojoules', () => {
    const base = { name: 'Cereal', basis: 'per_100g' as const, servings: [] };
    assert.deepEqual(validateFood({ ...base, nutrients: {} }).map((i) => i.field), ['nutrients']);
    assert.ok(validateFood({ ...base, nutrients: { fat_g: 120 } }).some((i) => i.severity === 'error'));
    assert.ok(validateFood({ ...base, nutrients: { energy_kcal: 1600 } }).some((i) => i.field === 'energy_kcal' && i.severity === 'error'), '1600 kcal per 100 g is impossible');
    // Yogurt: 247 kJ typed into the kcal field.
    const kj = validateFood({ ...base, nutrients: { energy_kcal: 247, protein_g: 10.2, carbohydrate_g: 3.6, fat_g: 0.4 } });
    assert.deepEqual(kj.map((i) => [i.field, i.severity]), [['energy_kcal', 'warning']]);
  });
});

describe('training-aware targets', () => {
  const weight = (value: number, daysAgo: number): HealthObservation => ({
    id: newUuid(),
    metric: 'weight_kg',
    value,
    unit: 'kg',
    observedAt: NOW - daysAgo * 86_400_000,
    localDate: '2026-10-01',
    ingestedAt: NOW,
    provider: 'manual',
    origin: 'user_entered',
    updatedAt: NOW,
  });

  it('suggests nothing without a recent weight', () => {
    assert.deepEqual(suggestTargets([], NOW), { ok: false, reason: 'no_recent_weight' });
    assert.deepEqual(suggestTargets([weight(70, 90)], NOW), { ok: false, reason: 'no_recent_weight' });
  });

  it('scales the published per-kg ranges to the latest weight, with no energy target', () => {
    const s = suggestTargets([weight(80, 30), weight(70, 2)], NOW);
    assert.ok(s.ok);
    assert.deepEqual(s.targets.protein_g, { min: 85, max: 140 });
    assert.deepEqual(s.targets.carbohydrateByDayType?.high, { min: 420, max: 700 });
    assert.equal(s.targets.energy_kcal, undefined);
    assert.equal(s.targets.approvedAt, 0, 'a suggestion is not approved');
    assert.deepEqual(targetsForDay(s.targets, 'rest_or_light').carbohydrate_g, { min: 210, max: 350 });
  });

  it('reads the day type from the planned workouts', () => {
    assert.deepEqual([0, 44, 45, 89, 90, 239, 240].map(dayTypeFor), ['rest_or_light', 'rest_or_light', 'moderate', 'moderate', 'high', 'high', 'very_high']);
    const ride: WorkoutContent = {
      title: 'Long ride',
      sport: 'cycling',
      blocks: [{ id: newUuid(), type: 'endurance', config: { format: 'continuous', durationSeconds: 3 * 3600 }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Ride', activityId: 'bike', prescription: {} }] }],
    };
    const lift: WorkoutContent = {
      title: 'Squats',
      sport: 'strength',
      blocks: [{ id: newUuid(), type: 'strength', config: { format: 'sets_reps', sets: 5 }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Back squat', activityId: 'back_squat', prescription: { reps: 5 } }] }],
    };
    assert.deepEqual(plannedMinutes(ride), { minutes: 180, estimated: false });
    assert.deepEqual(plannedMinutes(lift, 50), { minutes: 50, estimated: true }, 'sets and reps state no length: the usual session length is used');
    const a = createWorkout(EMPTY_DATA, ride, { source: 'manual', scheduledAt: at(9), nowMs: NOW });
    const day = trainingDay('2026-10-14', Object.values(a.data.scheduled), a.data.versions);
    assert.deepEqual(day, { dayType: 'high', minutes: 180, workouts: 1, estimated: false });
    assert.equal(trainingDay('2026-10-15', Object.values(a.data.scheduled), a.data.versions).dayType, 'rest_or_light');
  });

  it('calls out a very low energy target and refuses inverted ranges', () => {
    assert.deepEqual(checkTargets({ energy_kcal: { min: 1000, max: 1200 } }).map((i) => i.severity), ['warning']);
    assert.deepEqual(checkTargets({ protein_g: { min: 150, max: 100 } }).map((i) => i.severity), ['error']);
    assert.deepEqual(checkTargets({ energy_kcal: { min: 2400, max: 2800 } }), []);
  });
});
