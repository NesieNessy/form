/**
 * Access requests (roadmap Step 14): a connected professional can ask for a
 * category; the athlete is notified, nothing is shared, and asking again is
 * held off for a week.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { openDatabase, readMigration, rejects, type Harness } from './harness';

const ATHLETE = 'a7000000-0000-4000-8000-0000000000a1';
const COACH = 'a7000000-0000-4000-8000-0000000000c1';
const STRANGER = 'a7000000-0000-4000-8000-0000000000d1';

let h: Harness;
const call = <T>(user: string, fn: string, args: unknown[] = [], casts: string[] = []) => h.as(user, () => h.call<T>(fn, args, casts));

describe('access requests migration', () => {
  let rel: string;

  before(async () => {
    h = await openDatabase();
    for (const [id, email] of [[ATHLETE, 'athlete@example.com'], [COACH, 'coach@example.com'], [STRANGER, 'stranger@example.com']]) await h.addUser(id, email);
    const inv = await call<{ relationship_id: string; invite_code: string }>(ATHLETE, 'invite_professional', ['coach@example.com', 'training_coach']);
    await call(COACH, 'accept_relationship_invite', [inv.invite_code]);
    rel = inv.relationship_id;
  });

  it('can be run a second time without error', async () => {
    await h.db.exec(readMigration('migrations/0016_access_requests.sql'));
  });

  it('notifies the athlete and shares nothing', async () => {
    await call(COACH, 'request_data_access', [rel, 'workout_session'], ['uuid', 'text']);
    assert.equal(await h.count('notifications', `user_id = $1 and title like '%asks to see: Session results'`, [ATHLETE]), 1);
    assert.equal(await h.count('data_share_grants', 'relationship_id = $1', [rel]), 0);
    assert.equal(await h.count('audit_events', `action = 'access.requested' and subject_athlete_id = $1`, [ATHLETE]), 1);
  });

  it('refuses repeats, strangers, the athlete themself, shared and unavailable categories', async () => {
    await rejects(call(COACH, 'request_data_access', [rel, 'workout_session'], ['uuid', 'text']), /REQUESTED_RECENTLY/);
    await rejects(call(STRANGER, 'request_data_access', [rel, 'benchmarks'], ['uuid', 'text']), /FORBIDDEN/);
    await rejects(call(ATHLETE, 'request_data_access', [rel, 'benchmarks'], ['uuid', 'text']), /FORBIDDEN/);
    await call(ATHLETE, 'create_grant', [rel, 'benchmarks', null], ['uuid', 'text', 'timestamptz']);
    await rejects(call(COACH, 'request_data_access', [rel, 'benchmarks'], ['uuid', 'text']), /ALREADY_SHARED/);
    await rejects(call(COACH, 'request_data_access', [rel, 'communications'], ['uuid', 'text']), /CATEGORY_NOT_AVAILABLE/);
    await h.as(STRANGER, async () => assert.equal(await h.count('access_requests'), 0));
    await h.as(ATHLETE, async () => assert.equal(await h.count('access_requests'), 1));
  });
});
