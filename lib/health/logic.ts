import { strings, locale } from '../strings';
import type { BlockResult, ScheduledWorkout, Sport, WorkoutContent, WorkoutVersion } from '../workout/model';
import { localDateOf, METRIC_ORDER, METRICS, type ExternalActivity, type HealthObservation, type MetricKey } from './model';

/**
 * Deterministic rules for activities and measurements: duplicate
 * detection, matching an activity to a planned workout, turning it into a
 * session result, and personal baselines. Nothing here decides on the
 * athlete's behalf; every match and every duplicate is a suggestion to
 * confirm.
 */

// ------------------------------------------------------------ duplicates

const FAMILY: Record<Sport, string> = {
  running: 'run',
  cycling: 'ride',
  swimming: 'swim',
  triathlon: 'multi',
  endurance: 'endurance',
  crossfit: 'gym',
  strength: 'gym',
  hiit: 'gym',
  yoga: 'mind',
  other: 'other',
};

const ENDURANCE_FAMILIES = new Set(['run', 'ride', 'swim', 'multi', 'endurance']);

/** Whether two sports could describe the same session. Generic endurance and triathlon match any single endurance sport. */
function sameFamily(a: Sport, b: Sport): boolean {
  if (a === 'other' || b === 'other') return true;
  const [fa, fb] = [FAMILY[a], FAMILY[b]];
  if (fa === fb) return true;
  const general = (f: string) => f === 'endurance' || f === 'multi';
  return (general(fa) || general(fb)) && ENDURANCE_FAMILIES.has(fa) && ENDURANCE_FAMILIES.has(fb);
}

const near = (a: number, b: number, relative: number, absolute: number) => Math.abs(a - b) <= Math.max(absolute, Math.max(a, b) * relative);

/**
 * Other activities that are probably the same effort recorded twice, for
 * example by a watch and again by a phone app. Never merged automatically:
 * the athlete confirms.
 */
export function duplicateCandidates(activity: ExternalActivity, others: ExternalActivity[]): ExternalActivity[] {
  return others.filter(
    (o) =>
      o.id !== activity.id &&
      !o.deletedAt &&
      o.status !== 'duplicate' &&
      o.externalId !== activity.externalId &&
      sameFamily(o.sport, activity.sport) &&
      Math.abs(o.startedAt - activity.startedAt) <= 5 * 60_000 &&
      near(o.elapsedSeconds, activity.elapsedSeconds, 0.05, 60) &&
      (o.distanceMeters === undefined || activity.distanceMeters === undefined || near(o.distanceMeters, activity.distanceMeters, 0.05, 50))
  );
}

// -------------------------------------------------------------- matching

export type MatchCandidate = { entry: ScheduledWorkout; version: WorkoutVersion; confidence: 'likely' | 'possible'; reason: string };

/** Planned workouts on the activity's day that it could be the result of, most likely first. */
export function matchCandidates(activity: ExternalActivity, scheduled: ScheduledWorkout[], versions: Record<string, WorkoutVersion>): MatchCandidate[] {
  const day = localDateOf(activity.startedAt);
  const candidates = scheduled
    .filter((e) => !e.deletedAt && e.status === 'planned' && localDateOf(e.scheduledAt) === day && versions[e.versionId]?.status === 'published')
    .map((entry) => {
      const version = versions[entry.versionId];
      const sportOk = sameFamily(version.content.sport, activity.sport);
      const hours = Math.abs(entry.scheduledAt - activity.startedAt) / 3_600_000;
      return { entry, version, sportOk, hours };
    })
    .sort((a, b) => Number(b.sportOk) - Number(a.sportOk) || a.hours - b.hours);

  return candidates.map((c, i) => {
    const likely = i === 0 && c.sportOk && c.hours <= 3 && candidates.filter((x) => x.sportOk).length === 1;
    const when = c.hours < 1 ? strings.matchWithinHour : strings.matchHoursApart(Math.round(c.hours));
    return {
      entry: c.entry,
      version: c.version,
      confidence: likely ? 'likely' : 'possible',
      reason: c.sportOk ? `${strings.matchSameDay} · ${when}` : `${strings.matchSameDay} · ${strings.matchDifferentSport}`,
    };
  });
}

// --------------------------------------------- activity -> session result

/**
 * What an activity contributes to the session of a planned workout. A
 * single continuous section takes the activity's time and distance; a
 * workout with more structure than the file can describe gets its sections
 * marked done without invented scores.
 */
export function blockResultsFromActivity(content: WorkoutContent, activity: ExternalActivity): BlockResult[] {
  const seconds = activity.movingSeconds ?? activity.elapsedSeconds;
  if (content.blocks.length === 1 && content.blocks[0].config.format === 'continuous') {
    const block = content.blocks[0];
    return [
      {
        blockId: block.id,
        status: 'completed',
        elapsedSeconds: seconds,
        score: activity.distanceMeters ? { type: 'distance', meters: activity.distanceMeters } : { type: 'completed' },
        stepResults: [],
      },
    ];
  }
  return content.blocks.map((b) => ({ blockId: b.id, status: 'completed' as const, stepResults: [] }));
}

