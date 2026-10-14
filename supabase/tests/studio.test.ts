/**
 * Studio beta (roadmap Step 11): staff seats and invitations, memberships
 * and class credits, bookings with a waitlist, attendance, tenant isolation,
 * no member data through membership, and reports that hide small groups.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { openDatabase, readMigration, rejects, type Harness } from './harness';

const OWNER = 'a5000000-0000-4000-8000-0000000000a1';
const COACH = 'a5000000-0000-4000-8000-0000000000a2'; // instructor at the studio
const OTHER_COACH = 'a5000000-0000-4000-8000-0000000000a3';
const ANNA = 'a5000000-0000-4000-8000-0000000000b1';
const BEN = 'a5000000-0000-4000-8000-0000000000b2';
const RIVAL = 'a5000000-0000-4000-8000-0000000000c1'; // owner of another studio
const EXTRA = [1, 2, 3, 4, 5].map((n) => `a5000000-0000-4000-8000-0000000000d${n}`);
const email = (id: string) => `${id.slice(-2)}@example.com`;
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

let h: Harness;
const call = <T>(user: string, fn: string, args: unknown[] = [], casts: string[] = []) => h.as(user, () => h.call<T>(fn, args, casts));
const SCHEDULE_CASTS = ['uuid', 'uuid', 'text', 'text', 'uuid', 'timestamptz', 'integer', 'integer', 'integer', 'uuid'];

async function join(org: string, user: string, role: string) {
  const inv = await call<{ invite_code: string }>(OWNER, 'invite_to_organization', [org, email(user), role], ['uuid', 'text', 'text']);
  await call(user, 'accept_organization_invite', [inv.invite_code]);
}
type Klass = { id: string; booked: number; waitlisted: number; my_booking: { status: string; waitlist_position: number | null } | null };
const classes = (user: string, org: string) => call<Klass[]>(user, 'list_classes', [org, inMinutes(-120), inMinutes(60 * 24 * 30)], ['uuid', 'timestamptz', 'timestamptz']);
const remaining = async (user: string) => (await h.db.query<{ n: number }>(`select classes_remaining as n from memberships where user_id = $1 and status <> 'ended'`, [user])).rows[0]?.n;

describe('studio migration', () => {
  let org: string;
  let pack: string;
  let monthly: string;
  let yoga: string;

  before(async () => {
    h = await openDatabase();
    for (const id of [OWNER, COACH, OTHER_COACH, ANNA, BEN, RIVAL, ...EXTRA]) await h.addUser(id, email(id));
    org = await call<string>(OWNER, 'create_studio', ['Riverside Strength', 'Main hall']);
  });

  it('can be run a second time without error', async () => {
    await h.db.exec(readMigration('migrations/0014_studio.sql'));
  });

  it('invites by code to the invited address only, and counts staff seats', async () => {
    const inv = await call<{ invite_code: string }>(OWNER, 'invite_to_organization', [org, email(COACH), 'instructor'], ['uuid', 'text', 'text']);
    await rejects(call(ANNA, 'accept_organization_invite', [inv.invite_code]), /INVITE_NOT_VALID/);
    await call(COACH, 'accept_organization_invite', [inv.invite_code]);
    await rejects(call(COACH, 'accept_organization_invite', [inv.invite_code]), /INVITE_NOT_VALID/);
    await call(OWNER, 'set_staff_seats', [org, 2], ['uuid', 'integer']);
    await rejects(call(OWNER, 'invite_to_organization', [org, email(OTHER_COACH), 'coach'], ['uuid', 'text', 'text']), /NO_STAFF_SEATS/);
    await rejects(call(OWNER, 'set_staff_seats', [org, 1], ['uuid', 'integer']), /SEATS_IN_USE/);
    await rejects(call(COACH, 'invite_to_organization', [org, email(ANNA), 'member'], ['uuid', 'text', 'text']), /FORBIDDEN/);
    for (const m of [ANNA, BEN, ...EXTRA]) await join(org, m, 'member'); // members take no seats
    const people = await call<{ seats_used: number; people: unknown[] }>(OWNER, 'organization_people', [org], ['uuid']);
    assert.deepEqual([people.seats_used, people.people.length], [2, 9]);
    await rejects(call(COACH, 'organization_people', [org], ['uuid']), /FORBIDDEN/);
  });

  it('books with an active membership, uses and returns class credits, and runs a waitlist', async () => {
    pack = await call<string>(OWNER, 'create_membership_plan', [org, '2-class pack', 'class_pack', 3000, 'EUR', 2], ['uuid', 'text', 'text', 'integer', 'text', 'integer']);
    monthly = await call<string>(OWNER, 'create_membership_plan', [org, 'Monthly', 'monthly', 6000, 'EUR', null], ['uuid', 'text', 'text', 'integer', 'text', 'integer']);
    const res = await call<{ class_ids: string[] }>(COACH, 'schedule_classes', [org, null, 'Morning Yoga', null, COACH, inMinutes(60 * 24), 60, 1, 3, null], SCHEDULE_CASTS);
    assert.equal(res.class_ids.length, 3, 'one class a week for three weeks');
    yoga = res.class_ids[0];
    await rejects(call(COACH, 'schedule_classes', [org, null, 'Not mine', null, OWNER, inMinutes(60), 60, 10, 1, null], SCHEDULE_CASTS), /ONLY_OWN_CLASSES/);

    await rejects(call(ANNA, 'book_class', [yoga]), /NO_ACTIVE_MEMBERSHIP/);
    await call(OWNER, 'assign_membership', [org, ANNA, pack, null], ['uuid', 'uuid', 'uuid', 'date']);
    await call(OWNER, 'assign_membership', [org, BEN, monthly, null], ['uuid', 'uuid', 'uuid', 'date']);
    assert.equal((await call<{ status: string }>(ANNA, 'book_class', [yoga])).status, 'booked');
    assert.equal(await remaining(ANNA), 1);
    await rejects(call(ANNA, 'book_class', [yoga]), /ALREADY_BOOKED/);
    assert.equal((await call<{ status: string }>(BEN, 'book_class', [yoga])).status, 'waitlisted', 'capacity is one');
    const mine = (await classes(BEN, org)).find((c) => c.id === yoga)?.my_booking;
    assert.deepEqual([mine?.status, mine?.waitlist_position], ['waitlisted', 1]);

    await call(ANNA, 'cancel_booking', [yoga]);
    assert.equal(await remaining(ANNA), 2, 'the credit comes back');
    assert.equal((await classes(BEN, org)).find((c) => c.id === yoga)?.my_booking?.status, 'booked', 'the waitlist moves up');
    assert.equal(await h.count('notifications', `user_id = $1 and title like 'You are in:%'`, [BEN]), 1);

    await h.db.query(`update memberships set billing_status = 'overdue' where user_id = $1`, [ANNA]);
    await rejects(call(ANNA, 'book_class', [yoga]), /NO_ACTIVE_MEMBERSHIP/);
    await h.db.query(`update memberships set billing_status = 'paid' where user_id = $1`, [ANNA]);
  });

  it('cancelling a class returns credits and tells everyone booked', async () => {
    const second = (await classes(ANNA, org))[1].id;
    await call(ANNA, 'book_class', [second]);
    assert.equal(await remaining(ANNA), 1);
    await rejects(call(ANNA, 'cancel_class', [second]), /FORBIDDEN/);
    await call(COACH, 'cancel_class', [second]);
    assert.equal(await remaining(ANNA), 2);
    assert.equal(await h.count('notifications', `user_id = $1 and title like 'Class cancelled:%'`, [ANNA]), 1);
    await rejects(call(BEN, 'book_class', [second]), /CLASS_CANCELLED/);
  });

  it('shows the roster to the class instructor and managers only, and records attendance once it starts', async () => {
    const soon = (await call<{ class_ids: string[] }>(COACH, 'schedule_classes', [org, null, 'Lunch HIIT', null, COACH, inMinutes(10), 30, 10, 1, null], SCHEDULE_CASTS)).class_ids[0];
    const later = (await call<{ class_ids: string[] }>(OWNER, 'schedule_classes', [org, null, 'Evening Mobility', null, null, inMinutes(60 * 5), 45, 10, 1, null], SCHEDULE_CASTS)).class_ids[0];
    await call(BEN, 'book_class', [soon]);
    await call(BEN, 'book_class', [later]);
    type Row = { booking_id: string; name: string; status: string; attended: boolean | null };
    const roster = await call<Row[]>(COACH, 'class_roster', [soon]);
    assert.deepEqual(roster.map((r) => [r.name, r.status]), [[email(BEN), 'booked']]);
    assert.deepEqual(Object.keys(roster[0]).sort(), ['attended', 'booking_id', 'checked_in_at', 'name', 'status'], 'operational fields only');
    await rejects(call(COACH, 'class_roster', [later]), /FORBIDDEN/);
    await rejects(call(BEN, 'class_roster', [soon]), /FORBIDDEN/);
    await call(COACH, 'mark_attendance', [roster[0].booking_id, true]);
    assert.equal((await call<Row[]>(OWNER, 'class_roster', [soon]))[0].attended, true);
    const laterBooking = (await call<Row[]>(OWNER, 'class_roster', [later]))[0].booking_id;
    await rejects(call(OWNER, 'mark_attendance', [laterBooking, true]), /TOO_EARLY/);
  });

  it('gives the class workout only to people booked on it', async () => {
    {
      // Seeded directly; the app writes workouts through save_workout_version.
      await h.db.query(`insert into workouts (id, user_id, is_template, source, created_at, updated_at) values ('a5000000-0000-4000-8000-00000000e001', $1, true, 'manual', now(), now())`, [COACH]);
      await h.db.query(`insert into workout_versions (id, workout_id, user_id, version, status, title, sport, created_at) values ('a5000000-0000-4000-8000-00000000e002', 'a5000000-0000-4000-8000-00000000e001', $1, 1, 'published', 'Class Circuit', 'crossfit', now())`, [COACH]);
    }
    const id = (await call<{ class_ids: string[] }>(COACH, 'schedule_classes', [org, null, 'Circuit', null, COACH, inMinutes(60 * 30), 45, 10, 1, 'a5000000-0000-4000-8000-00000000e002'], SCHEDULE_CASTS)).class_ids[0];
    await rejects(call(BEN, 'class_workout', [id]), /FORBIDDEN/);
    await call(BEN, 'book_class', [id]);
    assert.equal((await call<{ title: string }>(BEN, 'class_workout', [id])).title, 'Class Circuit');
  });

  it('keeps studios apart and gives staff no member data through membership', async () => {
    const rivalOrg = await call<string>(RIVAL, 'create_studio', ['Other Gym', null]);
    await rejects(call(RIVAL, 'list_classes', [org, inMinutes(0), inMinutes(60)], ['uuid', 'timestamptz', 'timestamptz']), /FORBIDDEN/);
    await rejects(call(RIVAL, 'book_class', [yoga]), /FORBIDDEN/);
    await rejects(call(RIVAL, 'class_roster', [yoga]), /FORBIDDEN/);
    await rejects(call(OWNER, 'organization_people', [rivalOrg], ['uuid']), /FORBIDDEN/);
    await h.as(RIVAL, async () => assert.equal(await h.count('class_sessions'), 0));

    await h.as(BEN, () => h.db.query(`insert into benchmarks (id, user_id, kind, value, unit, measured_on) values ('a5000000-0000-4000-8000-00000000f001', $1, 'max_heart_rate', 190, 'bpm', current_date)`, [BEN]));
    for (const staff of [OWNER, COACH]) {
      await h.as(staff, async () => {
        for (const table of ['benchmarks', 'sessions', 'daily_recovery', 'food_log_entries', 'injury_episodes', 'athlete_goals']) {
          assert.equal(await h.count(table, 'user_id = $1', [BEN]), 0, `${table} stays private`);
        }
      });
      await rejects(call(staff, 'get_shared_context', [BEN], ['uuid']), /FORBIDDEN/);
    }
    await h.as(COACH, async () => assert.equal(await h.count('memberships', 'user_id = $1', [BEN]), 0, 'an instructor does not see billing'));
  });

  it('reports aggregates and hides groups smaller than five', async () => {
    type Report = { weeks: { suppressed: boolean; people: number | null; classes: number }[]; classes: { title: string; suppressed: boolean; occupancy: number | null }[]; memberships: { plan: string; active: number | null; suppressed: boolean }[] };
    const today = new Date().toISOString().slice(0, 10);
    const inMonth = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    let r = await call<Report>(OWNER, 'studio_report', [org, today, inMonth], ['uuid', 'date', 'date']);
    assert.ok(r.weeks.every((w) => w.suppressed && w.people === null));
    assert.ok(r.memberships.every((m) => m.suppressed && m.active === null));

    const big = (await call<{ class_ids: string[] }>(OWNER, 'schedule_classes', [org, null, 'Open Gym', null, null, inMinutes(60 * 48), 60, 20, 1, null], SCHEDULE_CASTS)).class_ids[0];
    for (const m of EXTRA) {
      await call(OWNER, 'assign_membership', [org, m, monthly, null], ['uuid', 'uuid', 'uuid', 'date']);
      await call(m, 'book_class', [big]);
    }
    r = await call<Report>(OWNER, 'studio_report', [org, today, inMonth], ['uuid', 'date', 'date']);
    const open = r.classes.find((c) => c.title === 'Open Gym');
    assert.deepEqual([open?.suppressed, open?.occupancy], [false, 0.25]);
    assert.equal(r.classes.find((c) => c.title === 'Lunch HIIT')?.suppressed, true);
    assert.deepEqual(r.memberships.find((m) => m.plan === 'Monthly'), { plan: 'Monthly', active: 6, suppressed: false });
    await rejects(call(COACH, 'studio_report', [org, today, inMonth], ['uuid', 'date', 'date']), /FORBIDDEN/);
  });

  it('leaving cancels future bookings and ends the membership; the person keeps their own data', async () => {
    await rejects(call(OWNER, 'leave_organization', [org], ['uuid']), /OWNER_CANNOT_LEAVE/);
    await call(BEN, 'leave_organization', [org], ['uuid']);
    assert.equal(await h.count('class_bookings b join class_sessions c on c.id = b.class_id', `b.user_id = $1 and b.status <> 'cancelled' and c.starts_at > now()`, [BEN]), 0);
    assert.equal(await h.count('memberships', `user_id = $1 and status <> 'ended'`, [BEN]), 0);
    await h.as(BEN, async () => assert.equal(await h.count('benchmarks'), 1));
    await rejects(call(BEN, 'list_classes', [org, inMinutes(0), inMinutes(60)], ['uuid', 'timestamptz', 'timestamptz']), /FORBIDDEN/);
    const exported = await call<{ studio: { organizations: unknown[]; memberships: unknown[]; bookings: unknown[] } }>(ANNA, 'export_my_data');
    assert.deepEqual([exported.studio.organizations.length, exported.studio.memberships.length > 0, exported.studio.bookings.length > 0], [1, true, true]);
  });
});
