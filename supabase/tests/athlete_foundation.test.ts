/**
 * Access tests for the sharing model (roadmap Step 2). Each test acts as a
 * signed-in user against the real migrations and checks what that user can
 * and, above all, cannot do.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import type { Benchmark, Profile } from '../../lib/athlete/model';
import { newUuid } from '../../lib/id';
import {
  benchmarkToRow,
  profileToRow,
  rowToBenchmark,
  rowToProfile,
  rowToSession,
  rowToVersion,
  scheduledToRow,
  sessionToPayload,
  versionToPayload,
  type SessionRow,
  type VersionRow,
} from '../../lib/sync/mappers';
import type { WorkoutContent } from '../../lib/workout/model';
import { EMPTY_DATA, completeSession, createWorkout, putBlockResult, startSession } from '../../lib/workout/state';
import { openDatabase, plain, readMigration, rejects, type Harness } from './harness';

const ATHLETE = 'a0000000-0000-4000-8000-000000000001';
const COACH = 'c0000000-0000-4000-8000-000000000002';
const OTHER_COACH = 'c0000000-0000-4000-8000-000000000003';
const STRANGER = 'd0000000-0000-4000-8000-000000000004';
const OTHER_ATHLETE = 'a0000000-0000-4000-8000-000000000005';
const NOW = Date.now() - 60 * 60 * 1000;

/** Every table that holds an athlete's own data. */
const ATHLETE_TABLES = ['profiles', 'benchmarks', 'workouts', 'workout_versions', 'blocks', 'steps', 'scheduled_workouts', 'sessions', 'session_results'];

let h: Harness;

type Invite = { relationship_id: string; invite_code: string; expires_at: string };
type Relationship = {
  id: string;
  role: 'athlete' | 'professional';
  status: string;
  counterpart_name: string;
  invite_code: string | null;
  grants: { id: string; data_category: string }[];
};
type Shared = {
  granted: string[];
  athlete: { id: string; display_name: string };
  profile?: Record<string, unknown>;
  benchmarks?: unknown[];
  workout_plan?: { id: string; status: string; version: VersionRow }[];
  workout_session?: SessionRow[];
  performance_summary?: Record<string, unknown>;
};

const content = (title: string): WorkoutContent => ({
  title,
  sport: 'strength',
  blocks: [
    {
      id: newUuid(),
      type: 'strength',
      config: { format: 'sets_reps', sets: 1 },
      steps: [{ kind: 'exercise', id: newUuid(), name: 'Back Squat', activityId: 'back_squat', prescription: { reps: 5, load: { value: 80, unit: 'kg' } } }],
    },
  ],
});

