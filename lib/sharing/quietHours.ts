/**
 * Quiet hours are a local time range in which nothing should be pushed to
 * the athlete. The range may cross midnight (22:00 to 07:00).
 */

function minutes(hhmm: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return undefined;
  const [h, min] = [Number(m[1]), Number(m[2])];
  return h < 24 && min < 60 ? h * 60 + min : undefined;
}

export function isWithinQuietHours(start: string | null, end: string | null, localHhmm: string): boolean {
  if (!start || !end) return false;
  const [s, e, now] = [minutes(start), minutes(end), minutes(localHhmm)];
  if (s === undefined || e === undefined || now === undefined || s === e) return false;
  return s < e ? now >= s && now < e : now >= s || now < e;
}

export function hourLabel(hhmm: string | null): string {
  if (!hhmm) return '';
  const total = minutes(hhmm);
  if (total === undefined) return hhmm;
  const d = new Date(2000, 0, 1, Math.floor(total / 60), total % 60);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
