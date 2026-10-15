/**
 * Storage and sharing tests for recovery (roadmap Step 7): the check-in
 * metrics, one summary per day, and the coach's view that never contains
 * measured values or the check-in itself.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { addObservation } from '../../lib/health/state';
import { newUuid } from '../../lib/id';
import type { RecoveryDay } from '../../lib/recovery/model';
import { observationToRow, recoveryToRow, rowToRecovery } from '../../lib/sync/mappers';
import { EMPTY_DATA } from '../../lib/workout/state';
import { openDatabase, plain, readMigration, rejects, type Harness } from './harness';

const ATHLETE = 'a1000000-0000-4000-8000-0000000000a1';
const COACH = 'c1000000-0000-4000-8000-0000000000c1';
const STRANGER = 'd1000000-0000-4000-8000-0000000000d1';
const NOW = Date.now() - 3_600_000;

let h: Harness;

async function insert(table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const values = Object.values(row).map((v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v));
  await h.db.query(`insert into ${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, values);
}

const today = (() => {
  const d = new Date(NOW);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const day = (patch: Partial<RecoveryDay> = {}): RecoveryDay => ({
  id: newUuid(),
  localDate: today,
  status: 'attention',
  signals: [
    { key: 'resting_hr', direction: 'worse' },
    { key: 'fatigue', direction: 'worse' },
  ],
  ruleVersion: 'recovery_v1',
  decision: { option: 'lighter', scheduledId: newUuid(), decidedAt: NOW },
  createdAt: NOW,
  updatedAt: NOW,
  ...patch,
});

describe('recovery migration', () => {
  let summary: RecoveryDay;

  before(async () => {
    h = await openDatabase();
    await h.addUser(ATHLETE, 'athlete@example.com');
    await h.addUser(COACH, 'coach@example.com');
    await h.addUser(STRANGER, 'stranger@example.com');
  });

  it('can be run a second time without error', async () => {
    await h.db.exec(readMigration('migrations/0010_recovery.sql'));
  });

  it('stores the check-in as measurements, including the new ones', async () => {
    let data = EMPTY_DATA;
    for (const [metric, value] of [['subjective_stress', 6], ['subjective_energy', 3], ['unwell', 0], ['resting_hr_bpm', 58]] as const) {
      data = addObservation(data, { metric, value, unit: metric === 'resting_hr_bpm' ? 'bpm' : '', observedAt: NOW }, NOW).data;
    }
    await h.as(ATHLETE, async () => {
      for (const o of Object.values(data.observations)) await insert('health_observations', observationToRow(o, ATHLETE));
    });
    assert.equal(await h.count('health_observations', `user_id = $1`, [ATHLETE]), 4);
  });

  it('keeps one summary per day and reads it back unchanged', async () => {
    summary = day();
    await h.as(ATHLETE, async () => {
      await insert('daily_recovery', recoveryToRow(summary, ATHLETE));
      await rejects(insert('daily_recovery', recoveryToRow(day(), ATHLETE)), /duplicate key/);
      await rejects(insert('daily_recovery', recoveryToRow(day({ localDate: '2026-01-01', decision: { option: 'push_harder' as never, decidedAt: NOW } }), ATHLETE)), /check constraint/);
      const row = (await h.db.query<Record<string, unknown>>('select * from daily_recovery')).rows[0];
      const api = { ...row, local_date: today, created_at: (row.created_at as Date).toISOString(), updated_at: (row.updated_at as Date).toISOString() };
      assert.deepEqual(plain(rowToRecovery(api as never)), plain(summary));
    });
    await h.as(STRANGER, async () => assert.equal(await h.count('daily_recovery'), 0));
  });

  it('shares only the summary, only with consent, never values or the check-in', async () => {
    const inv = await h.as(ATHLETE, () => h.call<{ relationship_id: string; invite_code: string }>('invite_professional', ['coach@example.com', 'training_coach']));
    await h.as(COACH, () => h.call('accept_relationship_invite', [inv.invite_code]));
    type Shared = { granted: string[]; recovery_summary?: Record<string, unknown>[]; wearable_raw?: unknown };
    const shared = () => h.as(COACH, () => h.call<Shared>('get_shared_context', [ATHLETE], ['uuid']));

    assert.equal((await shared()).recovery_summary, undefined);
    await h.as(ATHLETE, () => h.call('create_grant', [inv.relationship_id, 'recovery_summary', null], ['uuid', 'text', 'timestamptz']));
    const s = await shared();
    assert.deepEqual(s.granted, ['recovery_summary']);
    assert.equal(s.wearable_raw, undefined, 'raw readings need their own grant');
    const [row] = s.recovery_summary ?? [];
    assert.deepEqual([row.status, row.choice, row.signals], ['attention', 'lighter', summary.signals]);
    // Only status, signal directions and the choice: no values, units, metrics or plan references.
    assert.deepEqual(Object.keys(row).sort(), ['choice', 'local_date', 'rule_version', 'signals', 'status']);
    const text = JSON.stringify(s);
    for (const leak of ['"value"', 'bpm', 'subjective', 'scheduledId', 'detail']) assert.equal(text.includes(leak), false, leak);
    assert.equal(await h.count('audit_events', `action = 'data.read' and data_category = 'recovery_summary'`), 1);
  });

  it('includes the summaries in the export', async () => {
    const exported = await h.as(ATHLETE, () => h.call<{ recovery: unknown[] }>('export_my_data'));
    assert.equal(exported.recovery.length, 1);
  });
});
