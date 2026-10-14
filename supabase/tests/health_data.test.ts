/**
 * Storage, access and deletion tests for activities and measurements
 * (roadmap Step 4). Rows are written the way lib/sync writes them: an upsert
 * of the mapper's row, as the signed-in athlete.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { Encoder, Profile } from '@garmin/fitsdk';
import { addObservation, importActivity, logActivityAsWorkout } from '../../lib/health/state';
import { parseActivityFile } from '../../lib/health/parse';
import { activityToRow, observationToRow, rowToActivity, rowToObservation, scheduledToRow, sessionToPayload, versionToPayload } from '../../lib/sync/mappers';
import { EMPTY_DATA, type WorkoutData } from '../../lib/workout/state';
import { openDatabase, plain, readMigration, rejects, type Harness } from './harness';

const ATHLETE = 'a6000000-0000-4000-8000-000000000001';
const COACH = 'c6000000-0000-4000-8000-000000000002';
const STRANGER = 'd6000000-0000-4000-8000-000000000003';
const NOW = Date.now() - 3_600_000;

let h: Harness;

function fitRide(start: number): Uint8Array {
  const encoder = new Encoder();
  const onMesg = (num: number, fields: Record<string, unknown>) => encoder.onMesg(num, fields as Parameters<Encoder['onMesg']>[1]);
  onMesg(Profile.MesgNum.FILE_ID, { manufacturer: 'development', product: 1, timeCreated: new Date(start), type: 'activity' });
  for (let i = 0; i <= 30; i++) onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(start + i * 10_000), heartRate: 140, distance: i * 80 });
  onMesg(Profile.MesgNum.SESSION, { timestamp: new Date(start + 300_000), startTime: new Date(start), sport: 'cycling', totalElapsedTime: 300, totalTimerTime: 300, totalDistance: 2400, avgHeartRate: 140, maxHeartRate: 140 });
  return encoder.close();
}

async function upsert(table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const values = Object.values(row).map((v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v));
  await h.db.query(
    `insert into ${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     on conflict (id) do update set ${cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')}`,
    values
  );
}

/** What PostgREST would hand the app: timestamps as ISO strings. */
function asApi(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? (k === 'local_date' ? v.toISOString().slice(0, 10) : v.toISOString()) : v;
  return out;
}

async function seed(): Promise<{ data: WorkoutData; activityId: string; observationId: string }> {
  const parsed = parseActivityFile(fitRide(NOW - 86_400_000), 'ride.fit');
  assert.ok(parsed.ok);
  const imported = importActivity(EMPTY_DATA, parsed.activity, NOW);
  const logged = logActivityAsWorkout(imported.data, imported.activityId, NOW);
  const obs = addObservation(logged, { metric: 'hrv_ms', value: 62, unit: 'ms', observedAt: NOW - 7_200_000, method: 'rmssd' }, NOW);
  return { data: obs.data, activityId: imported.activityId, observationId: obs.observationId };
}

