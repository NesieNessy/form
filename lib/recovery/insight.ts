import { personalBaseline } from '../health/logic';
import type { HealthObservation, MetricKey } from '../health/model';
import type { ScheduledWorkout, Session } from '../workout/model';
import { sessionDurationSeconds } from '../workout/scoring';
import type { Insight, OptionKind, Signal } from './model';

/**
 * The recovery rules, `recovery_v1`. Deterministic and documented here:
 *
 * Measurements (only with a personal baseline, see BASELINE_POLICY, and a
 * value from today):
 * - resting heart rate above normal by more than max(2 x spread, 3 bpm)
 * - HRV below normal by more than max(2 x spread, 5 % of normal), same method
 * - sleep below normal by more than max(2 x spread, 45 min)
 * Each is "strong" past three times that margin.
 *
 * Check-in (0 to 10): fatigue, soreness, stress of 7 or more are worse,
 * 9 or more strong; energy of 3 or less is worse, 1 or less strong. 3 or
 * less (energy 7 or more) counts as better.
 *
 * Training log: the last 7 days' training minutes above 1.5 x the weekly
 * average of the 21 days before, when those 21 days hold at least 3 sessions.
 *
 * Status: unwell if reported; limited_data with no check-in and no usable
 * measurement; conflicting when a measurement is worse but the check-in is
 * clearly fine (go by how you feel); attention with two worse signals, or
 * one strong check-in signal, or a load spike plus one worse signal;
 * otherwise steady. Subjective feeling is never overruled by a device.
 *
 * Options only for a planned workout today and only when status is
 * attention (or unwell: rest or move it): at most three, never a forced one.
 */
export const RECOVERY_RULES = { version: 'recovery_v1' } as const;

const DAY = 86_400_000;

function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Inputs = {
  today: string;
  nowMs: number;
  observations: HealthObservation[];
  sessions: Session[];
  scheduled: ScheduledWorkout[];
};

function todays(observations: HealthObservation[], metric: MetricKey, today: string): HealthObservation | undefined {
  return observations
    .filter((o) => !o.deletedAt && o.metric === metric && o.localDate === today)
    .reduce<HealthObservation | undefined>((a, o) => (!a || o.observedAt > a.observedAt ? o : a), undefined);
}

function measured(observations: HealthObservation[], metric: 'resting_hr_bpm' | 'hrv_ms' | 'sleep_duration_min', today: string, missing: string[]): Signal | undefined {
  const label = { resting_hr_bpm: 'resting heart rate', hrv_ms: 'HRV', sleep_duration_min: 'sleep' }[metric];
  const value = todays(observations, metric, today);
  if (!value) {
    missing.push(`no ${label} today`);
    return undefined;
  }
  const baseline = personalBaseline(observations, metric, today, value.method);
  if (baseline.status !== 'ready') {
    missing.push(`${label}: your normal is not known yet`);
    return undefined;
  }
  const diff = value.value - baseline.median;
  const key = ({ resting_hr_bpm: 'resting_hr', hrv_ms: 'hrv', sleep_duration_min: 'sleep' } as const)[metric];
  // Worse is up for resting heart rate, down for HRV and sleep.
  const adverse = metric === 'resting_hr_bpm' ? diff : -diff;
  const margin = metric === 'resting_hr_bpm' ? Math.max(2 * baseline.spread, 3) : metric === 'hrv_ms' ? Math.max(2 * baseline.spread, baseline.median * 0.05) : Math.max(2 * baseline.spread, 45);
  const fmt = (v: number) => (metric === 'sleep_duration_min' ? `${Math.floor(v / 60)} h ${String(Math.round(v % 60)).padStart(2, '0')} min` : `${Math.round(v)} ${metric === 'hrv_ms' ? 'ms' : 'bpm'}`);
  const detail = `${fmt(value.value)}, your normal ${fmt(baseline.median)}`;
  if (adverse > margin) return { key, direction: 'worse', strength: adverse > 3 * margin ? 'strong' : 'mild', source: 'measurement', detail };
  if (-adverse > margin) return { key, direction: 'better', strength: 'mild', source: 'measurement', detail };
  return { key, direction: 'usual', strength: 'mild', source: 'measurement', detail };
}

