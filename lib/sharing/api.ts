import type { Benchmark, Profile } from '../athlete/model';
import type { Goal } from '../goals/model';
import { supabase } from '../supabase';
import {
  rowToBenchmark,
  rowToGoal,
  type GoalRow,
  rowToProfile,
  rowToSession,
  rowToVersion,
  type BenchmarkRow,
  type ProfileRow,
  type SessionRow,
  type VersionRow,
} from '../sync/mappers';
import type { ScheduleStatus, Session, WorkoutVersion } from '../workout/model';

/**
 * Client for the sharing functions in
 * supabase/migrations/0003_athlete_foundation.sql. Everything here needs a
 * signed-in user; none of it works in local mode.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type RelationshipType = 'training_coach' | 'physiotherapist' | 'dietitian';

export const RELATIONSHIP_TYPES: { key: RelationshipType; label: string; purpose: string }[] = [
  { key: 'training_coach', label: 'Coach', purpose: 'training coaching' },
  { key: 'physiotherapist', label: 'Physiotherapist', purpose: 'rehabilitation' },
  { key: 'dietitian', label: 'Dietitian', purpose: 'nutrition coaching' },
];

export function relationshipLabel(type: RelationshipType): string {
  return RELATIONSHIP_TYPES.find((t) => t.key === type)?.label ?? type;
}

export function purposeLabel(type: RelationshipType): string {
  return RELATIONSHIP_TYPES.find((t) => t.key === type)?.purpose ?? type;
}

export type Grant = {
  id: string;
  data_category: string;
  actions: string[];
  purpose: string;
  effective_from: string;
  expires_at: string | null;
  consent_version: string;
};

export type Relationship = {
  id: string;
  /** The caller's side of the relationship. */
  role: 'athlete' | 'professional';
  relationship_type: RelationshipType;
  status: 'invited' | 'active' | 'ended';
  /** Who sent the invitation. */
  invited_by: 'athlete' | 'professional';
  counterpart_name: string | null;
  /** Empty while a professional's invitation to an athlete is open. */
  athlete_id: string | null;
  invitee_email: string | null;
  invite_code: string | null;
  invite_expires_at: string | null;
  created_at: string;
  accepted_at: string | null;
  ended_at: string | null;
  grants: Grant[];
};

export type DataCategory = {
  id: string;
  label: string;
  description: string;
  sensitivity: 'standard' | 'sensitive';
  available: boolean;
  position: number;
};

export type AccessLogEntry = {
  id: string;
  occurred_at: string;
  action: string;
  data_category: string | null;
  purpose: string | null;
  by_me: boolean;
  actor_name: string | null;
  rows: number | null;
};

export type PerformanceSummary = {
  window_days: number;
  sessions_completed: number;
  workouts_planned: number;
  planned_workouts_completed: number;
  last_session_at: string | null;
};

export type SharedContext = {
  athlete: { id: string; displayName: string };
  relationshipType: RelationshipType;
  retrievedAt: number;
  /** Categories the athlete currently shares. Anything not listed was not returned at all. */
  granted: string[];
  profile?: Profile;
  benchmarks?: Benchmark[];
  plan?: { id: string; scheduledAt: number; status: ScheduleStatus; version: WorkoutVersion }[];
  sessions?: Session[];
  summary?: PerformanceSummary;
};