describe('health data migration', () => {
  let seeded: Awaited<ReturnType<typeof seed>>;

  before(async () => {
    h = await openDatabase();
    await h.addUser(ATHLETE, 'athlete@example.com');
    await h.addUser(COACH, 'coach@example.com');
    await h.addUser(STRANGER, 'stranger@example.com');
    seeded = await seed();
  });

  it('can be run a second time without error', async () => {
    await h.db.exec(readMigration('migrations/0006_health_data.sql'));
  });

  it('stores an activity, the workout it became and a measurement, and reads them back unchanged', async () => {
    const { data, activityId, observationId } = seeded;
    const activity = data.activities[activityId];
    const session = data.sessions[activity.sessionId as string];
    await h.as(ATHLETE, async () => {
      const version = data.versions[session.versionId];
      await h.rpc('save_workout_version', versionToPayload(data.workouts[version.workoutId], version));
      await upsert('scheduled_workouts', scheduledToRow(data.scheduled[session.scheduledWorkoutId as string], ATHLETE));
      await h.rpc('save_session', sessionToPayload(session));
      await upsert('external_activities', activityToRow(activity, ATHLETE));
      await upsert('external_activities', activityToRow(activity, ATHLETE)); // a retried upload
      await upsert('health_observations', observationToRow(data.observations[observationId], ATHLETE));

      const a = (await h.db.query<Record<string, unknown>>('select * from external_activities')).rows;
      assert.equal(a.length, 1);
      assert.deepEqual(plain(rowToActivity(asApi(a[0]) as never)), plain(activity));
      const o = (await h.db.query<Record<string, unknown>>('select * from health_observations')).rows[0];
      assert.deepEqual(plain(rowToObservation(asApi(o) as never)), plain(data.observations[observationId]));
      const s = (await h.db.query<{ entry_mode: string }>('select entry_mode from sessions')).rows[0];
      assert.equal(s.entry_mode, 'import');
    });
  });

  it('refuses a second copy of the same recording under a new id', async () => {
    const activity = seeded.data.activities[seeded.activityId];
    await h.as(ATHLETE, () => rejects(upsert('external_activities', { ...activityToRow(activity, ATHLETE), id: 'a6000000-0000-4000-8000-0000000000ff' }), /duplicate key|unique/));
  });

  it('rejects HRV without its method and values outside physical limits', async () => {
    const base = observationToRow(seeded.data.observations[seeded.observationId], ATHLETE);
    await h.as(ATHLETE, async () => {
      await rejects(upsert('health_observations', { ...base, id: 'a6000000-0000-4000-8000-0000000000a1', method: null }), /check constraint/);
      const activity = activityToRow(seeded.data.activities[seeded.activityId], ATHLETE);
      await rejects(upsert('external_activities', { ...activity, id: 'a6000000-0000-4000-8000-0000000000a2', external_id: 'x', avg_heart_rate: 400 }), /check constraint/);
    });
  });

  it('keeps every athlete’s health data to themselves', async () => {
    await h.as(STRANGER, async () => {
      assert.equal(await h.count('external_activities'), 0);
      assert.equal(await h.count('health_observations'), 0);
      await upsert('health_observations', { ...observationToRow(seeded.data.observations[seeded.observationId], ATHLETE), id: 'a6000000-0000-4000-8000-0000000000b1' })
        .then(() => assert.fail('wrote a row for someone else'), (err: Error) => assert.match(err.message, /row-level security/));
      await h.db.query('update health_observations set value = 1');
      await h.db.query('delete from external_activities');
    });
    assert.equal(await h.count('external_activities'), 1);
    assert.equal(await h.count('health_observations', 'value = 62'), 1);
  });

  it('shares measurements only with consent, without the raw series, and logs the read', async () => {
    const inv = await h.as(ATHLETE, () => h.call<{ relationship_id: string; invite_code: string }>('invite_professional', ['coach@example.com', 'training_coach']));
    await h.as(COACH, () => h.call('accept_relationship_invite', [inv.invite_code]));

    type Shared = { granted: string[]; wearable_raw?: { observations: Record<string, unknown>[]; activities: Record<string, unknown>[] } };
    const before = await h.as(COACH, () => h.call<Shared>('get_shared_context', [ATHLETE], ['uuid']));
    assert.equal(before.wearable_raw, undefined);

    await h.as(ATHLETE, () => h.call('create_grant', [inv.relationship_id, 'wearable_raw', null], ['uuid', 'text', 'timestamptz']));
    const after = await h.as(COACH, () => h.call<Shared>('get_shared_context', [ATHLETE], ['uuid']));
    assert.deepEqual(after.granted, ['wearable_raw']);
    assert.deepEqual(after.wearable_raw?.observations.map((o) => [o.metric, Number(o.value), o.method]), [['hrv_ms', 62, 'rmssd']]);
    const shared = after.wearable_raw?.activities[0] ?? {};
    assert.equal(Number(shared.distance_m), 2400);
    for (const hidden of ['series', 'source', 'user_id', 'external_id']) assert.equal(hidden in shared, false, hidden);
    assert.equal(await h.count('audit_events', `action = 'data.read' and data_category = 'wearable_raw'`), 1);
  });

  it('erases the values when a source is deleted, keeping only a tombstone', async () => {
    const activity = seeded.data.activities[seeded.activityId];
    const obs = seeded.data.observations[seeded.observationId];
    const later = NOW + 60_000;
    await h.as(ATHLETE, async () => {
      await upsert('external_activities', activityToRow({ ...activity, series: undefined, deletedAt: later, updatedAt: later }, ATHLETE));
      await upsert('health_observations', observationToRow({ ...obs, deletedAt: later, updatedAt: later }, ATHLETE));
    });
    const a = (await h.db.query<Record<string, unknown>>('select series, source, name, deleted_at from external_activities where id = $1', [activity.id])).rows[0];
    assert.deepEqual([a.series, a.source, a.name], [null, { format: 'fit' }, null]);
    const o = (await h.db.query<Record<string, unknown>>('select value, device from health_observations where id = $1', [obs.id])).rows[0];
    assert.deepEqual([o.value, o.device], [null, null]);
    // The workout result recorded from the activity stays.
    assert.equal(await h.count('sessions', `status = 'completed' and deleted_at is null`), 1);
  });

  it('includes health data in the export', async () => {
    const fresh = addObservation(EMPTY_DATA, { metric: 'weight_kg', value: 71.5, unit: 'kg', observedAt: NOW }, NOW);
    await h.as(ATHLETE, () => upsert('health_observations', observationToRow(fresh.data.observations[fresh.observationId], ATHLETE)));
    const exported = await h.as(ATHLETE, () => h.call<{ health: { observations: { metric: string }[]; activities: unknown[] } }>('export_my_data'));
    assert.deepEqual(exported.health.observations.map((o) => o.metric), ['weight_kg'], 'deleted rows are not exported');
    assert.deepEqual(exported.health.activities, []);
  });
});
