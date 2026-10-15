import { locale } from './strings';
export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

export function combineDateAndTime(date: Date, time: Date): number {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined.getTime();
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDayMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Six Sunday-first weeks covering the month, including the spill-over days either side. */
export function buildMonthGrid(monthStart: Date): Date[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from(
    { length: 42 },
    (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
  );
}
