import { supabase } from '../supabase';
import { parseClinical, type ClinicalJson } from '../sync/mappers';
import type { WorkoutContent } from '../workout/model';
import type { ActivityTag, ClinicalRecords, EpisodeStatus, InjuryEpisode, RestrictionRule, RtsStage } from './model';

/**
 * Client for the rehab functions in supabase/migrations/0011_rehab.sql.
 * Clinician actions and case sharing need a connection; the athlete's own
 * episodes and symptom logs are local-first and sync like other data.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'You need to be signed in.',
  FORBIDDEN: 'You do not have access to this case.',
  EPISODE_NOT_FOUND: 'This case is not on the server yet. Wait a moment for it to sync, then try again.',
  ONLY_PHYSIOTHERAPISTS: 'Cases can be shared only with a physiotherapist.',
  CLINICIAN_NOT_VERIFIED: 'Return-to-sport decisions need a verified clinician. Your registration has not been verified yet.',
  CRITERIA_REQUIRED: 'Write down the criteria the decision is based on.',
  PLAN_INVALID: 'A plan needs a title and at least one exercise.',
  DATE_IN_PAST: 'The end date cannot be in the past.',
};

function friendly(message: string | undefined): string {
  if (!message) return 'Something went wrong. Try again.';
  const code = Object.keys(MESSAGES).find((k) => message.includes(k));
  if (code) return MESSAGES[code];
  if (/check constraint/i.test(message)) return 'Some of that is not valid. Check the entries.';
  if (/fetch|network/i.test(message)) return 'No connection. This needs to be online.';
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

// ---------------------------------------------------------------- athlete

export const shareCase = (episodeId: string, relationshipId: string) => call<null>('share_case', { p_episode: episodeId, p_relationship: relationshipId });
export const revokeCase = (episodeId: string, relationshipId: string) => call<null>('revoke_case', { p_episode: episodeId, p_relationship: relationshipId });

/** Which physiotherapists each of the caller's cases is shared with (open access rows). */
export async function caseSharing(): Promise<Result<{ episode_id: string; relationship_id: string }[]>> {
  const { data, error } = await supabase.from('rehab_case_access').select('episode_id, relationship_id').is('revoked_at', null);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: data as { episode_id: string; relationship_id: string }[] };
}

// -------------------------------------------------------------- clinician

export type SharedCase = {
  episode: Pick<InjuryEpisode, 'id' | 'bodyRegion' | 'laterality' | 'onsetType' | 'reportedProblem' | 'affectedActivities' | 'status'> & { onsetDate?: string };
  athlete: { id: string; name: string | null };
  relationshipId: string;
  symptoms: { loggedAt: number; intensity: number; function?: number; context?: string; redFlags: string[]; note?: string }[];
  records: ClinicalRecords;
};

type CaseRow = {
  episode: { id: string; body_region: InjuryEpisode['bodyRegion']; laterality: InjuryEpisode['laterality']; onset_date: string | null; onset_type: InjuryEpisode['onsetType']; reported_problem: string; affected_activities: ActivityTag[]; status: EpisodeStatus };
  athlete: { id: string; name: string | null };
  relationship_id: string;
  symptoms: { logged_at: string; intensity: number; function_score: number | null; context: string | null; red_flags: string[]; note: string | null }[];
} & ClinicalJson;

export async function listCases(): Promise<Result<{ cases: SharedCase[]; verified: boolean }>> {
  const res = await call<{ cases: CaseRow[]; verified: boolean }>('list_cases');
  if (!res.ok) return res;
  const now = Date.now();
  return {
    ok: true,
    data: {
      verified: res.data.verified,
      cases: res.data.cases.map((c) => ({
        episode: {
          id: c.episode.id,
          bodyRegion: c.episode.body_region,
          laterality: c.episode.laterality,
          ...(c.episode.onset_date ? { onsetDate: String(c.episode.onset_date).slice(0, 10) } : {}),
          onsetType: c.episode.onset_type,
          reportedProblem: c.episode.reported_problem,
          affectedActivities: c.episode.affected_activities ?? [],
          status: c.episode.status,
        },
        athlete: c.athlete,
        relationshipId: c.relationship_id,
        symptoms: c.symptoms.map((s) => ({
          loggedAt: new Date(s.logged_at).getTime(),
          intensity: s.intensity,
          ...(s.function_score !== null ? { function: s.function_score } : {}),
          ...(s.context ? { context: s.context } : {}),
          redFlags: s.red_flags ?? [],
          ...(s.note ? { note: s.note } : {}),
        })),
        records: parseClinical(c, now),
      })),
    },
  };
}

export const addRestriction = (episodeId: string, tags: ActivityTag[], rule: RestrictionRule, note: string, expiresOn: string | null) =>
  call<string>('add_restriction', { p_episode: episodeId, p_tags: tags, p_rule: rule, p_note: note.trim() || null, p_expires_on: expiresOn });

export const liftRestriction = (restrictionId: string) => call<null>('lift_restriction', { p_restriction: restrictionId });

export const publishRehabPlan = (episodeId: string, content: WorkoutContent, sessionsPerWeek: number | null, notes: string) =>
  call<string>('publish_rehab_plan', { p_episode: episodeId, p_content: content, p_sessions_per_week: sessionsPerWeek, p_notes: notes.trim() || null });

export const addCaseNote = (episodeId: string, body: string) => call<string>('add_case_note', { p_episode: episodeId, p_body: body });

export const recordRtsDecision = (episodeId: string, stage: RtsStage, criteria: string) => call<string>('record_rts_decision', { p_episode: episodeId, p_stage: stage, p_criteria: criteria });
