import { ACTIVITIES, getActivity } from '../workout/catalog';
import { formatClock, formatKg } from '../workout/format';
import type { Sport } from '../workout/model';

/**
 * The athlete's profile and performance reference values
 * (docs/concepts/03-stage-1-athlete-intelligence-foundation.md).
 * A benchmark is one dated measurement; history is kept and the newest by
 * date is the current value.
 */

export type Profile = {
  displayName?: string;
  sports: Sport[];
  equipment: string[];
  /** Days the athlete can usually train: 0 = Sunday ... 6 = Saturday. */
  availableDays: number[];
  minutesPerSession?: number;
  weeklySessionTarget: number;
  updatedAt: number;
};

export const EMPTY_PROFILE: Profile = { sports: [], equipment: [], availableDays: [], weeklySessionTarget: 5, updatedAt: 0 };

export type BenchmarkKind = 'one_rep_max' | 'ftp' | 'threshold_pace' | 'max_heart_rate' | 'css_pace';
export type BenchmarkUnit = 'kg' | 'w' | 'sec_per_km' | 'bpm' | 'sec_per_100m';
export type BenchmarkSource = 'manual' | 'test' | 'estimate' | 'session';

export type Benchmark = {
  id: string;
  kind: BenchmarkKind;
  /** Which lift a one-rep max is for. */
  activityId?: string;
  value: number;
  unit: BenchmarkUnit;
  /** Local calendar date of the measurement, YYYY-MM-DD. */
  measuredOn: string;
  source: BenchmarkSource;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

type KindMeta = {
  label: string;
  unit: BenchmarkUnit;
  /** Outside this range the value is almost certainly a typo or the wrong unit. */
  min: number;
  max: number;
  needsActivity: boolean;
  /** Pace values are entered and shown as minutes:seconds. */
  isPace: boolean;
};

export const BENCHMARK_KINDS: Record<BenchmarkKind, KindMeta> = {
  one_rep_max: { label: 'One-rep max', unit: 'kg', min: 1, max: 600, needsActivity: true, isPace: false },
  ftp: { label: 'FTP (cycling)', unit: 'w', min: 30, max: 600, needsActivity: false, isPace: false },
  threshold_pace: { label: 'Threshold pace (run)', unit: 'sec_per_km', min: 120, max: 900, needsActivity: false, isPace: true },
  max_heart_rate: { label: 'Max heart rate', unit: 'bpm', min: 100, max: 230, needsActivity: false, isPace: false },
  css_pace: { label: 'CSS pace (swim)', unit: 'sec_per_100m', min: 50, max: 400, needsActivity: false, isPace: true },
};

export const BENCHMARK_KIND_ORDER: BenchmarkKind[] = ['one_rep_max', 'ftp', 'threshold_pace', 'css_pace', 'max_heart_rate'];

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export type BenchmarkIssue = { field: 'kind' | 'activityId' | 'value' | 'measuredOn'; message: string };

export function validateBenchmark(
  b: Pick<Benchmark, 'kind' | 'activityId' | 'value' | 'unit' | 'measuredOn'>,
  today = todayIso()
): BenchmarkIssue[] {
  const issues: BenchmarkIssue[] = [];
  const meta = BENCHMARK_KINDS[b.kind];
  if (!meta) return [{ field: 'kind', message: 'Unknown benchmark type.' }];

  if (meta.needsActivity) {
    const activity = getActivity(b.activityId);
    if (!activity) issues.push({ field: 'activityId', message: 'Choose which lift this is for.' });
    else if (!activity.loadable) issues.push({ field: 'activityId', message: 'A one-rep max needs a loaded lift.' });
  }
  if (!(typeof b.value === 'number' && Number.isFinite(b.value) && b.value > 0)) {
    issues.push({ field: 'value', message: 'Enter a value above zero.' });
  } else if (b.value < meta.min || b.value > meta.max) {
    issues.push({ field: 'value', message: `That is outside the plausible range for ${meta.label.toLowerCase()}. Check the number and unit.` });
  }
  if (b.unit !== meta.unit) issues.push({ field: 'value', message: 'Wrong unit for this benchmark.' });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.measuredOn) || Number.isNaN(new Date(`${b.measuredOn}T00:00:00`).getTime())) {
    issues.push({ field: 'measuredOn', message: 'Enter the date as YYYY-MM-DD.' });
  } else if (b.measuredOn > today) {
    issues.push({ field: 'measuredOn', message: 'The date cannot be in the future.' });
  }
  return issues;
}

const slot = (b: Pick<Benchmark, 'kind' | 'activityId'>) => `${b.kind}:${b.activityId ?? ''}`;

/** The newest measurement for each benchmark (per lift for one-rep maxes). */
export function currentBenchmarks(benchmarks: Benchmark[]): Benchmark[] {
  const latest = new Map<string, Benchmark>();
  for (const b of benchmarks) {
    if (b.deletedAt) continue;
    const prev = latest.get(slot(b));
    if (!prev || b.measuredOn > prev.measuredOn || (b.measuredOn === prev.measuredOn && b.updatedAt > prev.updatedAt)) {
      latest.set(slot(b), b);
    }
  }
  return [...latest.values()].sort(
    (a, b) =>
      BENCHMARK_KIND_ORDER.indexOf(a.kind) - BENCHMARK_KIND_ORDER.indexOf(b.kind) ||
      benchmarkTitle(a).localeCompare(benchmarkTitle(b))
  );
}

export function benchmarkHistory(benchmarks: Benchmark[], of: Pick<Benchmark, 'kind' | 'activityId'>): Benchmark[] {
  return benchmarks
    .filter((b) => !b.deletedAt && slot(b) === slot(of))
    .sort((a, b) => (a.measuredOn < b.measuredOn ? 1 : a.measuredOn > b.measuredOn ? -1 : b.updatedAt - a.updatedAt));
}

/** Current one-rep max in kg per activity id, used to turn "% of 1RM" into a load. */
export function oneRepMaxByActivity(benchmarks: Benchmark[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of currentBenchmarks(benchmarks)) {
    if (b.kind === 'one_rep_max' && b.activityId) out[b.activityId] = b.value;
  }
  return out;
}

export function benchmarkTitle(b: Pick<Benchmark, 'kind' | 'activityId'>): string {
  if (b.kind === 'one_rep_max') return `${getActivity(b.activityId)?.name ?? 'Lift'} 1RM`;
  return BENCHMARK_KINDS[b.kind].label;
}

export function formatBenchmarkValue(b: Pick<Benchmark, 'value' | 'unit'>): string {
  switch (b.unit) {
    case 'kg':
      return formatKg(b.value);
    case 'w':
      return `${Math.round(b.value)} W`;
    case 'bpm':
      return `${Math.round(b.value)} bpm`;
    case 'sec_per_km':
      return `${formatClock(b.value)} /km`;
    case 'sec_per_100m':
      return `${formatClock(b.value)} /100 m`;
  }
}

export const LOADABLE_ACTIVITIES = ACTIVITIES.filter((a) => a.loadable);

/** Every piece of equipment the catalog knows, for the profile's equipment list. */
export const EQUIPMENT_OPTIONS: string[] = [...new Set(ACTIVITIES.flatMap((a) => a.equipment))].sort();
