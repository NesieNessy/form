import { tr } from '../i18n/tr';
import type { RtsStage } from '../rehab/model';

/**
 * Goals and progress (docs/concepts/06-stage-4-goal-and-progress.md).
 * A goal names a measurable target, a date and where the evidence comes
 * from. Progress is calculated from that evidence only, with its sources,
 * sample size and comparability; it is never a forecast or a promise.
 */

export type GoalMetric =
  /** Best single-rep load for one lift, from 1RM benchmarks and logged sets of one rep. Higher is better. */
  | { kind: 'one_rep_max'; activityId: string }
  /** A benchmark value: FTP (higher better), threshold or CSS pace (lower better). */
  | { kind: 'benchmark'; benchmark: 'ftp' | 'threshold_pace' | 'css_pace' }
  /** Time over a distance in one sport, from recorded activities and logged sessions. Lower is better. */
  | { kind: 'distance_time'; sport: 'running' | 'cycling' | 'swimming'; meters: number }
  /** Completed sessions per week. */
  | { kind: 'sessions_per_week'; perWeek: number }
  /** Days per week with something logged in nutrition. */
  | { kind: 'nutrition_logging'; daysPerWeek: number }
  /** Finish an event; the athlete records that it happened. */
  | { kind: 'event'; name: string }
  /** Reach a return-to-sport stage in a rehab case; only a verified clinician's decision counts. */
  | { kind: 'rehab_stage'; episodeId: string; stage: RtsStage };

export type GoalStatus = 'active' | 'achieved' | 'paused' | 'abandoned';

export type Milestone = { id: string; label: string; value?: number; dueDate?: string; reachedAt?: number };

export type GoalRevision = {
  at: number;
  /** What changed, as before -> after. */
  changes: Partial<Record<'target' | 'targetDate' | 'title' | 'status', { from: string | number | null; to: string | number | null }>>;
  reason?: string;
};

/** The state of progress when last calculated, kept so a coach can see it. */
export type ProgressSnapshot = {
  current?: number;
  /** 0 to 1 from baseline to target, when both are known. */
  fraction?: number;
  evidenceCount: number;
  summary: string;
  calculatedAt: number;
};

export type Goal = {
  id: string;
  title: string;
  metric: GoalMetric;
  /** In the metric's unit: kg, watts, seconds per km or per 100 m, seconds, sessions, days. Absent for events and rehab stages. */
  target?: number;
  targetDate: string;
  /** Where the athlete started, or absent when there was no comparable measurement. */
  baseline?: { value: number; measuredAt: string; source: string };
  milestones: Milestone[];
  visibility: 'private' | 'shared';
  status: GoalStatus;
  /** For event goals: when the athlete recorded finishing it. */
  completedOn?: string;
  revisions: GoalRevision[];
  progress?: ProgressSnapshot;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type Direction = 'higher' | 'lower' | 'reach';

export function directionOf(metric: GoalMetric): Direction {
  if (metric.kind === 'distance_time') return 'lower';
  if (metric.kind === 'benchmark') return metric.benchmark === 'ftp' ? 'higher' : 'lower';
  if (metric.kind === 'event' || metric.kind === 'rehab_stage') return 'reach';
  return 'higher';
}

export function unitOf(metric: GoalMetric): string {
  switch (metric.kind) {
    case 'one_rep_max':
      return 'kg';
    case 'benchmark':
      return metric.benchmark === 'ftp' ? 'W' : metric.benchmark === 'threshold_pace' ? '/km' : '/100 m';
    case 'distance_time':
      return '';
    case 'sessions_per_week':
      return tr('sessions a week', 'Einheiten pro Woche');
    case 'nutrition_logging':
      return tr('days a week', 'Tage pro Woche');
    default:
      return '';
  }
}

/** A value in the metric's own terms: "120 kg", "4:30 /km", "1:45:00". */
export function formatGoalValue(metric: GoalMetric, value: number): string {
  const clock = (s: number) => {
    const t = Math.round(s);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = t % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  };
  if (metric.kind === 'distance_time') return clock(value);
  if (metric.kind === 'benchmark' && metric.benchmark !== 'ftp') return `${clock(value)} ${unitOf(metric)}`;
  if (metric.kind === 'one_rep_max') return `${Math.round(value * 10) / 10} kg`;
  if (metric.kind === 'benchmark') return `${Math.round(value)} W`;
  return `${Math.round(value * 10) / 10} ${unitOf(metric)}`;
}
