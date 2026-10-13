import { getActivity, normalizeActivityName } from './catalog';
import { formatClock, formatDistance, formatKg } from './format';
import { exerciseSteps, type ScheduledWorkout, type Session } from './model';
import { volumeKg } from './scoring';

/**
 * Deterministic training metrics computed from completed sessions. Every
 * number here traces back to logged results; where there is not enough data
 * the function returns undefined or an empty list instead of an estimate.
 */

export type RangeKey = '4w' | '3m' | '1y' | 'all';

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = { '4w': 28, '3m': 91, '1y': 365 };

export function rangeStartMs(range: RangeKey, nowMs: number): number {
  return range === 'all' ? 0 : nowMs - RANGE_DAYS[range] * DAY_MS;
}

export function completedSessions(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.status === 'completed' && !s.deletedAt)
    .sort((a, b) => a.startedAt - b.startedAt);
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// ---------------------------------------------------------------- week

export type WeekDay = { day: string; date: number; atMs: number; done: boolean; planned: boolean; today: boolean };

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The current Monday-to-Sunday week. */
export function weekSummary(sessions: Session[], scheduled: ScheduledWorkout[], nowMs: number): { days: WeekDay[]; completedCount: number } {
  const today = startOfDay(nowMs);
  const offsetFromMonday = (new Date(today).getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - offsetFromMonday);

  const done = completedSessions(sessions);
  const planned = scheduled.filter((s) => !s.deletedAt && s.status === 'planned');

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const atMs = d.getTime();
    return {
      day: WEEKDAY_SHORT[d.getDay()],
      date: d.getDate(),
      atMs,
      done: done.some((s) => startOfDay(s.startedAt) === atMs),
      planned: planned.some((s) => startOfDay(s.scheduledAt) === atMs),
      today: atMs === today,
    };
  });

  const weekEnd = days[6].atMs + DAY_MS;
  const completedCount = done.filter((s) => s.startedAt >= days[0].atMs && s.startedAt < weekEnd).length;
  return { days, completedCount };
}

// ------------------------------------------------------------ strength

export type LiftPoint = { label: string; value: number; atMs: number };

export type LiftSeries = {
  key: string;
  name: string;
  points: LiftPoint[];
  current: number;
  deltaFromStart: number;
};

type LiftEvent = { key: string; name: string; atMs: number; kg: number };

/** Best completed load per lift per session, oldest first. */
function liftEvents(sessions: Session[]): LiftEvent[] {
  const events: LiftEvent[] = [];
  for (const session of completedSessions(sessions)) {
    const steps = new Map(session.prescribed.blocks.flatMap((b) => exerciseSteps(b.steps)).map((s) => [s.id, s]));
    const best = new Map<string, LiftEvent>();
    for (const br of session.blockResults) {
      for (const r of br.stepResults) {
        if (!r.completed || typeof r.loadKg !== 'number' || r.loadKg <= 0) continue;
        const step = steps.get(r.stepId);
        if (!step) continue;
        const activity = getActivity(step.activityId);
        const key = activity ? activity.id : `name:${normalizeActivityName(step.name)}`;
        const prev = best.get(key);
        if (!prev || r.loadKg > prev.kg) {
          best.set(key, { key, name: activity?.name ?? step.name, atMs: session.startedAt, kg: r.loadKg });
        }
      }
    }
    events.push(...best.values());
  }
  return events;
}

export function liftSeries(sessions: Session[], range: RangeKey, nowMs: number): LiftSeries[] {
  const from = rangeStartMs(range, nowMs);
  const byKey = new Map<string, LiftSeries>();
  for (const e of liftEvents(sessions)) {
    if (e.atMs < from) continue;
    let series = byKey.get(e.key);
    if (!series) {
      series = { key: e.key, name: e.name, points: [], current: 0, deltaFromStart: 0 };
      byKey.set(e.key, series);
    }
    series.points.push({ label: shortDate(e.atMs), value: e.kg, atMs: e.atMs });
  }
  const all = [...byKey.values()];
  for (const s of all) {
    s.current = s.points[s.points.length - 1].value;
    s.deltaFromStart = s.current - s.points[0].value;
  }
  return all.sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
}

/** Mean relative change across lifts that have at least two data points. */
export function strengthProgressPct(lifts: LiftSeries[]): number | undefined {
  const changes = lifts
    .filter((l) => l.points.length >= 2 && l.points[0].value > 0)
    .map((l) => (l.current - l.points[0].value) / l.points[0].value);
  if (changes.length === 0) return undefined;
  return Math.round((changes.reduce((a, b) => a + b, 0) / changes.length) * 100);
}

export type PersonalRecord = { key: string; name: string; atMs: number; kg: number; previousKg: number };

