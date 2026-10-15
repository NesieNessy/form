import { tr } from '../i18n/tr';
import { formatGoalValue, type GoalMetric } from './model';

/**
 * What a goal's progress summary says, as data. The sentence is built in
 * the reader's language when shown, so a coach and an athlete using
 * different languages each read their own.
 */
export type ProgressCode =
  | { kind: 'habit'; met: number; weeks: number; target: number; unit: 'sessions' | 'days' }
  | { kind: 'habit_first_week' }
  | { kind: 'no_evidence'; what: 'rehab' | 'event' | 'result' }
  | { kind: 'reach'; achieved: boolean }
  | { kind: 'value'; latest: boolean; current: number; target?: number; n: number };

export function describeProgress(code: ProgressCode, metric: GoalMetric): string {
  switch (code.kind) {
    case 'habit': {
      const { met, weeks, target } = code;
      return code.unit === 'sessions'
        ? tr(`${met} of ${weeks} full ${weeks === 1 ? 'week' : 'weeks'} at ${target} or more sessions.`, `${met} von ${weeks} vollen ${weeks === 1 ? 'Woche' : 'Wochen'} mit ${target} oder mehr Einheiten.`)
        : tr(`${met} of ${weeks} full ${weeks === 1 ? 'week' : 'weeks'} at ${target} or more days logged.`, `${met} von ${weeks} vollen ${weeks === 1 ? 'Woche' : 'Wochen'} mit ${target} oder mehr erfassten Tagen.`);
    }
    case 'habit_first_week':
      return tr('The first full week is still running.', 'Die erste volle Woche läuft noch.');
    case 'no_evidence':
      return code.what === 'rehab'
        ? tr('No decision recorded by a verified clinician yet.', 'Noch keine Entscheidung einer verifizierten Fachperson erfasst.')
        : code.what === 'event'
          ? tr('Not finished yet.', 'Noch nicht beendet.')
          : tr('No comparable result yet.', 'Noch kein vergleichbares Ergebnis.');
    case 'reach':
      return code.achieved ? tr('Reached.', 'Erreicht.') : tr('Not reached yet.', 'Noch nicht erreicht.');
    case 'value': {
      const value = formatGoalValue(metric, code.current);
      const target = code.target !== undefined ? formatGoalValue(metric, code.target) : undefined;
      return tr(
        `${code.latest ? 'Latest' : 'Best'}: ${value}${target ? `, target ${target}` : ''}. Based on ${code.n} ${code.n === 1 ? 'result' : 'results'}.`,
        `${code.latest ? 'Zuletzt' : 'Bestwert'}: ${value}${target ? `, Ziel ${target}` : ''}. Grundlage: ${code.n} ${code.n === 1 ? 'Ergebnis' : 'Ergebnisse'}.`
      );
    }
  }
}

/** The summary to show for a stored snapshot: rebuilt when its code is known, else the stored sentence. */
export const progressText = (goal: { metric: GoalMetric; progress?: { code?: ProgressCode; summary: string } }): string | undefined =>
  goal.progress ? (goal.progress.code ? describeProgress(goal.progress.code, goal.metric) : goal.progress.summary) : undefined;
