import { tr } from '../i18n/tr';
import { newUuid } from '../id';
import { mark, type WorkoutData } from '../workout/state';
import { BODY_REGIONS, RED_FLAGS, TAG_ORDER, type InjuryEpisode, type RedFlag, type SymptomLog } from './model';

/**
 * The athlete's own rehab records: episodes and symptom logs, local-first
 * like the rest of their data. Clinician records are not written here.
 */

type Result<T> = ({ ok: true; data: WorkoutData } & T) | { ok: false; error: string };

const localDateOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export type EpisodeInput = Pick<InjuryEpisode, 'bodyRegion' | 'laterality' | 'onsetType' | 'reportedProblem' | 'affectedActivities'> & { onsetDate?: string };

function checkEpisode(input: Partial<EpisodeInput>): string | undefined {
  if (input.reportedProblem !== undefined && !input.reportedProblem.trim()) return tr('Describe what is going on, in your own words.', 'Beschreib in eigenen Worten, was los ist.');
  if (input.reportedProblem !== undefined && input.reportedProblem.length > 500) return tr('Keep the description under 500 characters.', 'Halte die Beschreibung unter 500 Zeichen.');
  if (input.bodyRegion !== undefined && !BODY_REGIONS.includes(input.bodyRegion)) return tr('Choose where it is.', 'Wähle, wo es ist.');
  if (input.affectedActivities?.some((t) => !TAG_ORDER.includes(t))) return tr('Unknown activity.', 'Unbekannte Aktivität.');
  if (input.onsetDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.onsetDate)) return tr('The date is not valid.', 'Das Datum ist ungültig.');
  return undefined;
}

export function addEpisode(data: WorkoutData, input: EpisodeInput, nowMs: number): Result<{ episodeId: string }> {
  const error = checkEpisode(input);
  if (error) return { ok: false, error };
  const episodeId = newUuid();
  const episode: InjuryEpisode = { ...input, reportedProblem: input.reportedProblem.trim(), id: episodeId, status: 'reported', createdAt: nowMs, updatedAt: nowMs };
  if (!episode.onsetDate) delete episode.onsetDate;
  return { ok: true, episodeId, data: { ...data, episodes: { ...data.episodes, [episodeId]: episode }, dirty: mark(data.dirty, { episodes: [episodeId] }) } };
}

export function updateEpisode(data: WorkoutData, episodeId: string, patch: Partial<EpisodeInput & Pick<InjuryEpisode, 'status'>>, nowMs: number): Result<object> {
  const episode = data.episodes[episodeId];
  if (!episode || episode.deletedAt) return { ok: false, error: tr('This case no longer exists.', 'Diesen Fall gibt es nicht mehr.') };
  const error = checkEpisode(patch);
  if (error) return { ok: false, error };
  const next = { ...episode, ...patch, updatedAt: nowMs };
  return { ok: true, data: { ...data, episodes: { ...data.episodes, [episodeId]: next }, dirty: mark(data.dirty, { episodes: [episodeId] }) } };
}

export function removeEpisode(data: WorkoutData, episodeId: string, nowMs: number): WorkoutData {
  const episode = data.episodes[episodeId];
  if (!episode) return data;
  return { ...data, episodes: { ...data.episodes, [episodeId]: { ...episode, deletedAt: nowMs, updatedAt: nowMs } }, dirty: mark(data.dirty, { episodes: [episodeId] }) };
}

export type SymptomInput = { intensity: number; function?: number; context?: string; redFlags?: RedFlag[]; note?: string; loggedAt?: number };

export function addSymptomLog(data: WorkoutData, episodeId: string, input: SymptomInput, nowMs: number): Result<{ logId: string }> {
  if (!data.episodes[episodeId] || data.episodes[episodeId].deletedAt) return { ok: false, error: tr('This case no longer exists.', 'Diesen Fall gibt es nicht mehr.') };
  const inRange = (v: number | undefined) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 10);
  if (!inRange(input.intensity) || !inRange(input.function)) return { ok: false, error: tr('Use a whole number from 0 to 10.', 'Verwende eine ganze Zahl von 0 bis 10.') };
  const redFlags = (input.redFlags ?? []).filter((f) => f in RED_FLAGS);
  const at = input.loggedAt ?? nowMs;
  if (at > nowMs + 60_000) return { ok: false, error: tr('The time cannot be in the future.', 'Die Zeit kann nicht in der Zukunft liegen.') };
  const logId = newUuid();
  const log: SymptomLog = {
    id: logId,
    episodeId,
    loggedAt: at,
    localDate: localDateOf(at),
    intensity: input.intensity,
    ...(input.function !== undefined ? { function: input.function } : {}),
    ...(input.context?.trim() ? { context: input.context.trim().slice(0, 200) } : {}),
    redFlags,
    ...(input.note?.trim() ? { note: input.note.trim().slice(0, 1000) } : {}),
    createdAt: nowMs,
    updatedAt: nowMs,
  };
  return { ok: true, logId, data: { ...data, symptomLogs: { ...data.symptomLogs, [logId]: log }, dirty: mark(data.dirty, { symptomLogs: [logId] }) } };
}

export function removeSymptomLog(data: WorkoutData, logId: string, nowMs: number): WorkoutData {
  const log = data.symptomLogs[logId];
  if (!log) return data;
  return { ...data, symptomLogs: { ...data.symptomLogs, [logId]: { ...log, deletedAt: nowMs, updatedAt: nowMs } }, dirty: mark(data.dirty, { symptomLogs: [logId] }) };
}