/** A record is a load above the lift's earlier best. A first-ever entry has nothing to beat, so it is not one. */
export function personalRecords(sessions: Session[]): PersonalRecord[] {
  const best = new Map<string, number>();
  const records: PersonalRecord[] = [];
  for (const e of liftEvents(sessions)) {
    const prev = best.get(e.key);
    if (prev !== undefined && e.kg > prev) records.push({ key: e.key, name: e.name, atMs: e.atMs, kg: e.kg, previousKg: prev });
    if (prev === undefined || e.kg > prev) best.set(e.key, e.kg);
  }
  return records;
}

// ----------------------------------------------------------- endurance

export type EnduranceEffort = { atMs: number; meters: number; seconds: number };

export function enduranceEfforts(sessions: Session[]): EnduranceEffort[] {
  const efforts: EnduranceEffort[] = [];
  for (const session of completedSessions(sessions)) {
    for (const br of session.blockResults) {
      const block = session.prescribed.blocks.find((b) => b.id === br.blockId);
      if (!block || block.config.format !== 'continuous') continue;
      const meters = br.score?.type === 'distance' ? br.score.meters : undefined;
      if (!meters || meters <= 0 || !br.elapsedSeconds || br.elapsedSeconds <= 0) continue;
      efforts.push({ atMs: session.startedAt, meters, seconds: br.elapsedSeconds });
    }
  }
  return efforts;
}

export type DistanceBucket = '400m' | '1km' | '5km' | 'all';

const BUCKET_METERS: Record<Exclude<DistanceBucket, 'all'>, number> = { '400m': 400, '1km': 1000, '5km': 5000 };

/** Efforts within 5% of the nominal distance count as the same benchmark. */
function inBucket(effort: EnduranceEffort, bucket: DistanceBucket): boolean {
  if (bucket === 'all') return true;
  const nominal = BUCKET_METERS[bucket];
  return Math.abs(effort.meters - nominal) <= nominal * 0.05;
}

export type EnduranceSeries = {
  /** Minutes for a fixed distance; minutes per km for `all`. */
  points: LiftPoint[];
  currentLabel: string;
  deltaPct: number | undefined;
  deltaLabel: string | undefined;
  unitLabel: string;
};

export function enduranceSeries(efforts: EnduranceEffort[], bucket: DistanceBucket, range: RangeKey, nowMs: number): EnduranceSeries | undefined {
  const from = rangeStartMs(range, nowMs);
  const picked = efforts.filter((e) => e.atMs >= from && inBucket(e, bucket));
  if (picked.length === 0) return undefined;

  const seconds = (e: EnduranceEffort) => (bucket === 'all' ? e.seconds / (e.meters / 1000) : e.seconds);
  const unitLabel = bucket === 'all' ? 'min/km' : 'min';
  const first = seconds(picked[0]);
  const last = seconds(picked[picked.length - 1]);
  const diff = last - first;

  return {
    points: picked.map((e) => ({ label: shortDate(e.atMs), value: seconds(e) / 60, atMs: e.atMs })),
    currentLabel: `${formatClock(last)} ${unitLabel}`,
    deltaPct: picked.length >= 2 && first > 0 ? Math.round((diff / first) * 100) : undefined,
    deltaLabel: picked.length >= 2 ? `${diff <= 0 ? '-' : '+'}${formatClock(Math.abs(diff))} ${unitLabel}` : undefined,
    unitLabel,
  };
}

export function enduranceStats(efforts: EnduranceEffort[], range: RangeKey, nowMs: number): { avgPaceLabel: string; totalDistanceLabel: string; count: number } | undefined {
  const from = rangeStartMs(range, nowMs);
  const picked = efforts.filter((e) => e.atMs >= from);
  if (picked.length === 0) return undefined;
  const meters = picked.reduce((s, e) => s + e.meters, 0);
  const seconds = picked.reduce((s, e) => s + e.seconds, 0);
  return {
    avgPaceLabel: `${formatClock(seconds / (meters / 1000))} min/km`,
    totalDistanceLabel: formatDistance(meters),
    count: picked.length,
  };
}

// --------------------------------------------------------- performance

export type PerformanceSummary = {
  sessionCount: number;
  /** Change in load x reps against the equally long period before; undefined when either period has none. */
  volumeChangePct: number | undefined;
  sessionsPerWeek: number | undefined;
  sessionsPerWeekDelta: number | undefined;
  prCount: number;
  /** Share of planned sessions in the period that were completed; undefined when nothing was planned. */
  consistencyPct: number | undefined;
  plannedCount: number;
  plannedCompletedCount: number;
};

