/**
 * Applying what the athlete approves in the chat happens on the device, with
 * ordinary state functions; these helpers only work out what would change,
 * so the card can show it before anything is written.
 */

/**
 * The new start of a moved workout: the proposed date in the athlete's time
 * zone, at the proposed time, or else at the time it was planned for.
 * `to` is "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM".
 */
export function rescheduleTarget(fromMs: number, to: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(to);
  if (!m) return undefined;
  const from = new Date(fromMs);
  const hours = m[4] !== undefined ? Number(m[4]) : from.getHours();
  const minutes = m[5] !== undefined ? Number(m[5]) : from.getMinutes();
  if (hours > 23 || minutes > 59) return undefined;
  const at = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hours, minutes, 0, 0);
  return Number.isNaN(at.getTime()) ? undefined : at.getTime();
}

export function describeMove(fromMs: number, toMs: number): { from: string; to: string } {
  const fmt = (ms: number) => new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return { from: fmt(fromMs), to: fmt(toMs) };
}

/** The athlete's local date and weekday, so "tomorrow" means the same to the assistant as to them. */
export function localToday(now = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `${d} (${now.toLocaleDateString('en-US', { weekday: 'long' })})`;
}