const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'You need to be signed in.',
  FORBIDDEN: 'You do not have access to that.',
  INVALID_EMAIL: 'Enter a valid email address.',
  CANNOT_INVITE_YOURSELF: 'That is your own email address.',
  ALREADY_INVITED: 'You already have an open invitation or connection with that address.',
  INVALID_RELATIONSHIP_TYPE: 'Choose what kind of professional this is.',
  INVITE_NOT_VALID: 'That code is not valid for this account. Check the code, that it has not expired, and that you are signed in with the invited email address.',
  RELATIONSHIP_ENDED: 'This connection has ended.',
  CATEGORY_NOT_AVAILABLE: 'That kind of data cannot be shared yet.',
  EXPIRY_IN_PAST: 'The end date must be in the future.',
  ONLY_COACHES_ASSIGN: 'Only a coach can send workouts.',
  VERSION_NOT_FOUND: 'That workout is not on the server yet. Wait for it to sync and try again.',
  VERSION_NOT_PUBLISHED: 'Finish the workout before sending it; drafts cannot be assigned.',
  DATE_IN_PAST: 'Choose a date that is not in the past.',
  ASSIGNMENT_ALREADY_DECIDED: 'This workout has already been accepted, declined or withdrawn.',
  SCHEDULE_REQUIRED: 'Something went wrong adding it to your calendar. Try again.',
  INVALID_COMMENT: 'Write a comment of up to 2000 characters.',
  INVALID_NAME: 'Enter a name of up to 80 characters.',
  INVALID_ROLE: 'Choose a role.',
  NO_STAFF_SEATS: 'All staff seats are in use. Add seats or remove someone first.',
  SEATS_IN_USE: 'More staff seats are in use than that.',
  INVALID_SEATS: 'Choose between 1 and 500 seats.',
  CANNOT_REMOVE_OWNER: 'The owner cannot be removed, and only the owner can remove a manager.',
  OWNER_CANNOT_LEAVE: 'The owner cannot leave their own studio.',
  NOT_A_MEMBER: 'That person is not in this studio.',
  INVALID_PLAN: 'Check the plan: a class pack needs a number of classes, other plans do not.',
  INVALID_PRICE: 'Enter a price of zero or more.',
  MEMBERSHIP_ENDED: 'This membership has ended.',
  INVALID_STATUS: 'Choose a valid status.',
  ONLY_OWN_CLASSES: 'Instructors schedule their own classes; managers can schedule for others.',
  INSTRUCTOR_NOT_STAFF: 'The instructor must be on the studio staff.',
  INVALID_CLASS: 'Check the class: 10 to 480 minutes, 1 to 500 places, 1 to 26 weeks.',
  CLASS_CANCELLED: 'This class was cancelled.',
  CLASS_STARTED: 'This class has already started.',
  ALREADY_BOOKED: 'You are already booked or on the waitlist.',
  NO_ACTIVE_MEMBERSHIP: 'You need an active membership for this date with classes left. Ask the studio.',
  NOT_BOOKED: 'Only booked places can be checked in.',
  TOO_EARLY: 'Attendance can be recorded from 30 minutes before the class.',
  NOT_STAFF: 'Shifts are for staff only.',
  INVALID_SHIFT: 'A shift ends after it starts and lasts at most 16 hours.',
  SHIFT_OVERLAPS: 'That overlaps another shift for this person.',
  RANGE_TOO_LONG: 'Choose a shorter period.',};

function friendly(message: string | undefined): string {
  if (!message) return 'Something went wrong. Try again.';
  const code = Object.keys(MESSAGES).find((key) => message.includes(key));
  if (code) return MESSAGES[code];
  if (/fetch|network/i.test(message)) return 'No connection. Sharing settings need to be online.';
  return 'Something went wrong. Try again.';
}

/** Calls a database function and turns its error codes into messages for people. */
export async function call<T>(fn: string, args?: Record<string, unknown>): Promise<Result<T>> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, error: friendly(error.message) };
    return { ok: true, data: data as T };
  } catch (e) {
    return { ok: false, error: friendly(e instanceof Error ? e.message : undefined) };
  }
}

export const listRelationships = () => call<Relationship[]>('list_relationships');

export const inviteProfessional = (email: string, type: RelationshipType) =>
  call<{ relationship_id: string; invite_code: string; expires_at: string }>('invite_professional', {
    p_email: email,
    p_relationship_type: type,
  });

export const acceptInvite = (code: string) => call<string>('accept_relationship_invite', { p_code: code });

/** A professional invites an athlete; the athlete accepts with the code and then chooses what to share. */
export const inviteAthlete = (email: string, type: RelationshipType) =>
  call<{ relationship_id: string; invite_code: string; expires_at: string }>('invite_athlete', { p_email: email, p_relationship_type: type });

export const createGrant = (relationshipId: string, category: string, expiresAt: Date | null) =>
  call<string>('create_grant', {
    p_relationship: relationshipId,
    p_category: category,
    p_expires_at: expiresAt ? expiresAt.toISOString() : null,
  });

