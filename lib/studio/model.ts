import { tr } from '../i18n/tr';
/**
 * Studio beta (docs/concepts/02-multi-role-access-and-business-model.md).
 * Everything a studio holds is operational: classes, bookings, attendance,
 * memberships, shifts. Joining a studio never shares training or health
 * data; that still needs a personal connection and a grant.
 */

export type OrgRole = 'owner' | 'manager' | 'coach' | 'physiotherapist' | 'instructor' | 'member';
export type PlanKind = 'monthly' | 'class_pack' | 'drop_in';
export type BillingStatus = 'paid' | 'due' | 'overdue' | 'none';
export type MembershipStatus = 'active' | 'paused' | 'ended';

export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: tr('Owner', 'Inhaber:in'),
  manager: tr('Manager', 'Leitung'),
  coach: 'Coach',
  physiotherapist: tr('Physiotherapist', 'Physiotherapie'),
  instructor: tr('Instructor', 'Trainer:in'),
  member: tr('Member', 'Mitglied'),
};
export const PLAN_KIND_LABEL: Record<PlanKind, string> = { monthly: tr('Monthly', 'Monatlich'), class_pack: tr('Class pack', 'Kurspaket'), drop_in: tr('Drop-in', 'Einzelbesuch') };
export const BILLING_LABEL: Record<BillingStatus, string> = { paid: tr('Paid', 'Bezahlt'), due: tr('Due', 'Fällig'), overdue: tr('Overdue', 'Überfällig'), none: tr('Free', 'Kostenlos') };
export const MEMBERSHIP_STATUS_LABEL: Record<MembershipStatus, string> = { active: tr('Active', 'Aktiv'), paused: tr('Paused', 'Pausiert'), ended: tr('Ended', 'Beendet') };

export const isAdmin = (role: OrgRole) => role === 'owner' || role === 'manager';
export const isStaff = (role: OrgRole) => role !== 'member';
/** Roles that run classes of their own. */
export const teaches = (role: OrgRole) => role === 'owner' || role === 'manager' || role === 'coach' || role === 'instructor';

export type MyMembership = {
  id: string;
  plan: string;
  kind: PlanKind;
  status: MembershipStatus;
  starts_on: string;
  ends_on: string | null;
  classes_remaining: number | null;
  billing_status: BillingStatus;
  paid_until: string | null;
};

export type Organization = {
  id: string;
  name: string;
  kind: 'studio' | 'clinic' | 'team';
  role: OrgRole;
  staff_seats: number;
  facilities: { id: string; name: string; address: string | null }[];
  membership: MyMembership | null;
};

export type StudioClass = {
  id: string;
  series_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: 'scheduled' | 'cancelled';
  facility: string | null;
  instructor_id: string | null;
  instructor_name: string | null;
  booked: number;
  waitlisted: number;
  has_workout: boolean;
  my_booking: { id: string; status: 'booked' | 'waitlisted'; attended: boolean | null; waitlist_position: number | null } | null;
  can_manage: boolean;
};

export type Plan = { id: string; name: string; kind: PlanKind; price_cents: number; currency: string; classes_included: number | null; active: boolean };

export type Person = {
  user_id: string;
  name: string | null;
  role: OrgRole;
  joined_at: string;
  membership: {
    id: string;
    plan_id: string;
    plan: string;
    status: MembershipStatus;
    classes_remaining: number | null;
    billing_status: BillingStatus;
    paid_until: string | null;
    starts_on: string;
    ends_on: string | null;
  } | null;
};

export type People = {
  seats_used: number;
  staff_seats: number;
  people: Person[];
  invites: { id: string; email: string; role: OrgRole; code: string; expires_at: string }[];
  plans: Plan[];
};

export type RosterRow = { booking_id: string; name: string | null; status: 'booked' | 'waitlisted'; attended: boolean | null; checked_in_at: string | null };
export type Shift = { id: string; user_id: string; name: string | null; facility: string | null; starts_at: string; ends_at: string; note: string | null; mine: boolean };

export type Report = {
  min_group_size: number;
  weeks: { week_start: string; classes: number; cancelled: number; capacity: number; bookings: number | null; attended: number | null; people: number | null; suppressed: boolean }[];
  classes: { title: string; sessions: number; occupancy: number | null; attendance_rate: number | null; suppressed: boolean }[];
  memberships: { plan: string; active: number | null; suppressed: boolean }[];
};

export type BookingAction = 'book' | 'join_waitlist' | 'cancel' | 'leave_waitlist' | 'started' | 'cancelled';

/** What the member can do about a class right now. */
export function bookingAction(c: Pick<StudioClass, 'status' | 'starts_at' | 'capacity' | 'booked' | 'my_booking'>, nowMs: number): BookingAction {
  if (c.status === 'cancelled') return 'cancelled';
  if (Date.parse(c.starts_at) <= nowMs) return 'started';
  if (c.my_booking?.status === 'booked') return 'cancel';
  if (c.my_booking?.status === 'waitlisted') return 'leave_waitlist';
  return c.booked < c.capacity ? 'book' : 'join_waitlist';
}

/** The start of each class in a weekly series, for a preview before scheduling. */
export function seriesStarts(first: Date, weeks: number): Date[] {
  return Array.from({ length: Math.max(0, Math.min(26, Math.floor(weeks))) }, (_, w) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7 * w, first.getHours(), first.getMinutes()));
}

export function formatPrice(cents: number, currency: string): string {
  const value = cents / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2)} ${currency}`;
}

/** A report number, or the reason it is hidden. */
export function reportCell(value: number | null, suppressed: boolean, minGroup: number): string {
  if (suppressed || value === null) return tr(`fewer than ${minGroup}`, `weniger als ${minGroup}`);
  return String(value);
}

export const percent = (fraction: number | null) => (fraction === null ? '–' : `${Math.round(fraction * 100)} %`);

/** Classes grouped by local day, in order. */
export function byDay<T extends { starts_at: string }>(items: T[]): { day: string; items: T[] }[] {
  const out: { day: string; items: T[] }[] = [];
  for (const item of [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const d = new Date(item.starts_at);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (out.at(-1)?.day === day) out.at(-1)!.items.push(item);
    else out.push({ day, items: [item] });
  }
  return out;
}
