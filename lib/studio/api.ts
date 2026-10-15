import { call, type Result } from '../sharing/api';
import { rowToVersion, type VersionRow } from '../sync/mappers';
import type { WorkoutVersion } from '../workout/model';
import type { OrgRole, Organization, People, PlanKind, Report, RosterRow, Shift, StudioClass, BillingStatus, MembershipStatus } from './model';

/** Client for the studio functions in supabase/migrations/0014_studio.sql. All of it needs a signed-in user. */

export const myOrganizations = () => call<Organization[]>('my_organizations');
export const createStudio = (name: string, facility: string) => call<string>('create_studio', { p_name: name, p_facility: facility });
export const addFacility = (org: string, name: string, address: string) => call<string>('add_facility', { p_org: org, p_name: name, p_address: address });
export const setStaffSeats = (org: string, seats: number) => call<null>('set_staff_seats', { p_org: org, p_seats: seats });

export const inviteToStudio = (org: string, email: string, role: Exclude<OrgRole, 'owner'>) =>
  call<{ invite_id: string; invite_code: string; expires_at: string }>('invite_to_organization', { p_org: org, p_email: email, p_role: role });
export const revokeStudioInvite = (invite: string) => call<null>('revoke_organization_invite', { p_invite: invite });
export const acceptStudioInvite = (code: string) => call<string>('accept_organization_invite', { p_code: code });
export const removeFromStudio = (org: string, user: string) => call<null>('remove_from_organization', { p_org: org, p_user: user });
export const leaveStudio = (org: string) => call<null>('leave_organization', { p_org: org });
export const studioPeople = (org: string) => call<People>('organization_people', { p_org: org });

export const createPlan = (org: string, name: string, kind: PlanKind, priceCents: number, currency: string, classes: number | null) =>
  call<string>('create_membership_plan', { p_org: org, p_name: name, p_kind: kind, p_price_cents: priceCents, p_currency: currency, p_classes: classes });
export const setPlanActive = (plan: string, active: boolean) => call<null>('set_plan_active', { p_plan: plan, p_active: active });
export const assignMembership = (org: string, user: string, plan: string) => call<string>('assign_membership', { p_org: org, p_user: user, p_plan: plan, p_starts_on: null });
export const updateMembership = (membership: string, status: MembershipStatus | null, billing: BillingStatus | null, paidUntil: string | null = null) =>
  call<null>('update_membership', { p_membership: membership, p_status: status, p_billing_status: billing, p_paid_until: paidUntil });

export type ScheduleInput = {
  facilityId: string | null;
  title: string;
  description: string;
  instructorId: string | null;
  firstStart: Date;
  minutes: number;
  capacity: number;
  weeks: number;
  versionId: string | null;
};
export const scheduleClasses = (org: string, s: ScheduleInput) =>
  call<{ series_id: string; class_ids: string[] }>('schedule_classes', {
    p_org: org,
    p_facility: s.facilityId,
    p_title: s.title,
    p_description: s.description,
    p_instructor: s.instructorId,
    p_first_start: s.firstStart.toISOString(),
    p_minutes: s.minutes,
    p_capacity: s.capacity,
    p_weeks: s.weeks,
    p_version: s.versionId,
  });
export const cancelClass = (id: string) => call<null>('cancel_class', { p_class: id });
export const listClasses = (org: string, from: Date, to: Date) => call<StudioClass[]>('list_classes', { p_org: org, p_from: from.toISOString(), p_to: to.toISOString() });
export const bookClass = (id: string) => call<{ booking_id: string; status: 'booked' | 'waitlisted' }>('book_class', { p_class: id });
export const cancelBooking = (id: string) => call<null>('cancel_booking', { p_class: id });
export const classRoster = (id: string) => call<RosterRow[]>('class_roster', { p_class: id });
export const markAttendance = (booking: string, attended: boolean) => call<null>('mark_attendance', { p_booking: booking, p_attended: attended });

/** The class workout in the app's own shape, to copy into the member's plan. */
export async function classWorkout(id: string): Promise<Result<WorkoutVersion | null>> {
  const res = await call<VersionRow | null>('class_workout', { p_class: id });
  return res.ok ? { ok: true, data: res.data ? rowToVersion(res.data) : null } : res;
}

export const addShift = (org: string, user: string, facility: string | null, starts: Date, ends: Date, note: string) =>
  call<string>('add_shift', { p_org: org, p_user: user, p_facility: facility, p_starts: starts.toISOString(), p_ends: ends.toISOString(), p_note: note });
export const removeShift = (id: string) => call<null>('remove_shift', { p_shift: id });
export const listShifts = (org: string, from: Date, to: Date) => call<Shift[]>('list_shifts', { p_org: org, p_from: from.toISOString(), p_to: to.toISOString() });

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const studioReport = (org: string, from: Date, to: Date) => call<Report>('studio_report', { p_org: org, p_from: ymd(from), p_to: ymd(to) });
