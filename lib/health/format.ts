import { locale } from '../strings';
import { formatMetricValue, type ExternalActivity, type MetricKey } from './model';

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

export function formatActivityDate(ms: number): string {
  return new Date(ms).toLocaleString(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const SPORT_NAME: Record<string, string> = {
  running: 'Run',
  cycling: 'Ride',
  swimming: 'Swim',
  endurance: 'Activity',
  triathlon: 'Multisport',
  other: 'Activity',
};

export function activityTitle(a: Pick<ExternalActivity, 'name' | 'sport'>): string {
  return a.name?.trim() || SPORT_NAME[a.sport] || 'Activity';
}

/** One line summarising an activity: duration and, when known, distance. */
export function activityLine(a: ExternalActivity): string {
  return [formatDuration(a.elapsedSeconds), a.distanceMeters ? formatDistance(a.distanceMeters) : undefined].filter(Boolean).join(' · ');
}

/** A metric value with its unit, e.g. "52 bpm" or "7 / 10". */
export const metricWithUnit = (metric: MetricKey, value: number): string => formatMetricValue(metric, value);
