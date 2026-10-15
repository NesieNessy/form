import { addObservation } from '../health/state';
import { newUuid } from '../id';
import { applyAdaptation, mark, moveScheduled, skipScheduled, type WorkoutData } from '../workout/state';
import { lighter, shortened } from './adjust';
import { recoveryInsight } from './insight';
import type { CheckIn, Insight, OptionKind, RecoveryDay } from './model';

const DAY = 86_400_000;

export function localDateOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function insightFor(data: WorkoutData, nowMs: number): Insight {
  return recoveryInsight({
    today: localDateOf(nowMs),
    nowMs,
    observations: Object.values(data.observations),
    sessions: Object.values(data.sessions),
    scheduled: Object.values(data.scheduled),
  });
}

/** Keeps today's summary (status and which signals, never values) up to date. */
export function recordDay(data: WorkoutData, insight: Insight, nowMs: number, decision?: RecoveryDay['decision']): WorkoutData {
  const existing = Object.values(data.recovery).find((d) => d.localDate === insight.localDate && !d.deletedAt);
  const day: RecoveryDay = {
    id: existing?.id ?? newUuid(),
    localDate: insight.localDate,
    status: insight.status,
    signals: insight.signals.map((s) => ({ key: s.key, direction: s.direction })),
    ruleVersion: insight.version,
    ...(decision ?? existing?.decision ? { decision: decision ?? existing?.decision } : {}),
    createdAt: existing?.createdAt ?? nowMs,
    updatedAt: nowMs,
  };
  return { ...data, recovery: { ...data.recovery, [day.id]: day }, dirty: mark(data.dirty, { recovery: [day.id] }) };
}

/** Stores today's check-in as measurements (each answer is optional) and refreshes the day's summary. */
export function saveCheckIn(data: WorkoutData, checkIn: CheckIn, nowMs: number): WorkoutData {
  let next = data;
  const add = (metric: 'subjective_fatigue' | 'subjective_soreness' | 'subjective_stress' | 'subjective_energy' | 'unwell', value: number | undefined) => {
    if (value === undefined) return;
    next = addObservation(next, { metric, value: Math.max(0, Math.min(metric === 'unwell' ? 1 : 10, Math.round(value))), unit: '', observedAt: nowMs }, nowMs).data;
  };
  add('subjective_fatigue', checkIn.fatigue);
  add('subjective_soreness', checkIn.soreness);
  add('subjective_stress', checkIn.stress);
  add('subjective_energy', checkIn.energy);
  // Always stored, so answering "no" later the same day replaces an earlier "yes".
  add('unwell', checkIn.unwell ? 1 : 0);
  return recordDay(next, insightFor(next, nowMs), nowMs);
}

/** The workout content an option would produce, for showing the changes before approval. */
export function previewOption(data: WorkoutData, scheduledId: string, option: 'shorten' | 'lighter') {
  const entry = data.scheduled[scheduledId];
  const version = entry ? data.versions[entry.versionId] : undefined;
  if (!version) return undefined;
  return { before: version.content, after: option === 'shorten' ? shortened(version.content, newUuid) : lighter(version.content, newUuid) };
}

/**
 * Applies the option the athlete chose. Only this explicit choice changes the
 * plan; "keep" changes nothing and is recorded like the others.
 */
export function chooseOption(data: WorkoutData, insight: Insight, option: OptionKind, nowMs: number): WorkoutData {
  const id = insight.scheduledId;
  if (option !== 'keep' && (!id || !insight.options.includes(option))) return data;
  let next = data;
  if (id && (option === 'shorten' || option === 'lighter')) {
    const preview = previewOption(data, id, option);
    if (!preview) return data;
    next = applyAdaptation(next, id, preview.after, nowMs);
  } else if (id && option === 'reschedule') {
    next = moveScheduled(next, id, data.scheduled[id].scheduledAt + DAY, nowMs);
  } else if (id && option === 'rest') {
    next = skipScheduled(next, id, nowMs);
  }
  return recordDay(next, insight, nowMs, { option, ...(id ? { scheduledId: id } : {}), decidedAt: nowMs });
}
