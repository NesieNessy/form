/**
 * Access and lifecycle tests for the coach beta (roadmap Step 6): invites
 * from the coach's side, assignments pinned to one version, decisions,
 * comments, outcome review within grants, the roster, and ending the
 * relationship. Most tests check what a user can NOT do.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { newUuid } from '../../lib/id';
import { rowToVersion, scheduledToRow, sessionToPayload, versionToPayload, type VersionRow } from '../../lib/sync/mappers';
import { withFreshIds, type WorkoutContent } from '../../lib/workout/model';
import { EMPTY_DATA, completeSession, createWorkout, reviseWorkout, startSession, type WorkoutData } from '../../lib/workout/state';
import { openDatabase, plain, readMigration, rejects, type Harness } from './harness';

const ATHLETE = 'a9000000-0000-4000-8000-000000000001';
const COACH = 'c9000000-0000-4000-8000-000000000002';
const OTHER_COACH = 'c9000000-0000-4000-8000-000000000003';
const DIETITIAN = 'e9000000-0000-4000-8000-000000000004';
const STRANGER = 'd9000000-0000-4000-8000-000000000005';
const NOW = Date.now();

let h: Harness;

type Invite = { relationship_id: string; invite_code: string };
type Rel = { id: string; role: string; status: string; invited_by: string; invite_code: string | null; counterpart_name: string; grants: unknown[] };
type Assignment = { id: string; role: string; title: string; status: string; version: VersionRow; message: string | null; athlete_scheduled_id: string | null; comments: { body: string; by_me: boolean }[] };

const plan = (title: string, reps = 5): WorkoutContent => ({
  title,
  sport: 'strength',
  blocks: [{ id: newUuid(), type: 'strength', config: { format: 'sets_reps', sets: 3 }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Deadlift', activityId: 'deadlift', prescription: { reps } }] }],
});

async function insert(table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  await h.db.query(`insert into ${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(row));
}

/** Saves a user's local workout to the server the way sync does. */
async function upload(userId: string, data: WorkoutData, workoutId: string, versionId: string, scheduledId?: string) {
  await h.as(userId, async () => {
    await h.rpc('save_workout_version', versionToPayload(data.workouts[workoutId], data.versions[versionId]));
    if (scheduledId) await insert('scheduled_workouts', scheduledToRow(data.scheduled[scheduledId], userId));
  });
}

const call = <T>(user: string, fn: string, args: unknown[] = [], casts: string[] = []) => h.as(user, () => h.call<T>(fn, args, casts));
const relationships = (user: string) => call<Rel[]>(user, 'list_relationships');
const assignments = (user: string) => call<Assignment[]>(user, 'list_assignments');
const assign = (user: string, rel: string, version: string, when = new Date(NOW + 86_400_000).toISOString(), message: string | null = null) =>
  call<string>(user, 'assign_workout', [rel, version, when, message], ['uuid', 'uuid', 'timestamptz', 'text']);
const grant = (rel: string, category: string) => call(ATHLETE, 'create_grant', [rel, category, null], ['uuid', 'text', 'timestamptz']);

