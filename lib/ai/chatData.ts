import { totals } from '../nutrition/engine';
import type { FoodLogEntry } from '../nutrition/model';
import type { RecoveryDay } from '../recovery/model';
import { blockLabel, formatBlockHeadline, formatScore, formatStep } from '../workout/format';
import type { ScheduledWorkout, Session, Step, WorkoutContent } from '../workout/model';
import { sessionDurationSeconds } from '../workout/scoring';
import type { Citation, ToolOutcome } from './chat';

/**
 * What each chat tool hands the model: the fewest fields that answer the
 * question, plus the citations the answer may use. Pure, so the server
 * bundles the same code the tests check.
 */

/**
 * Dates and times go to the model in the athlete's local time (the app sends its UTC offset,
 * in minutes east of UTC), so "same time" and "tomorrow" mean what the athlete means.
 */
export const clampOffset = (minutes: unknown) => (typeof minutes === 'number' && Number.isFinite(minutes) ? Math.max(-840, Math.min(840, Math.round(minutes))) : 0);
const local = (ms: number, offset: number) => new Date(ms + offset * 60_000).toISOString();
const day = (ms: number, offset = 0) => local(ms, offset).slice(0, 10);
const time = (ms: number, offset = 0) => local(ms, offset).slice(11, 16);

export function sessionsResult(sessions: Session[], offset = 0): ToolOutcome {
  const done = sessions.filter((s) => !s.deletedAt && s.status === 'completed').sort((a, b) => b.startedAt - a.startedAt).slice(0, 40);
  return {
    ok: true,
    content: done.map((s) => ({
      id: s.id,
      date: day(s.startedAt, offset),
      title: s.prescribed.title,
      sport: s.prescribed.sport,
      minutes: (() => {
        const sec = sessionDurationSeconds(s);
        return sec ? Math.round(sec / 60) : null;
      })(),
      effort_rpe: s.rpe ?? null,
      results: s.blockResults.map((r) => formatScore(r.score)).filter((x) => x && x !== '—'),
    })),
    citations: done.map((s): Citation => ({ entity_type: 'session', entity_id: s.id, label: `${s.prescribed.title}, ${day(s.startedAt, offset)}` })),
  };
}

export function scheduleResult(entries: ScheduledWorkout[], titles: Record<string, string>, offset = 0): ToolOutcome {
  const live = entries.filter((e) => !e.deletedAt).sort((a, b) => a.scheduledAt - b.scheduledAt).slice(0, 60);
  return {
    ok: true,
    content: live.map((e) => ({ id: e.id, date: day(e.scheduledAt, offset), time: time(e.scheduledAt, offset), title: titles[e.versionId] ?? 'Workout', status: e.status })),
    citations: live.map((e): Citation => ({ entity_type: 'scheduled_workout', entity_id: e.id, label: `${titles[e.versionId] ?? 'Workout'}, ${day(e.scheduledAt, offset)}` })),
  };
}

function stepLines(steps: Step[], indent = ''): string[] {
  return steps.flatMap((s) => {
    const { title, detail } = formatStep(s);
    const line = `${indent}${detail ? `${title}: ${detail}` : title}`;
    return s.kind === 'group' ? [line, ...stepLines(s.steps, `${indent}  `)] : [line];
  });
}

export function workoutResult(scheduledId: string, content: WorkoutContent, date: string): ToolOutcome {
  return {
    ok: true,
    content: {
      id: scheduledId,
      date,
      title: content.title,
      sport: content.sport,
      sections: content.blocks.map((b) => ({ section: blockLabel(b), format: formatBlockHeadline(b), steps: stepLines(b.steps) })),
    },
    citations: [{ entity_type: 'scheduled_workout', entity_id: scheduledId, label: `${content.title}, ${date}` }],
  };
}

export function recoveryResult(days: RecoveryDay[]): ToolOutcome {
  const live = days.filter((d) => !d.deletedAt).sort((a, b) => (a.localDate < b.localDate ? 1 : -1));
  return {
    ok: true,
    content: live.map((d) => ({ id: d.id, date: d.localDate, status: d.status, signals: d.signals, choice: d.decision?.option ?? null })),
    citations: live.map((d): Citation => ({ entity_type: 'recovery_day', entity_id: d.id, label: `Recovery, ${d.localDate}` })),
  };
}

export function nutritionResult(entries: FoodLogEntry[], hideEnergy: boolean): ToolOutcome {
  const byDay = new Map<string, FoodLogEntry[]>();
  for (const e of entries.filter((x) => !x.deletedAt)) byDay.set(e.localDate, [...(byDay.get(e.localDate) ?? []), e]);
  const rows = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => {
      const t = totals(list);
      const v = (k: 'energy_kcal' | 'protein_g' | 'carbohydrate_g') => ({ value: Math.round(t.nutrients[k].value), complete: t.nutrients[k].missing === 0 });
      return { date, entries: t.entries, ...(hideEnergy ? {} : { energy_kcal: v('energy_kcal') }), protein_g: v('protein_g'), carbohydrate_g: v('carbohydrate_g'), fluid_ml: Math.round(t.fluidMl) };
    });
  return {
    ok: true,
    content: { days: rows, note: hideEnergy ? 'The athlete hides energy; do not mention calories.' : 'Days without entries are unknown, not zero.' },
    citations: rows.map((r): Citation => ({ entity_type: 'nutrition_day', entity_id: r.date, label: `Nutrition, ${r.date}` })),
  };
}