/** Gives a user a profile, a benchmark, and one completed workout, written the way the app writes them. */
async function seedTraining(userId: string, title: string) {
  const created = createWorkout(EMPTY_DATA, content(title), { source: 'manual', scheduledAt: NOW, nowMs: NOW });
  const started = startSession(created.data, created.scheduledId as string, 'manual', NOW);
  assert.ok('sessionId' in started);
  const block = started.data.sessions[started.sessionId].prescribed.blocks[0];
  const withResult = putBlockResult(started.data, started.sessionId, {
    blockId: block.id,
    status: 'completed',
    score: { type: 'load', kg: 80 },
    stepResults: [{ stepId: block.steps[0].id, setIndex: 0, reps: 5, loadKg: 80, completed: true }],
  }, NOW);
  const data = completeSession(withResult, started.sessionId, { rpe: 7, notes: `${title} felt fine` }, NOW);

  const profile: Profile = { displayName: title, sports: ['strength'], equipment: ['barbell'], availableDays: [1, 3, 5], weeklySessionTarget: 4, updatedAt: NOW };
  const benchmark: Benchmark = { id: newUuid(), kind: 'one_rep_max', activityId: 'back_squat', value: 100, unit: 'kg', measuredOn: '2026-10-01', source: 'manual', createdAt: NOW, updatedAt: NOW };

  await h.as(userId, async () => {
    await h.rpc('save_workout_version', versionToPayload(data.workouts[created.workoutId], data.versions[created.versionId]));
    const row = scheduledToRow(data.scheduled[created.scheduledId as string], userId);
    const cols = Object.keys(row);
    await h.db.query(`insert into scheduled_workouts (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(row));
    await h.rpc('save_session', sessionToPayload(data.sessions[started.sessionId]));
    // Sent twice, as a retried upload would be.
    await h.rpc('save_session', sessionToPayload(data.sessions[started.sessionId]));

    const p = profileToRow(profile, userId);
    const pc = Object.keys(p);
    await h.db.query(`insert into profiles (${pc.join(', ')}) values (${pc.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(p));
    const b = benchmarkToRow(benchmark, userId);
    const bc = Object.keys(b);
    await h.db.query(`insert into benchmarks (${bc.join(', ')}) values (${bc.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(b));
  });

  return { data, created, sessionId: started.sessionId, profile, benchmark };
}

const invite = (email: string, type = 'training_coach') => h.call<Invite>('invite_professional', [email, type]);
const accept = (code: string) => h.call<string>('accept_relationship_invite', [code]);
const grant = (relationship: string, category: string, expires: string | null = null) =>
  h.call<string>('create_grant', [relationship, category, expires], ['uuid', 'text', 'timestamptz']);
const shared = (athlete: string) => h.call<Shared>('get_shared_context', [athlete], ['uuid']);
const relationships = () => h.call<Relationship[]>('list_relationships');

/** Athlete invites the coach, the coach accepts; returns the relationship id. */
async function connect(athlete: string, coach: string, coachEmail: string, type = 'training_coach'): Promise<string> {
  const inv = await h.as(athlete, () => invite(coachEmail, type));
  await h.as(coach, () => accept(inv.invite_code));
  return inv.relationship_id;
}

describe('athlete foundation migration', () => {
  let athlete: Awaited<ReturnType<typeof seedTraining>>;

  before(async () => {
    h = await openDatabase();
    await h.addUser(ATHLETE, 'athlete@example.com');
    await h.addUser(COACH, 'coach@example.com');
    await h.addUser(OTHER_COACH, 'other.coach@example.com');
    await h.addUser(STRANGER, 'stranger@example.com');
    await h.addUser(OTHER_ATHLETE, 'second.athlete@example.com');
    athlete = await seedTraining(ATHLETE, 'Alex');
    await seedTraining(OTHER_ATHLETE, 'Sam');
  });

  it('can be run a second time without error', async () => {
    await h.db.exec(readMigration('migrations/0003_athlete_foundation.sql'));
  });

  it('round-trips the profile and benchmarks through their tables', async () => {
    await h.as(ATHLETE, async () => {
      const p = (await h.db.query<Record<string, unknown>>('select * from profiles')).rows[0];
      assert.deepEqual(plain(rowToProfile({ ...p, updated_at: (p.updated_at as Date).toISOString() } as never)), plain(athlete.profile));
      const b = (await h.db.query<Record<string, unknown>>('select * from benchmarks')).rows[0];
      const iso = (v: unknown) => (v ? (v as Date).toISOString() : null);
      // node-postgres style drivers hand a date column back as a Date at local midnight; the app receives a string.
      const measured = b.measured_on instanceof Date ? `${b.measured_on.getFullYear()}-${String(b.measured_on.getMonth() + 1).padStart(2, '0')}-${String(b.measured_on.getDate()).padStart(2, '0')}` : b.measured_on;
      assert.deepEqual(
        plain(rowToBenchmark({ ...b, measured_on: measured, created_at: iso(b.created_at), updated_at: iso(b.updated_at), deleted_at: iso(b.deleted_at) } as never)),
        plain(athlete.benchmark)
      );
    });
  });

  describe('deny by default', () => {
    it('shows another signed-in user nothing in any athlete table', async () => {
      for (const who of [COACH, STRANGER]) {
        await h.as(who, async () => {
          for (const table of ATHLETE_TABLES) assert.equal(await h.count(table), 0, `${table} leaked to another user`);
          for (const table of ['data_share_grants', 'audit_events', 'notifications']) assert.equal(await h.count(table), 0, table);
        });
      }
    });

    it('refuses shared-data access with no relationship', async () => {
      await h.as(COACH, () => rejects(shared(ATHLETE), /FORBIDDEN/));
      await h.as(STRANGER, () => rejects(shared(ATHLETE), /FORBIDDEN/));
    });

    it('refuses every function to a signed-out caller', async () => {
      await h.as(null, async () => {
        await rejects(shared(ATHLETE), /permission denied/);
        await rejects(invite('coach@example.com'), /permission denied/);
        await rejects(h.call('export_my_data'), /permission denied/);
        await rejects(h.call('list_relationships'), /permission denied/);
        await rejects(h.call('delete_my_account'), /permission denied/);
      });
    });

    it('keeps internal tables and helper functions away from clients', async () => {
      await h.as(ATHLETE, async () => {
        await rejects(h.db.query('select * from domain_events'), /permission denied/);
        await rejects(h.db.query('select * from account_deletions'), /permission denied/);
        await rejects(h.db.query(`select _audit($1, $1, 'data.read', null, null, null, null, '{}')`, [ATHLETE]), /permission denied/);
        await rejects(h.db.query(`select _notify($1, 'sharing', 'x', 'y', null, null)`, [COACH]), /permission denied/);
        await rejects(h.db.query(`insert into data_share_grants (athlete_id, relationship_id, data_category, purpose, consent_version) values ($1, $2, 'profile', 'x', 'v1')`, [ATHLETE, newUuid()]), /permission denied/);
        await rejects(h.db.query(`insert into audit_events (action) values ('forged')`), /permission denied/);
        await rejects(h.db.query(`insert into notifications (user_id, category, title, body) values ($1, 'sharing', 'x', 'y')`, [ATHLETE]), /permission denied/);
      });
    });
  });

  describe('invitations', () => {
    let inv: Invite;

    it('lets an athlete invite a professional and see the code', async () => {
      inv = await h.as(ATHLETE, () => invite('  Coach@Example.com '));
      assert.match(inv.invite_code, /^[0-9A-F]{10}$/);
      const [rel] = await h.as(ATHLETE, relationships);
      assert.deepEqual([rel.role, rel.status, rel.counterpart_name, rel.invite_code], ['athlete', 'invited', 'coach@example.com', inv.invite_code]);
    });

    it('rejects a bad address, inviting yourself, and a duplicate invitation', async () => {
      await h.as(ATHLETE, async () => {
        await rejects(invite('not-an-email'), /INVALID_EMAIL/);
        await rejects(invite('athlete@example.com'), /CANNOT_INVITE_YOURSELF/);
        await rejects(invite('coach@example.com'), /ALREADY_INVITED/);
        await rejects(invite('coach@example.com', 'boss'), /INVALID_RELATIONSHIP_TYPE/);
      });
    });

    it('never exposes the invite code through the table', async () => {
      await h.as(ATHLETE, async () => {
        await rejects(h.db.query('select invite_code from professional_relationships'), /permission denied/);
        await rejects(h.db.query('select * from professional_relationships'), /permission denied/);
        assert.equal((await h.db.query('select id, status from professional_relationships')).rows.length, 1);
      });
      await h.as(COACH, async () => {
        assert.equal((await h.db.query('select id from professional_relationships')).rows.length, 0, 'not visible before accepting');
        assert.deepEqual(await relationships(), []);
      });
    });

    it('gives one answer for every way accepting can fail', async () => {
      await h.as(STRANGER, () => rejects(accept(inv.invite_code), /INVITE_NOT_VALID/)); // right code, wrong account
      await h.as(COACH, () => rejects(accept('0000000000'), /INVITE_NOT_VALID/)); // wrong code
      await h.as(ATHLETE, () => rejects(accept(inv.invite_code), /INVITE_NOT_VALID/)); // own invitation

      await h.db.query(`update professional_relationships set invite_expires_at = now() - interval '1 minute' where id = $1`, [inv.relationship_id]);
      await h.as(COACH, () => rejects(accept(inv.invite_code), /INVITE_NOT_VALID/)); // expired
      await h.db.query(`update professional_relationships set invite_expires_at = now() + interval '1 day' where id = $1`, [inv.relationship_id]);
    });

    it('activates on accept, uses the code up, and tells the athlete', async () => {
      const id = await h.as(COACH, () => accept(inv.invite_code.toLowerCase()));
      assert.equal(id, inv.relationship_id);
      await h.as(COACH, () => rejects(accept(inv.invite_code), /INVITE_NOT_VALID/));

      const [mine] = await h.as(COACH, relationships);
      assert.deepEqual([mine.role, mine.status, mine.counterpart_name, mine.invite_code], ['professional', 'active', 'Alex', null]);
      assert.equal(await h.count('notifications', `user_id = $1 and title = 'Invitation accepted'`, [ATHLETE]), 1);
    });
  });

  describe('grants', () => {
    let relationship: string;

    before(async () => {
      relationship = (await h.as(ATHLETE, relationships))[0].id;
    });

    it('gives an accepted professional no data until something is granted', async () => {
      const ctx = await h.as(COACH, () => shared(ATHLETE));
      assert.deepEqual(ctx.granted, []);
      for (const key of ['profile', 'benchmarks', 'workout_plan', 'workout_session', 'performance_summary']) {
        assert.equal(key in ctx, false, `${key} returned without a grant`);
      }
      assert.equal(ctx.athlete.display_name, 'Alex');
    });

    it('lets only the athlete decide what is shared', async () => {
      await h.as(COACH, () => rejects(grant(relationship, 'workout_session'), /FORBIDDEN/));
      await h.as(STRANGER, () => rejects(grant(relationship, 'workout_session'), /FORBIDDEN/));
      await h.as(ATHLETE, async () => {
        await rejects(grant(relationship, 'nutrition_log'), /CATEGORY_NOT_AVAILABLE/);
        await rejects(grant(relationship, 'made_up'), /CATEGORY_NOT_AVAILABLE/);
        await rejects(grant(relationship, 'profile', new Date(Date.now() - 1000).toISOString()), /EXPIRY_IN_PAST/);
      });
    });

    it('returns exactly the granted categories, in the shape the app already reads', async () => {
      const first = await h.as(ATHLETE, () => grant(relationship, 'workout_plan'));
      const again = await h.as(ATHLETE, () => grant(relationship, 'workout_plan'));
      assert.equal(again, first, 'granting twice is one grant');
      await h.as(ATHLETE, () => grant(relationship, 'workout_session'));

      const ctx = await h.as(COACH, () => shared(ATHLETE));
      assert.deepEqual(ctx.granted, ['workout_plan', 'workout_session']);
      assert.equal('profile' in ctx || 'benchmarks' in ctx || 'performance_summary' in ctx, false);

      assert.equal(ctx.workout_plan?.length, 1);
      assert.deepEqual(plain(rowToVersion(ctx.workout_plan[0].version)), plain(athlete.data.versions[athlete.created.versionId]));
      assert.equal(ctx.workout_session?.length, 1);
      assert.deepEqual(plain(rowToSession(ctx.workout_session[0])), plain(athlete.data.sessions[athlete.sessionId]));
    });

    it('still shows the professional nothing through the tables', async () => {
      await h.as(COACH, async () => {
        for (const table of ATHLETE_TABLES) assert.equal(await h.count(table), 0, `${table} readable directly`);
      });
    });

    it('records every read and shows it to the athlete, without the data', async () => {
      const log = await h.as(ATHLETE, () => h.call<{ action: string; data_category: string; actor_name: string | null; by_me: boolean; rows: number }[]>('my_data_access_log'));
      const reads = log.filter((e) => e.action === 'data.read');
      assert.deepEqual([...new Set(reads.map((e) => e.data_category))].sort(), ['workout_plan', 'workout_session']);
      assert.ok(reads.every((e) => e.actor_name === 'coach@example.com' && e.by_me === false && e.rows === 1));

      const stored = (await h.db.query<{ blob: string }>(`select string_agg(detail::text, ' ') as blob from audit_events`)).rows[0].blob;
      assert.equal(/Back Squat|felt fine|Alex/.test(stored), false, 'audit detail must not contain athlete content');
    });

    it('does not let a different professional in, even with the right ids', async () => {
      await connect(OTHER_ATHLETE, OTHER_COACH, 'other.coach@example.com');
      const theirs = (await h.as(OTHER_ATHLETE, relationships))[0].id;
      await h.as(OTHER_ATHLETE, () => grant(theirs, 'workout_session'));

      await h.as(OTHER_COACH, async () => {
        assert.equal((await shared(OTHER_ATHLETE)).workout_session?.length, 1, 'sees their own athlete');
        await rejects(shared(ATHLETE), /FORBIDDEN/);
        await rejects(h.call('revoke_grant', [(await h.db.query<{ id: string }>('select id from data_share_grants')).rows[0].id], ['uuid']), /FORBIDDEN/);
      });
      // The first coach is connected to Alex only.
      await h.as(COACH, () => rejects(shared(OTHER_ATHLETE), /FORBIDDEN/));
      const alexView = await h.as(COACH, () => shared(ATHLETE));
      assert.equal(alexView.workout_session?.length, 1);
      assert.equal(alexView.workout_session[0].notes, 'Alex felt fine');
    });

    it('stops access on the very next request after a revocation', async () => {
      const sessionGrant = (await h.as(ATHLETE, relationships))[0].grants.find((g) => g.data_category === 'workout_session');
      assert.ok(sessionGrant);
      await h.as(COACH, () => rejects(h.call('revoke_grant', [sessionGrant.id], ['uuid']), /FORBIDDEN/));
      await h.as(ATHLETE, () => h.call('revoke_grant', [sessionGrant.id], ['uuid']));

      const ctx = await h.as(COACH, () => shared(ATHLETE));
      assert.deepEqual(ctx.granted, ['workout_plan']);
      assert.equal('workout_session' in ctx, false);

      assert.equal(await h.count('data_share_grants', `id = $1 and status = 'revoked' and revoked_at is not null`, [sessionGrant.id]), 1, 'the decision is kept, marked withdrawn');
      assert.equal(await h.count('audit_events', `action = 'grant.revoked' and entity_id = $1`, [sessionGrant.id]), 1);
      assert.equal(await h.count('notifications', `user_id = $1 and title = 'Sharing changed'`, [COACH]), 1);
    });

    it('stops access when a grant passes its expiry', async () => {
      const id = await h.as(ATHLETE, () => grant(relationship, 'benchmarks', new Date(Date.now() + 86_400_000).toISOString()));
      assert.deepEqual((await h.as(COACH, () => shared(ATHLETE))).benchmarks?.length, 1);
      await h.db.query(`update data_share_grants set expires_at = now() - interval '1 second' where id = $1`, [id]);
      const ctx = await h.as(COACH, () => shared(ATHLETE));
      assert.equal('benchmarks' in ctx, false);
      assert.equal((await h.as(ATHLETE, relationships))[0].grants.some((g) => g.data_category === 'benchmarks'), false, 'an expired grant is not listed as active');
    });

    it('shares the profile and the summary only when each is granted', async () => {
      await h.as(ATHLETE, () => grant(relationship, 'profile'));
      await h.as(ATHLETE, () => grant(relationship, 'performance_summary'));
      const ctx = await h.as(COACH, () => shared(ATHLETE));
      assert.deepEqual(ctx.profile?.sports, ['strength']);
      assert.equal('user_id' in (ctx.profile ?? {}), false);
      assert.deepEqual([ctx.performance_summary?.sessions_completed, ctx.performance_summary?.workouts_planned, ctx.performance_summary?.planned_workouts_completed], [1, 1, 1]);
    });
  });

  describe('organizations', () => {
    it('does not turn shared membership into data access', async () => {
      const org = await h.as(STRANGER, () => h.call<string>('create_organization', ['Iron Works', 'studio']));
      await h.db.query(`insert into organization_members (organization_id, user_id, role) values ($1, $2, 'member')`, [org, ATHLETE]);

      await h.as(STRANGER, async () => {
        assert.equal(await h.count('organization_members'), 2, 'the owner sees the member list');
        await rejects(shared(ATHLETE), /FORBIDDEN/);
        for (const table of ATHLETE_TABLES) assert.equal(await h.count(table), 0, `${table} visible to the studio owner`);
      });
      await h.as(ATHLETE, async () => {
        assert.equal(await h.count('organizations'), 1);
        assert.equal(await h.count('organization_members'), 1, 'a member sees only their own membership');
      });
      await h.as(COACH, async () => assert.equal(await h.count('organizations'), 0, 'a non-member sees no organization'));
    });
  });

  describe('audit trail and events', () => {
    it('cannot be edited or deleted by anyone', async () => {
      await rejects(h.db.query(`update audit_events set action = 'tampered'`), /AUDIT_IMMUTABLE/);
      await rejects(h.db.query(`delete from audit_events`), /AUDIT_IMMUTABLE/);
      await h.as(ATHLETE, () => rejects(h.db.query(`delete from audit_events`), /permission denied/));
    });

    it('emits one reference-only event per thing that happened', async () => {
      const types = (await h.db.query<{ event_type: string; n: number }>(
        `select event_type, count(*)::int as n from domain_events where subject_id = $1 group by 1`, [ATHLETE]
      )).rows;
      const byType = Object.fromEntries(types.map((t) => [t.event_type, t.n]));
      assert.equal(byType.WorkoutScheduled, 1);
      assert.equal(byType.WorkoutCompleted, 1, 'a session uploaded twice is completed once');
      assert.equal(byType.AthleteBenchmarkUpdated, 1);
      assert.equal(byType.DataGrantCreated, 5);
      assert.equal(byType.DataGrantRevoked, 1);

      const columns = (await h.db.query<{ column_name: string }>(
        `select column_name from information_schema.columns where table_name = 'domain_events' order by 1`
      )).rows.map((r) => r.column_name);
      assert.deepEqual(columns, ['entity_id', 'entity_type', 'event_id', 'event_type', 'occurred_at', 'processed_at', 'producer', 'schema_version', 'subject_id', 'trace_id'], 'no payload column');
    });
  });

  describe('notifications', () => {
    it('lets the owner mark one read and change nothing else', async () => {
      await h.as(ATHLETE, async () => {
        assert.equal(await h.count('notifications'), 1);
        await h.db.query('update notifications set read_at = now()');
        await rejects(h.db.query(`update notifications set body = 'edited'`), /permission denied/);
        await rejects(h.db.query('delete from notifications'), /permission denied/);
      });
    });

    it('respects a muted category', async () => {
      await h.as(COACH, () => h.db.query(`insert into notification_preferences (user_id, muted_categories) values ($1, '{sharing}')`, [COACH]));
      const before = await h.count('notifications', 'user_id = $1', [COACH]);
      const grantId = (await h.as(ATHLETE, relationships))[0].grants.find((g) => g.data_category === 'profile')?.id;
      await h.as(ATHLETE, () => h.call('revoke_grant', [grantId], ['uuid']));
      assert.equal(await h.count('notifications', 'user_id = $1', [COACH]), before);
      await h.as(COACH, () => h.db.query('delete from notification_preferences'));
    });
  });

  describe('ending a relationship', () => {
    it('lets either side end it, withdraws every grant, and closes access', async () => {
      const relationship = (await h.as(ATHLETE, relationships))[0].id;
      await h.as(STRANGER, () => rejects(h.call('end_relationship', [relationship], ['uuid']), /FORBIDDEN/));
      await h.as(COACH, () => h.call('end_relationship', [relationship], ['uuid']));

      await h.as(COACH, () => rejects(shared(ATHLETE), /FORBIDDEN/));
      assert.equal(await h.count('data_share_grants', `relationship_id = $1 and status = 'active'`, [relationship]), 0);
      assert.equal(await h.count('domain_events', `event_type = 'RelationshipEnded' and entity_id = $1`, [relationship]), 1);
      assert.equal(await h.count('notifications', `user_id = $1 and title = 'Connection ended'`, [ATHLETE]), 1);
      await h.as(ATHLETE, () => rejects(grant(relationship, 'profile'), /RELATIONSHIP_ENDED/));

      // Ending is not a ban: the athlete can invite the same person again.
      const again = await h.as(ATHLETE, () => invite('coach@example.com'));
      await h.as(COACH, () => accept(again.invite_code));
      assert.deepEqual((await h.as(COACH, () => shared(ATHLETE))).granted, [], 'a new connection starts with nothing shared');
    });
  });

  describe('export and deletion', () => {
    it('exports everything about the caller and nothing about anyone else', async () => {
      const doc = await h.as(ATHLETE, () => h.call<Record<string, any>>('export_my_data'));
      assert.equal(doc.format, 'form-export-v1');
      assert.equal(doc.profile.display_name, 'Alex');
      assert.deepEqual([doc.workouts.length, doc.workout_versions.length, doc.sessions.length, doc.benchmarks.length], [1, 1, 1, 1]);
      assert.equal(doc.workout_versions[0].blocks[0].steps[0].name, 'Back Squat');
      assert.equal(doc.sessions[0].session_results.length, 2);
      assert.ok(doc.sharing.grants.length >= 5 && doc.access_log.length > 0);

      const text = JSON.stringify(doc);
      assert.equal(text.includes('Sam'), false, "another athlete's data in the export");
      assert.equal(text.includes('invite_code'), false);
      assert.equal(await h.count('audit_events', `action = 'data.exported' and actor_user_id = $1`, [ATHLETE]), 1);
    });

    it('removes the account and every row of its data, and ends its connections', async () => {
      const relationship = (await h.as(ATHLETE, relationships)).find((r) => r.status === 'active')?.id;
      await h.as(ATHLETE, () => grant(relationship as string, 'workout_session'));
      await h.as(ATHLETE, () => h.call('delete_my_account'));

      assert.equal(await h.count('auth.users', 'id = $1', [ATHLETE]), 0);
      for (const table of [...ATHLETE_TABLES, 'notifications', 'notification_preferences', 'data_share_grants']) {
        const column = table === 'data_share_grants' ? 'athlete_id' : 'user_id';
        assert.equal(await h.count(table, `${column} = $1`, [ATHLETE]), 0, `${table} still holds the deleted athlete's rows`);
      }
      assert.equal(await h.count('professional_relationships', 'athlete_id = $1', [ATHLETE]), 0);
      assert.equal(await h.count('organization_members', 'user_id = $1', [ATHLETE]), 0);
      await h.as(COACH, () => rejects(shared(ATHLETE), /FORBIDDEN/));

      // What remains: identifiers in the audit trail, and the other athlete untouched.
      assert.equal(await h.count('audit_events', `action = 'account.deleted' and subject_athlete_id = $1`, [ATHLETE]), 1);
      assert.equal(await h.count('sessions', 'user_id = $1', [OTHER_ATHLETE]), 1);
      assert.equal(await h.count('notifications', `user_id = $1 and title = 'Connection ended'`, [COACH]) >= 1, true);
    });
  });
});
