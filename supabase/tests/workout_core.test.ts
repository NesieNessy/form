/**
 * Runs the real migrations against an in-process Postgres (PGlite) and
 * exercises them the way the app does: as the `authenticated` role with a
 * JWT subject, through the same payloads lib/sync builds.
 *
 * This covers the SQL (schema, row-level security, functions). It does not
 * cover Supabase's HTTP layer, which needs a live project.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { newUuid } from '../../lib/id';
import {
  rowToScheduled,
  rowToSession,
  rowToVersion,
  rowToWorkout,
  scheduledToRow,
  sessionToPayload,
  versionToPayload,
  type SessionRow,
  type VersionRow,
} from '../../lib/sync/mappers';
import { ACTIVITIES } from '../../lib/workout/catalog';
import type { Block, Step, WorkoutContent } from '../../lib/workout/model';
import { EMPTY_DATA, completeSession, createWorkout, putBlockResult, reviseWorkout, startSession } from '../../lib/workout/state';
import { validateWorkout } from '../../lib/workout/validate';
import { applySeed } from '../../scripts/gen-activity-seed';
import { openDatabase, plain, readMigration, rejects, type Harness } from './harness';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const NOW = Date.UTC(2026, 9, 13, 12);

// The placeholder tables the first schema created. Installs made before they
// were removed still have them, so the migrations are tested from that state.
const FIRST_SCHEMA_PLACEHOLDERS = `
  create table workouts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users (id) on delete cascade, scheduled_on date not null, completed boolean not null default false);
  create table strength_lifts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users (id) on delete cascade, exercise text not null, weight_kg numeric not null);
  create table endurance_sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users (id) on delete cascade, distance text not null);
  create table insights (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users (id) on delete cascade, title text not null);
  alter table workouts enable row level security;
  create policy "Users manage their own workouts" on workouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
`;

let h: Harness;
let db: Harness['db'];
const as = <T>(userId: string | null, fn: () => Promise<T>) => h.as(userId, fn);
const rpc = (name: string, payload: unknown) => h.rpc(name, payload);

/** Rebuilds the nested shape PostgREST returns for `*, blocks(*, steps(*))`. */
async function fetchVersions(): Promise<VersionRow[]> {
  const versions = (await db.query<Record<string, unknown>>('select * from workout_versions order by version')).rows;
  const out: VersionRow[] = [];
  for (const v of versions) {
    const blocks = (await db.query<Record<string, unknown>>('select * from blocks where version_id = $1', [v.id])).rows;
    for (const b of blocks) b.steps = (await db.query('select * from steps where block_id = $1', [b.id])).rows;
    out.push({ ...v, created_at: (v.created_at as Date).toISOString(), blocks } as unknown as VersionRow);
  }
  return out;
}

const ex = (name: string, activityId: string | null, prescription: object): Step => ({ kind: 'exercise', id: newUuid(), name, activityId, prescription });

function fullWorkout(): WorkoutContent {
  const blocks: Block[] = [
    {
      id: newUuid(),
      type: 'strength',
      label: 'Strength',
      config: { format: 'sets_reps', sets: 3, restSeconds: 120 },
      steps: [ex('Back Squat', 'back_squat', { reps: 5, load: { value: 80, unit: 'kg', per: 'total' } })],
    },
    {
      id: newUuid(),
      type: 'conditioning',
      config: { format: 'for_time', repScheme: [21, 15, 9], timeCapSeconds: 600 },
      tags: ['partner'],
      notes: 'scale as needed',
      steps: [
        ex('Thruster', 'thruster', { reps: 21 }),
        {
          kind: 'group',
          id: newUuid(),
          label: 'Finisher',
          rounds: 2,
          steps: [ex('Zercher Carry', null, { distanceMeters: 20, note: 'heavy' }), { kind: 'rest', id: newUuid(), durationSeconds: 30 }],
        },
        { kind: 'transition', id: newUuid(), name: 'Shoes on' },
      ],
    },
  ];
  return { title: 'Full', sport: 'crossfit', description: 'desc', tags: ['engine'], equipment: ['barbell'], blocks };
}

