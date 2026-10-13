/**
 * Access and lifecycle tests for AI proposals (roadmap Step 3). Rows are
 * inserted as the superuser, standing in for the edge function's service
 * role; everything else acts as a signed-in athlete.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { newUuid } from '../../lib/id';
import { scheduledToRow, versionToPayload } from '../../lib/sync/mappers';
import type { WorkoutContent } from '../../lib/workout/model';
import { EMPTY_DATA, createWorkout, reviseWorkout } from '../../lib/workout/state';
import { validateWorkout } from '../../lib/workout/validate';
import { openDatabase, readMigration, rejects, type Harness } from './harness';

const ALICE = 'a1000000-0000-4000-8000-000000000001';
const BOB = 'b1000000-0000-4000-8000-000000000002';
const NOW = Date.now() - 60_000;

let h: Harness;

const workout = (title: string): WorkoutContent => ({
  title,
  sport: 'crossfit',
  blocks: [{ id: newUuid(), type: 'conditioning', config: { format: 'amrap', durationSeconds: 600 }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Burpee', activityId: 'burpee', prescription: { reps: 10 } }] }],
});

async function insertProposal(userId: string, fields: Record<string, unknown> = {}): Promise<string> {
  const content = workout('Draft');
  const row = {
    user_id: userId,
    type: 'workout_import',
    source: { kind: 'text', text: 'AMRAP 10: 10 burpees' },
    content,
    validation: validateWorkout(content),
    ...fields,
  };
  const cols = Object.keys(row);
  const res = await h.db.query<{ id: string }>(
    `insert into agent_proposals (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    Object.values(row).map((v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v))
  );
  return res.rows[0].id;
}

const decide = (id: string, decision: string, workoutId: string | null = null) =>
  h.call('decide_proposal', [id, decision, workoutId], ['uuid', 'text', 'uuid']);

const statusOf = async (id: string) => (await h.db.query<{ status: string }>('select status from agent_proposals where id = $1', [id])).rows[0].status;

describe('AI proposals migration', () => {
  before(async () => {
    h = await openDatabase();
    await h.addUser(ALICE, 'alice@example.com');
    await h.addUser(BOB, 'bob@example.com');
  });

  it('can be run a second time without error', async () => {
    await h.db.exec(readMigration('migrations/0005_ai_proposals.sql'));
  });

  it('lets an athlete read their own proposals and runs, and nobody else’s', async () => {
    const id = await insertProposal(ALICE);
    await h.db.query(`insert into agent_runs (user_id, workflow, status) values ($1, 'workout_import', 'succeeded')`, [ALICE]);
    await h.as(ALICE, async () => {
      assert.equal(await h.count('agent_proposals'), 1);
      assert.equal(await h.count('agent_runs'), 1);
    });
    await h.as(BOB, async () => {
      assert.equal(await h.count('agent_proposals'), 0);
      assert.equal(await h.count('agent_runs'), 0);
      await rejects(decide(id, 'approved'), /FORBIDDEN/);
    });
    await h.as(null, () => rejects(decide(id, 'approved'), /permission denied/));
  });

  it('does not let a client create or edit a proposal or a run', async () => {
    const id = await insertProposal(ALICE);
    await h.as(ALICE, async () => {
      await rejects(h.db.query(`insert into agent_proposals (user_id, type, source, content, validation) values ($1, 'workout_import', '{}', '{}', '{"valid":true}')`, [ALICE]), /permission denied/);
      await rejects(h.db.query(`update agent_proposals set status = 'approved' where id = $1`, [id]), /permission denied/);
      await rejects(h.db.query(`update agent_proposals set validation = '{"valid":true}' where id = $1`, [id]), /permission denied/);
      await rejects(h.db.query(`insert into agent_runs (user_id, workflow, status) values ($1, 'workout_import', 'succeeded')`, [ALICE]), /permission denied/);
      await rejects(h.db.query(`delete from agent_runs`), /permission denied/);
    });
  });

  it('approves once, records it, and refuses a second decision', async () => {
    const id = await insertProposal(ALICE);
    const workoutId = newUuid();
    await h.as(ALICE, () => decide(id, 'approved', workoutId));
    assert.equal(await statusOf(id), 'approved');
    assert.equal(await h.count('agent_proposals', 'id = $1 and result_workout_id = $2 and decided_at is not null', [id, workoutId]), 1);
    assert.equal(await h.count('audit_events', `action = 'proposal.approved' and entity_id = $1`, [id]), 1);
    assert.equal(await h.count('domain_events', `event_type = 'AgentProposalApproved' and entity_id = $1`, [id]), 1);
    assert.equal(await h.count('domain_events', `event_type = 'AgentProposalCreated' and entity_id = $1`, [id]), 1);
    await h.as(ALICE, async () => {
      await rejects(decide(id, 'rejected'), /PROPOSAL_ALREADY_DECIDED/);
      await rejects(decide(id, 'approved'), /PROPOSAL_ALREADY_DECIDED/);
    });
  });

  it('rejects, and only accepts the two real decisions', async () => {
    const id = await insertProposal(ALICE);
    await h.as(ALICE, async () => {
      await rejects(decide(id, 'maybe'), /INVALID_DECISION/);
      await decide(id, 'rejected');
    });
    assert.equal(await statusOf(id), 'rejected');
    assert.equal(await h.count('domain_events', `event_type = 'AgentProposalRejected' and entity_id = $1`, [id]), 1);
  });

  it('will not approve a draft the validator rejected, or one that has expired', async () => {
    const broken = workout('Broken');
    broken.blocks[0].config = { format: 'amrap' };
    const invalid = await insertProposal(ALICE, { content: broken, validation: validateWorkout(broken) });
    const expired = await insertProposal(ALICE, { expires_at: new Date(Date.now() - 1000).toISOString() });
    await h.as(ALICE, async () => {
      await rejects(decide(invalid, 'approved'), /PROPOSAL_INVALID/);
      await rejects(decide(expired, 'approved'), /PROPOSAL_EXPIRED/);
      // Both can still be dismissed.
      await decide(invalid, 'rejected');
      await decide(expired, 'rejected');
    });
  });

  it('marks the previous draft superseded when a revision of it arrives', async () => {
    const first = await insertProposal(ALICE);
    const second = await insertProposal(ALICE, { parent_proposal_id: first });
    assert.deepEqual([await statusOf(first), await statusOf(second)], ['superseded', 'pending_approval']);
    await h.as(ALICE, () => rejects(decide(first, 'approved'), /PROPOSAL_ALREADY_DECIDED/));
  });

  it('will not approve an adaptation of a workout that has changed since, or that is someone else’s', async () => {
    const created = createWorkout(EMPTY_DATA, workout('Planned'), { source: 'manual', scheduledAt: NOW, nowMs: NOW });
    const entry = created.data.scheduled[created.scheduledId as string];
    await h.as(ALICE, async () => {
      await h.rpc('save_workout_version', versionToPayload(created.data.workouts[created.workoutId], created.data.versions[created.versionId]));
      const row = scheduledToRow(entry, ALICE);
      const cols = Object.keys(row);
      await h.db.query(`insert into scheduled_workouts (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(row));
    });
    const source = { kind: 'workout', scheduled_id: entry.id, workout_id: entry.workoutId, version_id: entry.versionId };

    // Bob holds a proposal that points at Alice's schedule entry: it must not be approvable.
    const bobs = await insertProposal(BOB, { type: 'workout_adaptation', source });
    await h.as(BOB, () => rejects(decide(bobs, 'approved'), /PROPOSAL_STALE/));

    const current = await insertProposal(ALICE, { type: 'workout_adaptation', source });
    const stale = await insertProposal(ALICE, { type: 'workout_adaptation', source });

    // Approving the first moves the entry to a new version, as the app does on approval.
    await h.as(ALICE, () => decide(current, 'approved', entry.workoutId));
    const revised = reviseWorkout(created.data, created.workoutId, workout('Planned'), NOW + 1);
    await h.as(ALICE, async () => {
      await h.rpc('save_workout_version', versionToPayload(revised.data.workouts[created.workoutId], revised.data.versions[revised.versionId]));
      await h.db.query('update scheduled_workouts set version_id = $1, updated_at = now() where id = $2', [revised.versionId, entry.id]);
      await rejects(decide(stale, 'approved'), /PROPOSAL_STALE/);
    });
  });

  it('includes proposals and runs in the data export, and removes them with the account', async () => {
    const doc = await h.as(ALICE, () => h.call<Record<string, any>>('export_my_data'));
    assert.ok(doc.assistant.proposals.length >= 5);
    assert.equal(doc.assistant.runs.length, 1);
    assert.equal(doc.assistant.proposals.every((p: { user_id: string }) => p.user_id === ALICE), true);

    await h.as(ALICE, () => h.call('delete_my_account'));
    assert.equal(await h.count('agent_proposals', 'user_id = $1', [ALICE]), 0);
    assert.equal(await h.count('agent_runs', 'user_id = $1', [ALICE]), 0);
  });
});
