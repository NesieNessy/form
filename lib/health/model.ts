import type { Sport } from '../workout/model';

/**
 * Health and activity data (docs/concepts/health_wearable_integration_concept.md).
 *
 * Three rules shape everything here:
 * - Every value keeps where it came from, how it was obtained and when.
 * - A measured value, a device's estimate and something the athlete typed
 *   are never mixed up (`origin`).
 * - A missing metric is missing. It is never zero, and never "normal".
 */

export type Provider = 'file' | 'manual' | 'apple_health' | 'garmin';

/** How a value came to exist. Estimates (calories, VO2max, sleep stages) are not measurements. */
export type Origin = 'user_entered' | 'device_measured' | 'device_estimate';

export type MetricKey =
  | 'resting_hr_bpm'
  | 'hrv_ms'
  | 'sleep_duration_min'
  | 'weight_kg'
  | 'body_fat_pct'
  | 'subjective_fatigue'
  | 'subjective_soreness'
  | 'subjective_stress'
  | 'subjective_energy'
  /** 1 when the athlete reports feeling ill or injured in the daily check-in. Not a diagnosis. */
  | 'unwell';

export type MetricMeta = {
  label: string;
  unit: string;
  /** Outside this range the value is almost certainly a typo or the wrong unit. */
  min: number;
  max: number;
  decimals: number;
  /** Values with different methods must not be compared or averaged together. */
  methods?: string[];
  /** Which direction counts as "higher than usual" worth pointing out; never a diagnosis. */
  scale?: string;
};

export const METRICS: Record<MetricKey, MetricMeta> = {
  resting_hr_bpm: { label: 'Resting heart rate', unit: 'bpm', min: 25, max: 130, decimals: 0 },
  hrv_ms: { label: 'Heart rate variability', unit: 'ms', min: 3, max: 300, decimals: 0, methods: ['rmssd', 'sdnn'] },
  sleep_duration_min: { label: 'Sleep', unit: 'min', min: 30, max: 1200, decimals: 0 },
  weight_kg: { label: 'Weight', unit: 'kg', min: 25, max: 350, decimals: 1 },
  body_fat_pct: { label: 'Body fat', unit: '%', min: 2, max: 70, decimals: 1 },
  subjective_fatigue: { label: 'Fatigue', unit: '', min: 0, max: 10, decimals: 0, scale: '0 to 10' },
  subjective_soreness: { label: 'Soreness', unit: '', min: 0, max: 10, decimals: 0, scale: '0 to 10' },
  subjective_stress: { label: 'Stress', unit: '', min: 0, max: 10, decimals: 0, scale: '0 to 10' },
  subjective_energy: { label: 'Energy', unit: '', min: 0, max: 10, decimals: 0, scale: '0 to 10' },
  unwell: { label: 'Feeling unwell', unit: '', min: 0, max: 1, decimals: 0, scale: 'yes or no' },
};

/** Metrics listed on the health screen and in the measurement form. unwell is only part of the daily check-in. */
export const METRIC_ORDER: MetricKey[] = ['resting_hr_bpm', 'hrv_ms', 'sleep_duration_min', 'weight_kg', 'body_fat_pct', 'subjective_fatigue', 'subjective_soreness', 'subjective_stress', 'subjective_energy'];

export type QualityFlag =
  | 'no_heart_rate'
  | 'no_distance'
  | 'no_timestamps'
  | 'gps_gaps'
  | 'implausible_speed'
  | 'short_recording'
  | 'file_errors';

export type HealthObservation = {
  id: string;
  metric: MetricKey;
  value: number;
  unit: string;
  /** When the thing measured happened. */
  observedAt: number;
  /** The athlete's local calendar day it belongs to, YYYY-MM-DD. Sleep and daily values are grouped by this. */
  localDate: string;
  /** When FORM received it. */
  ingestedAt: number;
  provider: Provider;
  /** The provider's own id for the record, used to make re-imports idempotent. */
  externalId?: string;
  device?: string;
  origin: Origin;
  /** Measurement method where it matters (HRV: rmssd or sdnn). */
  method?: string;
  updatedAt: number;
  deletedAt?: number;
};

export type ActivityStatus =
  /** Imported, nothing decided yet. */
  | 'new'
  /** Recorded as the result of a planned workout. */
  | 'linked'
  /** Logged as a workout of its own. */
  | 'standalone'
  /** The athlete confirmed it is the same effort as another activity. */
  | 'duplicate'
  | 'ignored';

export type ActivitySeries = { metric: 'heart_rate_bpm'; intervalSeconds: number; values: (number | null)[] };

export type ExternalActivity = {
  id: string;
  provider: Provider;
  /** Stable per source: a hash of the file's content, or the provider's activity id. */
  externalId: string;
  source: { format?: 'gpx' | 'tcx' | 'fit'; fileName?: string; device?: string; creator?: string };
  sport: Sport;
  name?: string;
  startedAt: number;
  endedAt: number;
  elapsedSeconds: number;
  /** Time actually moving, when the source distinguishes it. */
  movingSeconds?: number;
  distanceMeters?: number;
  elevationGainMeters?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgPowerWatts?: number;
  avgCadence?: number;
  /** A device estimate, never a measurement. */
  caloriesEstimate?: number;
  quality: QualityFlag[];
  series?: ActivitySeries;
  status: ActivityStatus;
  /** The session this activity was recorded as, when linked or standalone. */
  sessionId?: string;
  duplicateOfId?: string;
  ingestedAt: number;
  updatedAt: number;
  deletedAt?: number;
};

/** What a parser produces before it becomes a stored activity. */
export type ParsedActivity = Omit<ExternalActivity, 'id' | 'status' | 'sessionId' | 'duplicateOfId' | 'ingestedAt' | 'updatedAt' | 'deletedAt'>;

export type ParseResult = { ok: true; activity: ParsedActivity } | { ok: false; code: 'UNSUPPORTED_FORMAT' | 'NO_ACTIVITY' | 'CORRUPT_FILE' | 'TOO_LARGE'; message: string };

export function localDateOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatMetricValue(metric: MetricKey, value: number): string {
  const meta = METRICS[metric];
  if (metric === 'sleep_duration_min') return `${Math.floor(value / 60)} h ${String(Math.round(value % 60)).padStart(2, '0')} min`;
  const text = value.toFixed(meta.decimals);
  return meta.unit ? `${text} ${meta.unit}` : `${text} / 10`;
}

export type ObservationIssue = { field: 'value' | 'method' | 'observedAt'; message: string };

export function validateObservation(o: Pick<HealthObservation, 'metric' | 'value' | 'observedAt' | 'method'>, nowMs: number): ObservationIssue[] {
  const issues: ObservationIssue[] = [];
  const meta = METRICS[o.metric];
  if (!meta) return [{ field: 'value', message: 'Unknown measurement.' }];
  if (!(typeof o.value === 'number' && Number.isFinite(o.value))) issues.push({ field: 'value', message: 'Enter a number.' });
  else if (o.value < meta.min || o.value > meta.max) {
    issues.push({ field: 'value', message: `That is outside the plausible range for ${meta.label.toLowerCase()} (${meta.min} to ${meta.max}${meta.unit ? ` ${meta.unit}` : ''}). Check the number and unit.` });
  }
  if (meta.methods && !meta.methods.includes(o.method ?? '')) {
    issues.push({ field: 'method', message: `Choose how it was measured (${meta.methods.join(' or ').toUpperCase()}). Values from different methods cannot be compared.` });
  }
  if (o.observedAt > nowMs + 60_000) issues.push({ field: 'observedAt', message: 'The date cannot be in the future.' });
  return issues;
}
