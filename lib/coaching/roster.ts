import { tr } from '../i18n/tr';
import type { RosterRow } from '../sharing/api';

/**
 * Plain, rule-based notes for a coach's roster card, built only from what
 * the athlete shares. Nothing is inferred beyond the numbers: an athlete who
 * shares no summary gets no judgement about their training.
 */
export type RosterNote = { text: string; tone: 'info' | 'attention' };

const DAY = 86_400_000;

export function rosterNotes(row: RosterRow, nowMs: number): RosterNote[] {
  const notes: RosterNote[] = [];
  const s = row.summary;
  if (!s) {
    notes.push({ text: tr('Does not share a training summary', 'Teilt keine Trainingsübersicht'), tone: 'info' });
  } else {
    if (s.last_session_at) {
      const days = Math.floor((nowMs - new Date(s.last_session_at).getTime()) / DAY);
      notes.push(days >= 7 ? { text: tr(`No session in ${days} days`, `Seit ${days} Tagen keine Einheit`), tone: 'attention' } : { text: tr(`${s.sessions_7d} ${s.sessions_7d === 1 ? 'session' : 'sessions'} in the last 7 days`, `${s.sessions_7d} ${s.sessions_7d === 1 ? 'Einheit' : 'Einheiten'} in den letzten 7 Tagen`), tone: 'info' });
    } else {
      notes.push({ text: tr('No completed sessions yet', 'Noch keine abgeschlossenen Einheiten'), tone: 'info' });
    }
    if (s.planned_28d > 0) {
      const share = s.planned_done_28d / s.planned_28d;
      notes.push({ text: tr(`${s.planned_done_28d} of ${s.planned_28d} planned workouts done (28 days)`, `${s.planned_done_28d} von ${s.planned_28d} geplanten Workouts erledigt (28 Tage)`), tone: share < 0.5 ? 'attention' : 'info' });
    }
  }
  if (row.pending_assignments > 0) notes.push({ text: tr(`${row.pending_assignments} sent ${row.pending_assignments === 1 ? 'workout' : 'workouts'} not answered yet`, `${row.pending_assignments} ${row.pending_assignments === 1 ? 'gesendetes Workout' : 'gesendete Workouts'} noch nicht beantwortet`), tone: 'info' });
  if (row.declined_assignments_28d > 0) notes.push({ text: tr(`Declined ${row.declined_assignments_28d} in the last 28 days`, `${row.declined_assignments_28d} in den letzten 28 Tagen abgelehnt`), tone: 'attention' });
  return notes;
}

/** Athletes who need a look come first; otherwise alphabetical. */
export function sortRoster(rows: RosterRow[], nowMs: number): RosterRow[] {
  const weight = (r: RosterRow) => rosterNotes(r, nowMs).filter((n) => n.tone === 'attention').length;
  return [...rows].sort((a, b) => weight(b) - weight(a) || (a.athlete_name ?? '').localeCompare(b.athlete_name ?? ''));
}
