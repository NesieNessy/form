/**
 * Storage and sharing tests for goals (roadmap Step 10): the athlete's own
 * records, revision history kept, and a coach who sees a goal only with the
 * category grant AND the goal marked shared.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { addGoal, reviseGoal, setVisibility } from '../../lib/goals/state';
import { goalToRow, rowToGoal } from '../../lib/sync/mappers';
import { EMPTY_DATA, type WorkoutData } from '../../lib/workout/state';
import { openDatabase, plain, readMigration, rejects, type Harness } from './harness';

const ATHLETE = 'a4000000-0000-4000-8000-0000000000a1';
const COACH = 'c4000000-0000-4000-8000-0000000000c1';
const STRANGER = 'd4000000-0000-4000-8000-0000000000d1';
const NOW = Date.now();

let h: Harness;

async function upsert(row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const values = Object.values(row).map((v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v));
  await h.db.query(
    `insert into athlete_goals (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) on conflict (id) do update set ${cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')}`,
    values
  );
}
const call = <T>(user: string, fn: string, args: unknown[] = [], casts: string[] = []) => h.as(user, () => h.call<T>(fn, args, casts));

describe('goals migration', () => {
  let data: WorkoutData;
  let shared: string;
  let secret: string;
  let rel: string;

  before(async () => {
    h = await openDatabase();
    for (const [id, email] of [[ATHLETE, 'athlete@example.com'], [COACH, 'coach@example.com'], [STRANGER, 'stranger@example.com']]) await h.addUser(id, email);
    const a = addGoal(EMPTY_DATA, { title: 'Squat 140', metric: { kind: 'one_rep_max', activityId: 'back_squat' }, target: 140, targetDate: '2027-03-01', baseline: { value: 120, measuredAt: '2026-09-01', source: 'test' } }, NOW);
    assert.ok(a.ok);
    const b = addGoal(a.data, { title: 'Private goal', metric: { kind: 'event', name: 'Secret race' }, targetDate: '2027-06-01' }, NOW);
    assert.ok(b.ok);
    const revised = reviseGoal(setVisibility(b.data, a.goalId, 'shared', NOW), a.goalId, { target: 135 }, 'after a break', NOW + 1);
    assert.ok(revised.ok);
    data = revised.data;
    shared = a.goalId;
    secret = b.goalId;
    const inv = await call<{ relationship_id: string; invite_code: string }>(ATHLETE, 'invite_professional', ['coach@example.com', 'training_coach']);
    await call(COACH, 'accept_relationship_invite', [inv.invite_code]);
    rel = inv.relationship_id;
  });

  it('can be run a second time without error', async () => {
    await h.db.exec(readMigration('migrations/0013_goals.sql'));
  });

  it('stores goals with their history and reads them back unchanged', async () => {
    await h.as(ATHLETE, async () => {
      for (const g of Object.values(data.goals)) await upsert(goalToRow(g, ATHLETE) as unknown as Record<string, unknown>);
      const row = (await h.db.query<Record<string, unknown>>('select * from athlete_goals where id = $1', [shared])).rows[0];
      const api = { ...row, target_date: String(data.goals[shared].targetDate), created_at: (row.created_at as Date).toISOString(), updated_at: (row.updated_at as Date).toISOString() };
      assert.deepEqual(plain(rowToGoal(api as never)), plain(data.goals[shared]));
      await rejects(upsert({ ...goalToRow(data.goals[shared], ATHLETE), id: 'a4000000-0000-4000-8000-0000000000ff', metric: { kind: 'world_peace' } } as unknown as Record<string, unknown>), /check constraint/);
    });
    await h.as(STRANGER, async () => assert.equal(await h.count('athlete_goals'), 0));
  });

  it('shows a coach only goals the athlete shares, and only with the category granted', async () => {
    type Shared = { shared: boolean; goals: { id: string; title: string; revisions: unknown[]; reviews: unknown[] }[] };
    assert.deepEqual(await call<Shared>(COACH, 'list_shared_goals', [ATHLETE], ['uuid']), { shared: false, goals: [] });
    await rejects(call(COACH, 'add_goal_review', [shared, 'Nice']), /FORBIDDEN/);
    await call(ATHLETE, 'create_grant', [rel, 'goals', null], ['uuid', 'text', 'timestamptz']);
    const res = await call<Shared>(COACH, 'list_shared_goals', [ATHLETE], ['uuid']);
    assert.deepEqual(res.goals.map((g) => g.title), ['Squat 140'], 'the private goal is not included');
    assert.equal(res.goals[0].revisions.length, 1);
    assert.equal(await h.count('audit_events', `actor_user_id = $1 and action = 'data.read' and data_category = 'goals'`, [COACH]), 1);
    await rejects(call(STRANGER, 'list_shared_goals', [ATHLETE], ['uuid']), /FORBIDDEN/);
    await rejects(call(COACH, 'add_goal_review', [secret, 'peek']), /FORBIDDEN/);
  });

  it('lets the coach comment and the athlete read it; nobody writes reviews directly', async () => {
    await call(COACH, 'add_goal_review', [shared, 'Good progress, keep the singles honest.']);
    await h.as(ATHLETE, async () => {
      assert.equal(await h.count('goal_reviews'), 1);
      await rejects(h.db.query(`insert into goal_reviews (goal_id, athlete_id, author_id, body) values ($1, $2, $2, 'self-praise')`, [shared, ATHLETE]), /permission denied/);
    });
    await h.as(STRANGER, async () => assert.equal(await h.count('goal_reviews'), 0));
    const exported = await call<{ goals: { goals: unknown[]; reviews: unknown[] } }>(ATHLETE, 'export_my_data');
    assert.deepEqual([exported.goals.goals.length, exported.goals.reviews.length], [2, 1]);
  });
});
