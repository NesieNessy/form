import type { Benchmark, Profile } from '../athlete/model';
import { supabase } from '../supabase';
import {
  rowToBenchmark,
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
  counterpart_name: string | null;
  athlete_id: string;
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
};

function friendly(message: string | undefined): string {
  if (!message) return 'Something went wrong. Try again.';
  const code = Object.keys(MESSAGES).find((key) => message.includes(key));
  if (code) return MESSAGES[code];
  if (/fetch|network/i.test(message)) return 'No connection. Sharing settings need to be online.';
  return 'Something went wrong. Try again.';
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<Result<T>> {
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