export const revokeGrant = (grantId: string) => call<null>('revoke_grant', { p_grant: grantId });

export const endRelationship = (relationshipId: string) => call<null>('end_relationship', { p_relationship: relationshipId });

export const myDataAccessLog = (limit = 50) => call<AccessLogEntry[]>('my_data_access_log', { p_limit: limit });

export const exportMyData = () => call<Record<string, unknown>>('export_my_data');

export const deleteMyAccount = () => call<null>('delete_my_account');

export async function listCategories(): Promise<Result<DataCategory[]>> {
  const { data, error } = await supabase.from('data_categories').select('*').order('position');
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, data: data as DataCategory[] };
}

type SharedContextRow = {
  athlete: { id: string; display_name: string | null };
  relationship_type: RelationshipType;
  retrieved_at: string;
  granted: string[];
  profile?: Omit<ProfileRow, 'user_id'> | null;
  benchmarks?: BenchmarkRow[];
  workout_plan?: { id: string; scheduled_at: string; status: ScheduleStatus; version: VersionRow }[];
  workout_session?: SessionRow[];
  performance_summary?: PerformanceSummary;
};

export function parseSharedContext(row: SharedContextRow): SharedContext {
  const ctx: SharedContext = {
    athlete: { id: row.athlete.id, displayName: row.athlete.display_name ?? 'Athlete' },
    relationshipType: row.relationship_type,
    retrievedAt: new Date(row.retrieved_at).getTime(),
    granted: row.granted ?? [],
  };
  if (row.granted.includes('profile') && row.profile) ctx.profile = rowToProfile(row.profile);
  if (row.benchmarks) ctx.benchmarks = row.benchmarks.map(rowToBenchmark);
  if (row.workout_plan) {
    ctx.plan = row.workout_plan.map((p) => ({
      id: p.id,
      scheduledAt: new Date(p.scheduled_at).getTime(),
      status: p.status,
      version: rowToVersion(p.version),
    }));
  }
  if (row.workout_session) ctx.sessions = row.workout_session.map(rowToSession);
  if (row.performance_summary) ctx.summary = row.performance_summary;
  return ctx;
}

/** Reads what an athlete shares with the caller. Every call is recorded in the athlete's access log. */
export async function getSharedContext(athleteId: string): Promise<Result<SharedContext>> {
  const res = await call<SharedContextRow>('get_shared_context', { p_athlete: athleteId });
  return res.ok ? { ok: true, data: parseSharedContext(res.data) } : res;
}

// ------------------------------------------------------------- coaching

export type AssignmentComment = { id: string; by_me: boolean; author_name: string | null; body: string; created_at: string };

export type Assignment = {
  id: string;
  /** The caller's side. */
  role: 'coach' | 'athlete';
  relationship_id: string;
  athlete_id: string;
  coach_name: string | null;
  athlete_name: string | null;
  title: string;
  /** The exact version sent, as it was when sent. */
  version: WorkoutVersion;
  scheduled_for: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  athlete_scheduled_id: string | null;
  created_at: string;
  decided_at: string | null;
  comments: AssignmentComment[];
};

type AssignmentRow = Omit<Assignment, 'version'> & { version: VersionRow };

export async function listAssignments(): Promise<Result<Assignment[]>> {
  const res = await call<AssignmentRow[]>('list_assignments');
  return res.ok ? { ok: true, data: res.data.map((a) => ({ ...a, version: rowToVersion(a.version) })) } : res;
}

export const assignWorkout = (relationshipId: string, versionId: string, scheduledFor: Date, message: string) =>
  call<string>('assign_workout', { p_relationship: relationshipId, p_version: versionId, p_scheduled_for: scheduledFor.toISOString(), p_message: message.trim() || null });

export const decideAssignment = (assignmentId: string, decision: 'accepted' | 'declined', scheduledId?: string) =>
  call<null>('decide_assignment', { p_assignment: assignmentId, p_decision: decision, p_scheduled: scheduledId ?? null });

export const cancelAssignment = (assignmentId: string) => call<null>('cancel_assignment', { p_assignment: assignmentId });

export const addAssignmentComment = (assignmentId: string, body: string) => call<string>('add_assignment_comment', { p_assignment: assignmentId, p_body: body });