function checkInSignal(observations: HealthObservation[], metric: 'subjective_fatigue' | 'subjective_soreness' | 'subjective_stress' | 'subjective_energy', today: string): Signal | undefined {
  const o = todays(observations, metric, today);
  if (!o) return undefined;
  const key = ({ subjective_fatigue: 'fatigue', subjective_soreness: 'soreness', subjective_stress: 'stress', subjective_energy: 'energy' } as const)[metric];
  // Energy runs the other way: low is worse.
  const v = metric === 'subjective_energy' ? 10 - o.value : o.value;
  const detail = `${o.value} of 10`;
  if (v >= 7) return { key, direction: 'worse', strength: v >= 9 ? 'strong' : 'mild', source: 'check_in', detail };
  if (v <= 3) return { key, direction: 'better', strength: 'mild', source: 'check_in', detail };
  return { key, direction: 'usual', strength: 'mild', source: 'check_in', detail };
}

function loadSignal(sessions: Session[], nowMs: number): Signal | undefined {
  const minutes = (from: number, to: number) =>
    sessions
      .filter((s) => !s.deletedAt && s.status === 'completed' && s.startedAt >= from && s.startedAt < to)
      .reduce((sum, s) => sum + (sessionDurationSeconds(s) ?? 0) / 60, 0);
  const before = sessions.filter((s) => !s.deletedAt && s.status === 'completed' && s.startedAt >= nowMs - 28 * DAY && s.startedAt < nowMs - 7 * DAY);
  if (before.length < 3) return undefined;
  const last7 = minutes(nowMs - 7 * DAY, nowMs);
  const weekly = minutes(nowMs - 28 * DAY, nowMs - 7 * DAY) / 3;
  if (weekly <= 0) return undefined;
  const detail = `${Math.round(last7)} min in 7 days, usually about ${Math.round(weekly)}`;
  if (last7 > 1.5 * weekly && last7 >= 120) return { key: 'load', direction: 'worse', strength: last7 > 2 * weekly ? 'strong' : 'mild', source: 'training_log', detail };
  return { key: 'load', direction: 'usual', strength: 'mild', source: 'training_log', detail };
}

export function recoveryInsight({ today, nowMs, observations, sessions, scheduled }: Inputs): Insight {
  const missing: string[] = [];
  const objective = (['resting_hr_bpm', 'hrv_ms', 'sleep_duration_min'] as const).map((m) => measured(observations, m, today, missing)).filter((s): s is Signal => !!s);
  const checkIn = (['subjective_fatigue', 'subjective_soreness', 'subjective_stress', 'subjective_energy'] as const).map((m) => checkInSignal(observations, m, today)).filter((s): s is Signal => !!s);
  if (checkIn.length === 0) missing.push('no check-in today');
  const load = loadSignal(sessions, nowMs);
  const signals = [...checkIn, ...objective, ...(load ? [load] : [])];

  const planned = scheduled
    .filter((s) => !s.deletedAt && s.status === 'planned' && localDate(s.scheduledAt) === today)
    .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
  const base = { version: RECOVERY_RULES.version, localDate: today, signals, missing, scheduledId: planned?.id };

  const unwell = todays(observations, 'unwell', today);
  if (unwell && unwell.value >= 1) return { ...base, status: 'unwell', options: planned ? ['rest', 'reschedule'] : [] };

  if (checkIn.length === 0 && objective.length === 0) return { ...base, status: 'limited_data', options: [] };

  const worse = signals.filter((s) => s.direction === 'worse');
  const objectiveWorse = objective.filter((s) => s.direction === 'worse');
  const feelsFine = checkIn.length >= 2 && checkIn.every((s) => s.direction !== 'worse') && checkIn.filter((s) => s.direction === 'better').length >= 2;
  if (objectiveWorse.length > 0 && feelsFine) return { ...base, status: 'conflicting', options: [] };

  const strongFeeling = checkIn.some((s) => s.direction === 'worse' && s.strength === 'strong');
  // A load spike counts as one of the worse signals, so it needs company to matter.
  const attention = worse.length >= 2 || strongFeeling;
  if (!attention) return { ...base, status: 'steady', options: [] };

  let options: OptionKind[] = [];
  if (planned) {
    const heavy = strongFeeling || worse.length >= 3 || worse.some((s) => s.strength === 'strong');
    options = heavy ? ['rest', 'lighter', 'reschedule'] : ['lighter', 'shorten', 'keep'];
  }
  return { ...base, status: 'attention', options };
}