describe('workout core migration', () => {
  before(async () => {
    h = await openDatabase([]);
    db = h.db;
    await db.exec(FIRST_SCHEMA_PLACEHOLDERS);
    await db.exec(readMigration('schema.sql'));
    await db.exec(readMigration('migrations/0002_workout_core.sql'));
    await h.addUser(ALICE, 'alice@example.com');
    await h.addUser(BOB, 'bob@example.com');
  });

  it('can be run a second time without error', async () => {
    await db.exec(readMigration('migrations/0002_workout_core.sql'));
  });

  it('moved the placeholder workouts table aside', async () => {
    const cols = await db.query<{ table_name: string }>(
      `select table_name from information_schema.columns where table_schema = 'public' and column_name = 'scheduled_on'`
    );
    assert.deepEqual(cols.rows.map((r) => r.table_name), ['workouts_legacy']);
  });

  it('seeds the same activity catalog the app ships', async () => {
    const rows = await db.query<{ id: string }>('select id from activities order by id');
    assert.deepEqual(rows.rows.map((r) => r.id), ACTIVITIES.map((a) => a.id).sort());
    const sql = readMigration('migrations/0002_workout_core.sql');
    assert.equal(applySeed(sql), sql, 'run `npm run gen:activity-seed` after changing lib/workout/catalog.ts');
  });

  it('round-trips a nested workout through save_workout_version and back', async () => {
    const created = createWorkout(EMPTY_DATA, fullWorkout(), { source: 'manual', scheduledAt: NOW, nowMs: NOW });
    const workout = created.data.workouts[created.workoutId];
    const version = created.data.versions[created.versionId];
    assert.equal(version.status, 'published');

    await as(ALICE, async () => {
      await rpc('save_workout_version', versionToPayload(workout, version));
      // Idempotent: a retried upload is a no-op, not a duplicate or an error.
      await rpc('save_workout_version', versionToPayload(workout, version));

      const [row] = await fetchVersions();
      assert.deepEqual(plain(rowToVersion(row)), plain(version));

      const w = (await db.query<Record<string, unknown>>('select * from workouts')).rows[0];
      const mapped = rowToWorkout({
        ...w,
        created_at: (w.created_at as Date).toISOString(),
        updated_at: (w.updated_at as Date).toISOString(),
      } as never);
      assert.deepEqual(plain(mapped), plain(workout));
    });

    const counts = await db.query<{ b: number; s: number }>('select (select count(*)::int from blocks) as b, (select count(*)::int from steps) as s');
    assert.deepEqual(counts.rows[0], { b: 2, s: 6 });
  });

  it('advances the current version forwards only', async () => {
    const created = createWorkout(EMPTY_DATA, fullWorkout(), { source: 'manual', nowMs: NOW });
    const revised = reviseWorkout(created.data, created.workoutId, fullWorkout(), NOW + 1);
    const workout = revised.data.workouts[created.workoutId];
    const v1 = revised.data.versions[created.versionId];
    const v2 = revised.data.versions[revised.versionId];

    await as(ALICE, async () => {
      await rpc('save_workout_version', versionToPayload(workout, v1));
      await rpc('save_workout_version', versionToPayload(workout, v2));
      await rpc('save_workout_version', versionToPayload(workout, v1));
      const row = await db.query<{ current_version_id: string }>('select current_version_id from workouts where id = $1', [workout.id]);
      assert.equal(row.rows[0].current_version_id, v2.id);
    });
  });

  it('refuses to publish what the app validator rejects, and stores nothing', async () => {
    const invalid: [string, (c: WorkoutContent) => void][] = [
      ['MISSING_DURATION', (c) => (c.blocks[0].config = { format: 'amrap' })],
      ['MISSING_SETS', (c) => (c.blocks[0].config = { format: 'sets_reps' })],
      ['MISSING_INTERVAL', (c) => (c.blocks[0].config = { format: 'repeating_interval', rounds: 5 })],
      ['WORK_EXCEEDS_INTERVAL', (c) => (c.blocks[0].config = { format: 'repeating_interval', rounds: 5, intervalSeconds: 30, workSeconds: 45 })],
      ['CONFLICTING_STRUCTURE', (c) => (c.blocks[0].config = { format: 'for_time', rounds: 3, repScheme: [21, 15, 9] })],
      ['EMPTY_BLOCK', (c) => (c.blocks[0].steps = [])],
      ['NO_BLOCKS', (c) => (c.blocks = [])],
      ['MISSING_TITLE', (c) => (c.title = ' ')],
      ['INVALID_REPS', (c) => ((c.blocks[0].steps[0] as Extract<Step, { kind: 'exercise' }>).prescription = { reps: 0 })],
      ['EMPTY_GROUP', (c) => (c.blocks[0].steps = [{ kind: 'group', id: newUuid(), rounds: 2, steps: [] }])],
      ['MISSING_ROUNDS', (c) => (c.blocks[0].steps = [{ kind: 'group', id: newUuid(), steps: [ex('Burpee', 'burpee', { reps: 5 })] }])],
      ['MISSING_DURATION', (c) => c.blocks[0].steps.push({ kind: 'rest', id: newUuid() })],
    ];

    const before = (await db.query<{ n: number }>('select count(*)::int as n from workouts')).rows[0].n;

    for (const [code, breakIt] of invalid) {
      const content = fullWorkout();
      breakIt(content);
      assert.ok(validateWorkout(content).errors.some((e) => e.code === code), `app validator should report ${code}`);

      const created = createWorkout(EMPTY_DATA, content, { source: 'manual', nowMs: NOW });
      const forged = { ...created.data.versions[created.versionId], status: 'published' as const };
      await as(ALICE, () => rejects(rpc('save_workout_version', versionToPayload(created.data.workouts[created.workoutId], forged)), new RegExp(`WORKOUT_INVALID: ${code}`)));
    }

    const after = (await db.query<{ n: number }>('select count(*)::int as n from workouts')).rows[0].n;
    assert.equal(after, before, 'a rejected publish leaves no partial rows behind');
  });

  it('accepts an incomplete workout as a draft', async () => {
    const content = fullWorkout();
    content.blocks[0].config = { format: 'amrap' };
    const created = createWorkout(EMPTY_DATA, content, { source: 'import', nowMs: NOW });
    assert.equal(created.data.versions[created.versionId].status, 'draft');
    await as(ALICE, () => rpc('save_workout_version', versionToPayload(created.data.workouts[created.workoutId], created.data.versions[created.versionId])));
  });

  it('saves a schedule entry and a session with results, and reads them back unchanged', async () => {
    const created = createWorkout(EMPTY_DATA, fullWorkout(), { source: 'manual', scheduledAt: NOW, nowMs: NOW });
    const started = startSession(created.data, created.scheduledId as string, 'manual', NOW);
    assert.ok('sessionId' in started);
    const [strength, wod] = started.data.sessions[started.sessionId].prescribed.blocks;
    let data = putBlockResult(started.data, started.sessionId, {
      blockId: strength.id,
      status: 'completed',
      elapsedSeconds: 600,
      score: { type: 'load', kg: 82.5 },
      stepResults: [0, 1, 2].map((setIndex) => ({ stepId: strength.steps[0].id, setIndex, reps: 5, loadKg: 80 + setIndex * 1.25, completed: setIndex < 2 })),
    }, NOW);
    data = putBlockResult(data, started.sessionId, { blockId: wod.id, status: 'partial', elapsedSeconds: 431, score: { type: 'time', seconds: 431 }, stepResults: [] }, NOW);
    data = completeSession(data, started.sessionId, { rpe: 8, notes: 'tough' }, NOW + 5);

    const session = data.sessions[started.sessionId];
    const entry = data.scheduled[created.scheduledId as string];

    await as(ALICE, async () => {
      await rpc('save_workout_version', versionToPayload(data.workouts[created.workoutId], data.versions[created.versionId]));

      const row = scheduledToRow(entry, ALICE);
      const cols = Object.keys(row);
      await db.query(
        `insert into scheduled_workouts (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
         on conflict (id) do update set status = excluded.status, session_id = excluded.session_id, updated_at = excluded.updated_at`,
        Object.values(row)
      );
      await rpc('save_session', sessionToPayload(session));
      await rpc('save_session', sessionToPayload(session));

      const s = (await db.query<Record<string, unknown>>('select * from sessions where id = $1', [session.id])).rows[0];
      const results = (await db.query('select * from session_results where session_id = $1', [session.id])).rows;
      assert.equal(results.length, 5, 'two block rows and three set rows, not doubled by the retry');
      const toIso = (v: unknown) => (v ? (v as Date).toISOString() : null);
      const sessionRow = { ...s, started_at: toIso(s.started_at), ended_at: toIso(s.ended_at), updated_at: toIso(s.updated_at), deleted_at: toIso(s.deleted_at), session_results: results } as unknown as SessionRow;
      assert.deepEqual(plain(rowToSession(sessionRow)), plain(session));

      const e = (await db.query<Record<string, unknown>>('select * from scheduled_workouts where id = $1', [entry.id])).rows[0];
      assert.deepEqual(
        rowToScheduled({ ...e, scheduled_at: toIso(e.scheduled_at), created_at: toIso(e.created_at), updated_at: toIso(e.updated_at), deleted_at: toIso(e.deleted_at) } as never),
        entry
      );

      // An older copy arriving late must not overwrite the newer one.
      await rpc('save_session', sessionToPayload({ ...session, notes: 'stale', updatedAt: session.updatedAt - 60_000 }));
      const notes = (await db.query<{ notes: string }>('select notes from sessions where id = $1', [session.id])).rows[0].notes;
      assert.equal(notes, 'tough');
    });
  });

  describe('row-level security', () => {
    it("hides one athlete's workouts, schedule and sessions from another", async () => {
      await as(BOB, async () => {
        for (const table of ['workouts', 'workout_versions', 'blocks', 'steps', 'scheduled_workouts', 'sessions', 'session_results']) {
          const n = (await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n;
          assert.equal(n, 0, `${table} leaked rows to another user`);
        }
        const catalog = (await db.query<{ n: number }>('select count(*)::int as n from activities')).rows[0].n;
        assert.equal(catalog, ACTIVITIES.length, 'the shared catalog is readable');
      });
    });

    it('shows nothing to a signed-out caller and refuses their writes', async () => {
      await as(null, async () => {
        const n = (await db.query<{ n: number }>('select count(*)::int as n from workouts')).rows[0].n;
        assert.equal(n, 0);
        await rejects(rpc('save_workout_version', {}), /permission denied/);
      });
    });

    it("refuses to add a version to someone else's workout, even with a guessed id", async () => {
      const theirs = (await db.query<{ id: string }>('select id from workouts where user_id = $1 limit 1', [ALICE])).rows[0].id;
      const created = createWorkout(EMPTY_DATA, fullWorkout(), { source: 'manual', nowMs: NOW });
      const payload = versionToPayload({ ...created.data.workouts[created.workoutId], id: theirs }, created.data.versions[created.versionId]);
      await as(BOB, () => rejects(rpc('save_workout_version', payload), /FORBIDDEN/));
    });

    it('allows definitions to be written only through the function', async () => {
      const version = (await db.query<{ id: string; workout_id: string }>('select id, workout_id from workout_versions where user_id = $1 limit 1', [ALICE])).rows[0];
      await as(ALICE, async () => {
        await rejects(db.query(`update workout_versions set title = 'x' where id = $1`, [version.id]), /permission denied/);
        await rejects(db.query(`delete from steps`), /permission denied/);
        await rejects(db.query(`update workouts set user_id = $1 where id = $2`, [BOB, version.workout_id]), /permission denied/);
        await rejects(db.query(`update workouts set current_version_id = null where id = $1`, [version.workout_id]), /permission denied/);
        // The template flag and tombstone are the owner's to change.
        await db.query(`update workouts set is_template = true, updated_at = now() where id = $1`, [version.workout_id]);
      });
    });

    it("refuses a schedule entry or session that points at another athlete's workout", async () => {
      const version = (await db.query<{ id: string; workout_id: string }>('select id, workout_id from workout_versions where user_id = $1 limit 1', [ALICE])).rows[0];
      await as(BOB, async () => {
        await rejects(
          db.query(`insert into scheduled_workouts (id, user_id, workout_id, version_id, scheduled_at) values ($1, $2, $3, $4, now())`, [newUuid(), BOB, version.workout_id, version.id]),
          /row-level security/
        );
        await rejects(
          rpc('save_session', { id: newUuid(), workoutId: version.workout_id, versionId: version.id, prescribed: { blocks: [] }, status: 'completed', entryMode: 'manual', startedAt: new Date(NOW).toISOString(), updatedAt: new Date(NOW).toISOString(), blockResults: [] }),
          /row-level security/
        );
      });
    });

    it('does not let one athlete overwrite another athlete’s session by id', async () => {
      const theirs = (await db.query<{ id: string }>('select id from sessions where user_id = $1 limit 1', [ALICE])).rows[0].id;
      const mine = createWorkout(EMPTY_DATA, fullWorkout(), { source: 'manual', nowMs: NOW });
      await as(BOB, async () => {
        await rpc('save_workout_version', versionToPayload(mine.data.workouts[mine.workoutId], mine.data.versions[mine.versionId]));
        await rejects(
          rpc('save_session', { id: theirs, workoutId: mine.workoutId, versionId: mine.versionId, prescribed: { blocks: [] }, status: 'completed', entryMode: 'manual', startedAt: new Date(NOW).toISOString(), updatedAt: new Date(NOW + 10 * 60_000).toISOString(), notes: 'hijacked', blockResults: [] }),
          /row-level security|duplicate key/
        );
      });
      const notes = (await db.query<{ notes: string }>('select notes from sessions where id = $1', [theirs])).rows[0].notes;
      assert.equal(notes, 'tough');
    });
  });

  describe('placeholder cleanup (0004)', () => {
    const exists = async (table: string) => (await db.query<{ t: string | null }>(`select to_regclass('public.' || $1)::text as t`, [table])).rows[0].t !== null;

    it('drops the empty placeholder tables and keeps one that holds rows', async () => {
      await db.query(`insert into strength_lifts (user_id, exercise, weight_kg) values ($1, 'Squat', 80)`, [ALICE]);
      await db.exec(readMigration('migrations/0004_drop_placeholder_tables.sql'));
      assert.deepEqual(
        [await exists('workouts_legacy'), await exists('endurance_sessions'), await exists('insights'), await exists('strength_lifts')],
        [false, false, false, true]
      );
      assert.equal(await exists('workouts'), true, 'the real workouts table is untouched');
    });

    it('can be run again, and finishes the job once the table is empty', async () => {
      await db.query('delete from strength_lifts');
      await db.exec(readMigration('migrations/0004_drop_placeholder_tables.sql'));
      await db.exec(readMigration('migrations/0004_drop_placeholder_tables.sql'));
      assert.equal(await exists('strength_lifts'), false);
    });
  });
});