export type AssignmentOutcome = { assignment_id: string; status: string; scheduled_status: ScheduleStatus | null; session: Session | null };

export async function getAssignmentOutcomes(athleteId: string): Promise<Result<{ planShared: boolean; sessionsShared: boolean; outcomes: AssignmentOutcome[] }>> {
  const res = await call<{ plan_shared: boolean; sessions_shared: boolean; outcomes: (Omit<AssignmentOutcome, 'session'> & { session: SessionRow | null })[] }>('get_assignment_outcomes', { p_athlete: athleteId });
  if (!res.ok) return res;
  return {
    ok: true,
    data: {
      planShared: res.data.plan_shared,
      sessionsShared: res.data.sessions_shared,
      outcomes: res.data.outcomes.map((o) => ({ ...o, session: o.session ? rowToSession(o.session) : null })),
    },
  };
}

export type RosterRow = {
  relationship_id: string;
  athlete_id: string;
  athlete_name: string | null;
  relationship_type: RelationshipType;
  granted: string[];
  pending_assignments: number;
  declined_assignments_28d: number;
  summary: { sessions_7d: number; sessions_28d: number; planned_28d: number; planned_done_28d: number; last_session_at: string | null } | null;
};

export const coachRoster = () => call<RosterRow[]>('coach_roster');

// ------------------------------------------------------------------ goals

export type GoalReview = { id: string; body: string; by_me?: boolean; author_name: string | null; created_at: string };
export type SharedGoal = Omit<GoalRow, 'user_id'> & { reviews: GoalReview[] };

/** A connected athlete's shared goals; every call is logged in their access log. */
export async function listSharedGoals(athleteId: string): Promise<Result<{ shared: boolean; goals: { goal: Goal; reviews: GoalReview[] }[] }>> {
  const res = await call<{ shared: boolean; goals: SharedGoal[] }>('list_shared_goals', { p_athlete: athleteId });
  if (!res.ok) return res;
  return { ok: true, data: { shared: res.data.shared, goals: res.data.goals.map((g) => ({ goal: rowToGoal(g as GoalRow), reviews: g.reviews ?? [] })) } };
}

export const addGoalReview = (goalId: string, body: string) => call<string>('add_goal_review', { p_goal: goalId, p_body: body });

/** Reviews a professional left on one of the athlete's own goals. */
export async function goalReviews(goalId: string): Promise<GoalReview[]> {
  const { data } = await supabase.from('goal_reviews').select('id, body, created_at, author_id').eq('goal_id', goalId).order('created_at');
  return ((data as { id: string; body: string; created_at: string }[] | null) ?? []).map((r) => ({ id: r.id, body: r.body, created_at: r.created_at, author_name: null }));
}

// ------------------------------------------------------- notifications

export type AppNotification = {
  id: string;
  category: 'sharing' | 'training' | 'account';
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type NotificationPreferences = {
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  mutedCategories: string[];
};

export async function listNotifications(): Promise<Result<AppNotification[]>> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, category, title, body, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, data: data as AppNotification[] };
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
}

export async function getNotificationPreferences(): Promise<Result<NotificationPreferences | null>> {
  const { data, error } = await supabase.from('notification_preferences').select('*').maybeSingle();
  if (error) return { ok: false, error: friendly(error.message) };
  if (!data) return { ok: true, data: null };
  return {
    ok: true,
    data: {
      quietHoursStart: data.quiet_hours_start ? String(data.quiet_hours_start).slice(0, 5) : null,
      quietHoursEnd: data.quiet_hours_end ? String(data.quiet_hours_end).slice(0, 5) : null,
      timezone: data.timezone,
      mutedCategories: data.muted_categories ?? [],
    },
  };
}

export async function saveNotificationPreferences(userId: string, prefs: NotificationPreferences): Promise<Result<null>> {
  const { error } = await supabase.from('notification_preferences').upsert({
    user_id: userId,
    quiet_hours_start: prefs.quietHoursStart,
    quiet_hours_end: prefs.quietHoursEnd,
    timezone: prefs.timezone,
    muted_categories: prefs.mutedCategories,
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: null };
}