const SPORT_STEP: Partial<Record<Sport, { name: string; activityId: string }>> = {
  running: { name: 'Run', activityId: 'run' },
  cycling: { name: 'Cycling', activityId: 'cycling' },
  swimming: { name: 'Swim', activityId: 'swim' },
  endurance: { name: 'Walk', activityId: 'walk' },
};

/**
 * The workout an unplanned activity is logged as: one continuous section
 * with no targets, because nothing was prescribed. The activity's numbers
 * go into the session as what actually happened.
 */
export function workoutForActivity(activity: ExternalActivity, newId: () => string): WorkoutContent {
  const step = SPORT_STEP[activity.sport] ?? { name: activity.name?.trim() || strings.activityFallbackName, activityId: null };
  const title = activity.name?.trim() || `${step.name} · ${new Date(activity.startedAt).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`;
  return {
    title,
    sport: activity.sport,
    blocks: [
      {
        id: newId(),
        type: ['running', 'cycling', 'swimming', 'endurance', 'triathlon'].includes(activity.sport) ? 'endurance' : 'conditioning',
        config: { format: 'continuous' },
        steps: [{ kind: 'exercise', id: newId(), name: step.name, activityId: step.activityId, prescription: {} }],
      },
    ],
  };
}

// ------------------------------------------------------------- baselines

export const BASELINE_POLICY = { version: 'baseline_v1', windowDays: 28, minDays: 7 } as const;

export type Baseline =
  | { status: 'insufficient'; metric: MetricKey; days: number; needed: number; version: string }
  | {
      status: 'ready';
      metric: MetricKey;
      /** Median of one value per day over the window: robust to the odd bad night or typo. */
      median: number;
      /** Median absolute deviation, the athlete's own normal spread. */
      spread: number;
      days: number;
      method?: string;
      version: string;
    };

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** The latest value per local day, oldest day first. */
function dailyValues(observations: HealthObservation[], metric: MetricKey, method?: string): { date: string; value: number }[] {
  const byDay = new Map<string, HealthObservation>();
  for (const o of observations) {
    if (o.deletedAt || o.metric !== metric || (method !== undefined && o.method !== method)) continue;
    const prev = byDay.get(o.localDate);
    if (!prev || o.observedAt > prev.observedAt) byDay.set(o.localDate, o);
  }
  return [...byDay.values()].sort((a, b) => (a.localDate < b.localDate ? -1 : 1)).map((o) => ({ date: o.localDate, value: o.value }));
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDateOf(d.getTime());
}

/**
 * The athlete's own normal for a metric, from the days before `asOfDate`.
 * Needs at least `minDays` days with a value inside `windowDays`; until
 * then there is no baseline, and nothing is compared against one.
 * HRV only compares values taken with the same method.
 */
export function personalBaseline(observations: HealthObservation[], metric: MetricKey, asOfDate: string, method?: string): Baseline {
  const from = shiftDate(asOfDate, -BASELINE_POLICY.windowDays);
  const days = dailyValues(observations, metric, method).filter((d) => d.date >= from && d.date < asOfDate);
  if (days.length < BASELINE_POLICY.minDays) {
    return { status: 'insufficient', metric, days: days.length, needed: BASELINE_POLICY.minDays, version: BASELINE_POLICY.version };
  }
  const values = days.map((d) => d.value);
  const m = median(values);
  return { status: 'ready', metric, median: m, spread: median(values.map((v) => Math.abs(v - m))), days: days.length, method, version: BASELINE_POLICY.version };
}

export type MetricToday = {
  metric: MetricKey;
  latest?: HealthObservation;
  baseline: Baseline;
  /** Latest minus baseline median; only when there is a baseline and a value today or recently. */
  difference?: number;
  /** Whether the difference is larger than the athlete's usual day-to-day spread. Context, not a judgement. */
  unusual?: boolean;
};

/** Each metric's most recent value and how it compares with the athlete's own normal. */
export function metricOverview(observations: HealthObservation[], today: string): MetricToday[] {
  return METRIC_ORDER.map((metric) => {
    const live = observations.filter((o) => !o.deletedAt && o.metric === metric);
    const latest = live.reduce<HealthObservation | undefined>((a, o) => (!a || o.observedAt > a.observedAt ? o : a), undefined);
    const baseline = personalBaseline(observations, metric, latest ? latest.localDate : today, latest?.method);
    if (!latest || baseline.status !== 'ready') return { metric, latest, baseline };
    const difference = latest.value - baseline.median;
    return { metric, latest, baseline, difference, unusual: Math.abs(difference) > Math.max(baseline.spread * 2, METRICS[metric].max * 0.01) };
  });
}

/** A metric's daily values, for charts. */
export function metricSeries(observations: HealthObservation[], metric: MetricKey, method?: string) {
  return dailyValues(observations, metric, method);
}