describe('coach beta migration', () => {
  let relId: string;
  let coachData: WorkoutData;
  let coachWorkoutId: string;
  let coachVersionId: string;
  let assignmentId: string;

  before(async () => {
    h = await openDatabase();
    for (const [id, email] of [
      [ATHLETE, 'athlete@example.com'],
      [COACH, 'coach@example.com'],
      [OTHER_COACH, 'other.coach@example.com'],
      [DIETITIAN, 'dietitian@example.com'],
      [STRANGER, 'stranger@example.com'],
    ]) await h.addUser(id, email);
    const created = createWorkout(EMPTY_DATA, plan('Pull Day'), { source: 'manual', isTemplate: true, nowMs: NOW });
    coachData = created.data;
    coachWorkoutId = created.workoutId;
    coachVersionId = created.versionId;
    await upload(COACH, coachData, coachWorkoutId, coachVersionId);
  });

  it('can be run a second time without error', async () => {
    await h.db.exec(readMigration('migrations/0009_coach_beta.sql'));
  });

  it('lets a coach invite an athlete; only the invited address can accept, and nothing is shared yet', async () => {
    const inv = await call<Invite>(COACH, 'invite_athlete', ['athlete@example.com', 'training_coach']);
    relId = inv.relationship_id;
    await rejects(call(COACH, 'invite_athlete', ['ATHLETE@example.com', 'training_coach']), /ALREADY_INVITED/);
    await rejects(call(COACH, 'invite_athlete', ['coach@example.com', 'training_coach']), /CANNOT_INVITE_YOURSELF/);

    const coachView = (await relationships(COACH)).find((r) => r.id === relId);
    assert.deepEqual([coachView?.role, coachView?.invited_by, coachView?.invite_code], ['professional', 'professional', inv.invite_code]);

    await rejects(call(STRANGER, 'accept_relationship_invite', [inv.invite_code]), /INVITE_NOT_VALID/);
    await rejects(call(COACH, 'accept_relationship_invite', [inv.invite_code]), /INVITE_NOT_VALID/);
    await call(ATHLETE, 'accept_relationship_invite', [inv.invite_code]);

    const athleteView = (await relationships(ATHLETE)).find((r) => r.id === relId);
    assert.deepEqual([athleteView?.role, athleteView?.status, athleteView?.invite_code, athleteView?.grants], ['athlete', 'active', null, []]);
    assert.equal(await h.count('notifications', `user_id = $1 and title = 'Invitation accepted'`, [COACH]), 1);
  });

  it('still supports the athlete inviting a professional', async () => {
    const inv = await call<Invite>(ATHLETE, 'invite_professional', ['dietitian@example.com', 'dietitian']);
    await call(DIETITIAN, 'accept_relationship_invite', [inv.invite_code]);
    assert.equal((await relationships(DIETITIAN))[0].role, 'professional');
  });

  it('only a coach in an active relationship can assign, and only their own published version', async () => {
    const dietRel = (await relationships(DIETITIAN))[0].id;
    const dietWorkout = createWorkout(EMPTY_DATA, plan('Diet day'), { source: 'manual', nowMs: NOW });
    await upload(DIETITIAN, dietWorkout.data, dietWorkout.workoutId, dietWorkout.versionId);
    await rejects(assign(DIETITIAN, dietRel, dietWorkout.versionId), /ONLY_COACHES_ASSIGN/);
    await rejects(assign(OTHER_COACH, relId, coachVersionId), /FORBIDDEN/);
    await rejects(assign(COACH, relId, dietWorkout.versionId), /VERSION_NOT_FOUND/);
    await rejects(assign(COACH, relId, coachVersionId, new Date(NOW - 3 * 86_400_000).toISOString()), /DATE_IN_PAST/);
    await rejects(h.as(COACH, () => insert('workout_assignments', { relationship_id: relId, coach_id: COACH, athlete_id: ATHLETE, version_snapshot: '{}', title: 'x', scheduled_for: new Date().toISOString() })), /permission denied|row-level security/);

    assignmentId = await assign(COACH, relId, coachVersionId, undefined, 'Keep the bar close.');
    assert.equal(await h.count('notifications', `user_id = $1 and title like 'New workout from%'`, [ATHLETE]), 1);
  });

  it('pins the assignment to the version as it was: later edits by the coach do not change it', async () => {
    const revised = reviseWorkout(coachData, coachWorkoutId, plan('Pull Day', 3), NOW + 1000);
    await upload(COACH, revised.data, coachWorkoutId, revised.versionId);
    const [a] = await assignments(ATHLETE);
    assert.equal(a.role, 'athlete');
    assert.equal(a.message, 'Keep the bar close.');
    const content = rowToVersion(a.version).content;
    assert.deepEqual(plain(content), plain(coachData.versions[coachVersionId].content));
  });

  it('keeps assignments between the two people involved', async () => {
    assert.deepEqual(await assignments(OTHER_COACH), []);
    assert.deepEqual(await assignments(STRANGER), []);
    await h.as(OTHER_COACH, async () => assert.equal(await h.count('workout_assignments'), 0));
    await rejects(call(STRANGER, 'decide_assignment', [assignmentId, 'accepted', newUuid()], ['uuid', 'text', 'uuid']), /FORBIDDEN/);
    await rejects(call(COACH, 'decide_assignment', [assignmentId, 'accepted', newUuid()], ['uuid', 'text', 'uuid']), /FORBIDDEN/);
    await rejects(call(STRANGER, 'add_assignment_comment', [assignmentId, 'hi']), /FORBIDDEN/);
    await rejects(call(OTHER_COACH, 'get_assignment_outcomes', [ATHLETE], ['uuid']), /FORBIDDEN/);
  });

  let athleteData: WorkoutData;
  let athleteScheduled: string;

  it('the athlete accepts by adding it to their own calendar', async () => {
    const [a] = await assignments(ATHLETE);
    // Copied content gets fresh ids: block and step ids are unique across users.
    const verbatim = createWorkout(EMPTY_DATA, rowToVersion(a.version).content, { source: 'coach', nowMs: NOW });
    await rejects(upload(ATHLETE, verbatim.data, verbatim.workoutId, verbatim.versionId), /duplicate key/);
    const created = createWorkout(EMPTY_DATA, withFreshIds(rowToVersion(a.version).content, newUuid), { source: 'coach', scheduledAt: NOW + 86_400_000, nowMs: NOW });
    athleteData = created.data;
    athleteScheduled = created.scheduledId as string;
    await upload(ATHLETE, athleteData, created.workoutId, created.versionId, athleteScheduled);
    await rejects(call(ATHLETE, 'decide_assignment', [a.id, 'accepted', null], ['uuid', 'text', 'uuid']), /SCHEDULE_REQUIRED/);
    await call(ATHLETE, 'decide_assignment', [a.id, 'accepted', athleteScheduled], ['uuid', 'text', 'uuid']);
    await rejects(call(ATHLETE, 'decide_assignment', [a.id, 'declined', null], ['uuid', 'text', 'uuid']), /ASSIGNMENT_ALREADY_DECIDED/);
    await rejects(call(COACH, 'cancel_assignment', [a.id], ['uuid']), /ASSIGNMENT_ALREADY_DECIDED/);
    const [after] = await assignments(COACH);
    assert.deepEqual([after.role, after.status, after.athlete_scheduled_id], ['coach', 'accepted', athleteScheduled]);
    assert.equal(await h.count('workouts', `user_id = $1 and source = 'coach'`, [ATHLETE]), 1);
  });

  it('shows the coach how it went only within what the athlete shares, and logs each read', async () => {
    const started = startSession(athleteData, athleteScheduled, 'manual', NOW + 86_400_000);
    assert.ok('sessionId' in started);
    const done = completeSession(started.data, started.sessionId, { rpe: 8 }, NOW + 86_400_000 + 1000);
    await h.as(ATHLETE, async () => {
      await h.rpc('save_session', sessionToPayload(done.sessions[started.sessionId]));
      await h.db.query(`update scheduled_workouts set status = 'completed', session_id = $1 where id = $2`, [started.sessionId, athleteScheduled]);
    });

    type Outcomes = { plan_shared: boolean; sessions_shared: boolean; outcomes: { scheduled_status: string | null; session: { rpe: number } | null }[] };
    const none = await call<Outcomes>(COACH, 'get_assignment_outcomes', [ATHLETE], ['uuid']);
    assert.deepEqual([none.plan_shared, none.sessions_shared, none.outcomes[0].scheduled_status, none.outcomes[0].session], [false, false, null, null]);
    assert.equal(await h.count('audit_events', `actor_user_id = $1 and action = 'data.read'`, [COACH]), 0, 'nothing was read');

    await grant(relId, 'workout_plan');
    await grant(relId, 'workout_session');
    const both = await call<Outcomes>(COACH, 'get_assignment_outcomes', [ATHLETE], ['uuid']);
    assert.deepEqual([both.outcomes[0].scheduled_status, Number(both.outcomes[0].session?.rpe)], ['completed', 8]);
    assert.equal(await h.count('audit_events', `actor_user_id = $1 and action = 'data.read' and data_category in ('workout_plan', 'workout_session')`, [COACH]), 2);
  });

  it('lets both sides comment', async () => {
    await call(ATHLETE, 'add_assignment_comment', [assignmentId, 'Grip gave out on set 3.']);
    await call(COACH, 'add_assignment_comment', [assignmentId, 'Use straps next time.']);
    await rejects(call(COACH, 'add_assignment_comment', [assignmentId, '   ']), /INVALID_COMMENT/);
    const [a] = await assignments(ATHLETE);
    assert.deepEqual(a.comments.map((c) => [c.body, c.by_me]), [['Grip gave out on set 3.', true], ['Use straps next time.', false]]);
  });

  it('gives the coach a roster, with the summary only when it is shared', async () => {
    type Row = { athlete_id: string; granted: string[]; pending_assignments: number; summary: { sessions_28d: number } | null };
    const pending = await assign(COACH, relId, coachVersionId);
    let [row] = await call<Row[]>(COACH, 'coach_roster');
    assert.deepEqual([row.athlete_id, row.granted, Number(row.pending_assignments), row.summary], [ATHLETE, ['workout_plan', 'workout_session'], 1, null]);
    await grant(relId, 'performance_summary');
    [row] = await call<Row[]>(COACH, 'coach_roster');
    assert.equal(Number(row.summary?.sessions_28d), 1);
    assert.deepEqual(await call(STRANGER, 'coach_roster'), []);
    assert.ok(pending);
  });

  it('ending the relationship cancels what is pending and closes everything to the coach', async () => {
    await call(ATHLETE, 'end_relationship', [relId], ['uuid']);
    assert.equal(await h.count('workout_assignments', `relationship_id = $1 and status = 'cancelled'`, [relId]), 1);
    assert.deepEqual(await assignments(COACH), []);
    await h.as(COACH, async () => {
      assert.equal(await h.count('workout_assignments'), 0);
      assert.equal(await h.count('assignment_comments'), 0);
    });
    await rejects(call(COACH, 'get_assignment_outcomes', [ATHLETE], ['uuid']), /FORBIDDEN/);
    await rejects(call(COACH, 'add_assignment_comment', [assignmentId, 'still there?']), /RELATIONSHIP_ENDED/);
    await rejects(assign(COACH, relId, coachVersionId), /FORBIDDEN/);
    // The athlete keeps their own history, comments included.
    const mine = await assignments(ATHLETE);
    assert.equal(mine.length, 2);
    assert.equal(mine.find((a) => a.id === assignmentId)?.comments.length, 2);
    const exported = await call<{ coaching: { assignments: unknown[] } }>(ATHLETE, 'export_my_data');
    assert.equal(exported.coaching.assignments.length, 2);
  });
});
