/**
 * Storage, access, sharing and deletion tests for nutrition (roadmap Step 5).
 * Rows are written the way lib/sync writes them: an upsert of the mapper's
 * row, as the signed-in athlete.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import type { Profile } from '../../lib/athlete/model';
import { CATALOG } from '../../lib/nutrition/catalog';
import { addFood, logFood, logQuickAdd, saveMeal } from '../../lib/nutrition/state';
import { foodLogToRow, foodToRow, profileToRow, rowToFood, rowToFoodLog, rowToProfile, rowToSavedMeal, savedMealToRow } from '../../lib/sync/mappers';
import { EMPTY_DATA, type WorkoutData } from '../../lib/workout/state';
import { openDatabase, plain, readMigration, rejects, type Harness } from './harness';

const ATHLETE = 'a7000000-0000-4000-8000-000000000001';
const COACH = 'c7000000-0000-4000-8000-000000000002';
const STRANGER = 'd7000000-0000-4000-8000-000000000003';
const NOW = Date.now() - 3_600_000;

let h: Harness;

async function upsert(table: string, row: Record<string, unknown>, conflict = 'id') {
  const cols = Object.keys(row);
  const values = Object.values(row).map((v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : Array.isArray(v) && table !== 'profiles' ? JSON.stringify(v) : v));
  await h.db.query(
    `insert into ${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     on conflict (${conflict}) do update set ${cols.filter((c) => c !== conflict).map((c) => `${c} = excluded.${c}`).join(', ')}`,
    values
  );
}

/** What PostgREST would hand the app: timestamps as ISO strings, dates as YYYY-MM-DD. */
function asApi(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!(v instanceof Date)) out[k] = v;
    else if (k === 'local_date') out[k] = `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    else out[k] = v.toISOString();
  }
  return out;
}

function seed() {
  const bar = addFood(EMPTY_DATA, { name: 'Protein bar', brand: 'Acme', basis: 'per_serving', nutrients: { energy_kcal: 200, protein_g: 20, sodium_mg: null }, servings: [{ label: '1 bar', grams: 60 }] }, NOW);
  assert.ok(bar.ok);
  const oats = logFood(bar.data, CATALOG[0], { value: 80, unit: 'g' }, { mealType: 'breakfast', consumedAt: NOW - 60_000, note: 'felt heavy' }, NOW);
  assert.ok(oats.ok);
  const gel = logFood(oats.data, CATALOG.find((f) => f.id === 'catalog:energy_gel')!, { value: 1, unit: 'serving' }, { mealType: 'during_workout', consumedAt: NOW - 30_000, sessionId: 'a7000000-0000-4000-8000-0000000000aa' }, NOW);
  assert.ok(gel.ok);
  const quick = logQuickAdd(gel.data, { label: 'Dinner out', nutrients: { energy_kcal: 900 } }, { mealType: 'dinner', consumedAt: NOW - 10_000 }, NOW);
  assert.ok(quick.ok);
  const meal = saveMeal(quick.data, 'Oat breakfast', [oats.entryId], NOW);
  assert.ok(meal.ok);
  return { data: meal.data, foodId: bar.foodId, oatsId: oats.entryId, gelId: gel.entryId, quickId: quick.entryId, mealId: meal.mealId };
}

describe('nutrition migration', () => {
  let s: ReturnType<typeof seed>;
  let data: WorkoutData;

  before(async () => {
    h = await openDatabase();
    await h.addUser(ATHLETE, 'athlete@example.com');
    await h.addUser(COACH, 'coach@example.com');
    await h.addUser(STRANGER, 'stranger@example.com');
    s = seed();
    data = s.data;
  });

  it('can be run a second time without error', async () => {
    await h.db.exec(readMigration('migrations/0007_nutrition.sql'));
  });

  it('stores foods, log entries, saved meals and the nutrition settings, and reads them back unchanged', async () => {
    const profile: Profile = {
      sports: ['cycling'],
      equipment: [],
      availableDays: [],
      weeklySessionTarget: 4,
      hideEnergy: true,
      nutritionTargets: { protein_g: { min: 100, max: 160 }, source: 'manual', approvedAt: NOW },
      updatedAt: NOW,
    };
    await h.as(ATHLETE, async () => {
      await upsert('profiles', profileToRow(profile, ATHLETE) as unknown as Record<string, unknown>, 'user_id');
      await upsert('foods', foodToRow(data.foods[s.foodId], ATHLETE));
      for (const e of Object.values(data.foodLog)) await upsert('food_log_entries', foodLogToRow(e, ATHLETE));
      await upsert('food_log_entries', foodLogToRow(data.foodLog[s.oatsId], ATHLETE)); // a retried upload
      await upsert('saved_meals', savedMealToRow(data.savedMeals[s.mealId], ATHLETE));

      const p = (await h.db.query<Record<string, unknown>>('select * from profiles')).rows[0];
      assert.deepEqual(plain(rowToProfile(asApi(p) as never)), plain(profile));
      const f = (await h.db.query<Record<string, unknown>>('select * from foods')).rows[0];
      assert.deepEqual(plain(rowToFood(asApi(f) as never)), plain(data.foods[s.foodId]));
      const entries = (await h.db.query<Record<string, unknown>>('select * from food_log_entries')).rows;
      assert.equal(entries.length, 3);
      for (const row of entries) {
        const back = rowToFoodLog(asApi(row) as never);
        assert.deepEqual(plain(back), plain(data.foodLog[back.id]));
      }
      const m = (await h.db.query<Record<string, unknown>>('select * from saved_meals')).rows[0];
      assert.deepEqual(plain(rowToSavedMeal(asApi(m) as never)), plain(data.savedMeals[s.mealId]));
    });
  });

  it('keeps null nutrients as null, not zero', async () => {
    const f = (await h.db.query<{ nutrients: Record<string, unknown> }>('select nutrients from foods')).rows[0];
    assert.equal(f.nutrients.sodium_mg, null);
  });

  it('refuses entries that are neither a food nor a quick-add, and unknown meal types', async () => {
    const row = foodLogToRow(data.foodLog[s.oatsId], ATHLETE);
    await h.as(ATHLETE, async () => {
      await rejects(upsert('food_log_entries', { ...row, id: 'a7000000-0000-4000-8000-0000000000b1', food: null, entry_method: 'search' }), /check constraint/);
      await rejects(upsert('food_log_entries', { ...row, id: 'a7000000-0000-4000-8000-0000000000b2', meal_type: 'brunch' }), /check constraint/);
    });
  });

  it('keeps every athlete’s food log to themselves', async () => {
    await h.as(STRANGER, async () => {
      for (const t of ['foods', 'food_log_entries', 'saved_meals']) assert.equal(await h.count(t), 0, t);
      await rejects(upsert('food_log_entries', { ...foodLogToRow(data.foodLog[s.oatsId], ATHLETE), id: 'a7000000-0000-4000-8000-0000000000c1' }), /row-level security/);
    });
  });

  it('shares the log and the targets only with consent; notes and the profile’s nutrition fields stay private', async () => {
    const inv = await h.as(ATHLETE, () => h.call<{ relationship_id: string; invite_code: string }>('invite_professional', ['coach@example.com', 'dietitian']));
    await h.as(COACH, () => h.call('accept_relationship_invite', [inv.invite_code]));
    const grant = (category: string) => h.as(ATHLETE, () => h.call('create_grant', [inv.relationship_id, category, null], ['uuid', 'text', 'timestamptz']));
    type Shared = { granted: string[]; profile?: Record<string, unknown>; nutrition_log?: Record<string, unknown>[]; nutrition_target?: Record<string, unknown> };
    const shared = () => h.as(COACH, () => h.call<Shared>('get_shared_context', [ATHLETE], ['uuid']));

    await grant('profile');
    const onlyProfile = await shared();
    assert.deepEqual([onlyProfile.granted, 'nutrition_targets' in (onlyProfile.profile ?? {}), onlyProfile.nutrition_log], [['profile'], false, undefined]);

    await grant('nutrition_log');
    await grant('nutrition_target');
    const all = await shared();
    assert.deepEqual(all.granted, ['profile', 'nutrition_log', 'nutrition_target']);
    assert.deepEqual(all.nutrition_log?.map((e) => e.name), ['Dinner out', 'Energy gel (generic)', 'Oats, rolled (dry)']);
    assert.equal(all.nutrition_log?.some((e) => 'note' in e), false);
    assert.deepEqual(all.nutrition_target?.protein_g, { min: 100, max: 160 });
    assert.equal(await h.count('audit_events', `action = 'data.read' and data_category in ('nutrition_log', 'nutrition_target')`), 2);
  });

  it('erases a deleted entry’s content and leaves the rest', async () => {
    const later = NOW + 60_000;
    await h.as(ATHLETE, () => upsert('food_log_entries', foodLogToRow({ ...data.foodLog[s.oatsId], deletedAt: later, updatedAt: later }, ATHLETE)));
    const row = (await h.db.query<Record<string, unknown>>('select food, quantity, nutrients, note from food_log_entries where id = $1', [s.oatsId])).rows[0];
    assert.deepEqual([row.food, row.quantity, row.nutrients, row.note], [null, null, {}, null]);
    assert.equal(await h.count('food_log_entries', 'deleted_at is null'), 2);
  });

  it('logs meal parsing runs like other assistant runs (migration 0008)', async () => {
    await h.db.exec(readMigration('migrations/0008_meal_parsing.sql'));
    await h.db.query(`insert into agent_runs (user_id, workflow, status) values ($1, 'meal_parse', 'succeeded')`, [ATHLETE]);
    await rejects(h.db.query(`insert into agent_runs (user_id, workflow, status) values ($1, 'diet_plan', 'succeeded')`, [ATHLETE]), /check constraint/);
    await h.as(ATHLETE, async () => assert.equal(await h.count('agent_runs', `workflow = 'meal_parse'`), 1));
  });

  it('includes nutrition in the export, without deleted entries', async () => {
    const exported = await h.as(ATHLETE, () => h.call<{ nutrition: { foods: unknown[]; log: { meal_type: string }[]; saved_meals: unknown[] } }>('export_my_data'));
    assert.deepEqual(
      [exported.nutrition.foods.length, exported.nutrition.log.map((e) => e.meal_type), exported.nutrition.saved_meals.length],
      [1, ['during_workout', 'dinner'], 1]
    );
  });
});