export function performanceSummary(sessions: Session[], scheduled: ScheduledWorkout[], range: RangeKey, nowMs: number): PerformanceSummary {
  const done = completedSessions(sessions);
  const from = rangeStartMs(range, nowMs);
  const inWindow = done.filter((s) => s.startedAt >= from && s.startedAt <= nowMs);

  const volume = (list: Session[]) => list.reduce((sum, s) => sum + s.blockResults.reduce((v, br) => v + volumeKg(br.stepResults), 0), 0);

  let volumeChangePct: number | undefined;
  let sessionsPerWeek: number | undefined;
  let sessionsPerWeekDelta: number | undefined;
  if (range !== 'all') {
    const length = nowMs - from;
    const weeks = length / (7 * DAY_MS);
    const before = done.filter((s) => s.startedAt >= from - length && s.startedAt < from);
    const [cur, prev] = [volume(inWindow), volume(before)];
    if (cur > 0 && prev > 0) volumeChangePct = Math.round(((cur - prev) / prev) * 100);
    sessionsPerWeek = Math.round((inWindow.length / weeks) * 10) / 10;
    if (before.length > 0) sessionsPerWeekDelta = Math.round(((inWindow.length - before.length) / weeks) * 10) / 10;
  }

  const due = scheduled.filter((s) => !s.deletedAt && s.scheduledAt >= from && s.scheduledAt <= nowMs);
  const dueDone = due.filter((s) => s.status === 'completed').length;

  return {
    sessionCount: inWindow.length,
    volumeChangePct,
    sessionsPerWeek,
    sessionsPerWeekDelta,
    prCount: personalRecords(sessions).filter((r) => r.atMs >= from && r.atMs <= nowMs).length,
    consistencyPct: due.length > 0 ? Math.round((dueDone / due.length) * 100) : undefined,
    plannedCount: due.length,
    plannedCompletedCount: dueDone,
  };
}

// ------------------------------------------------------------ insights

export type ComputedInsight = {
  id: string;
  kind: 'week' | 'record' | 'strength' | 'endurance' | 'consistency';
  title: string;
  body: string;
};

/** Plain-language statements, each naming the data it rests on. No forecasts and no advice. */
export function buildInsights(sessions: Session[], scheduled: ScheduledWorkout[], nowMs: number): ComputedInsight[] {
  const out: ComputedInsight[] = [];
  const done = completedSessions(sessions);
  if (done.length === 0) return out;

  const week = weekSummary(sessions, scheduled, nowMs);
  if (week.completedCount > 0) {
    out.push({
      id: 'week',
      kind: 'week',
      title: 'This Week',
      body: `You completed ${week.completedCount} ${week.completedCount === 1 ? 'session' : 'sessions'} so far this week.`,
    });
  }

  const recentRecords = personalRecords(sessions).filter((r) => r.atMs >= nowMs - 28 * DAY_MS);
  const latest = recentRecords[recentRecords.length - 1];
  if (latest) {
    out.push({
      id: 'record',
      kind: 'record',
      title: 'New Personal Best',
      body: `${latest.name}: ${formatKg(latest.kg)} on ${shortDate(latest.atMs)}, up from ${formatKg(latest.previousKg)}.`,
    });
  }

  const lift = liftSeries(sessions, '3m', nowMs).find((l) => l.points.length >= 3 && l.deltaFromStart !== 0);
  if (lift) {
    const direction = lift.deltaFromStart > 0 ? 'up' : 'down';
    out.push({
      id: 'strength',
      kind: 'strength',
      title: 'Strength Trend',
      body: `${lift.name} is ${direction} ${formatKg(Math.abs(lift.deltaFromStart))} across ${lift.points.length} sessions since ${lift.points[0].label}.`,
    });
  }

  const efforts = enduranceEfforts(sessions);
  for (const bucket of ['5km', '1km', '400m'] as const) {
    const series = enduranceSeries(efforts, bucket, '3m', nowMs);
    if (series && series.points.length >= 2 && series.deltaLabel) {
      const first = formatClock(series.points[0].value * 60);
      const last = formatClock(series.points[series.points.length - 1].value * 60);
      out.push({
        id: 'endurance',
        kind: 'endurance',
        title: 'Endurance Trend',
        body: `Your ${formatDistance(BUCKET_METERS[bucket])} went from ${first} to ${last} across ${series.points.length} efforts. Route and conditions are not accounted for.`,
      });
      break;
    }
  }

  const perf = performanceSummary(sessions, scheduled, '4w', nowMs);
  if (perf.plannedCount >= 3) {
    out.push({
      id: 'consistency',
      kind: 'consistency',
      title: 'Planned vs. Done',
      body: `You completed ${perf.plannedCompletedCount} of ${perf.plannedCount} planned sessions in the last four weeks.`,
    });
  }

  return out;
}
