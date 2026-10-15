import { describeProgress, type ProgressCode } from './describe';
import { tr } from '../i18n/tr';
import type { Benchmark } from '../athlete/model';
import type { ExternalActivity } from '../health/model';
import type { FoodLogEntry } from '../nutrition/model';
import type { RtsDecision, RtsStage } from '../rehab/model';
import { exerciseSteps, type Session } from '../workout/model';
import { directionOf, formatGoalValue, type Goal, type ProgressSnapshot } from './model';

/**
 * Deterministic progress for a goal. Every number comes with the records it
 * came from; records that are not comparable are left out and counted, so
 * the athlete can see why. Progress is never projected forward.
 */

export type Evidence = {
  date: string;
  value: number;
  source: 'benchmark' | 'session' | 'activity' | 'clinician' | 'athlete';
  label: string;
  /** The record it came from, for linking. */
  ref?: { type: 'benchmark' | 'session' | 'activity' | 'decision'; id: string };
};

export type WeekCount = { weekStart: string; count: number; met: boolean };

export type Progress = {
  evidence: Evidence[];
  current?: number;
  /** 0 to 1 between baseline and target, when both are known. */
  fraction?: number;
  achieved: boolean;
  weeks?: WeekCount[];
  notes: string[];
  milestonesReached: string[];
  /** What the summary says, as data (lib/goals/describe.ts). */
  code: ProgressCode;
  summary: string;
};

export type ProgressInputs = {
  benchmarks: Benchmark[];
  sessions: Session[];
  activities: ExternalActivity[];
  foodLog: FoodLogEntry[];
  decisions: RtsDecision[];
  nowMs: number;
};

const DAY = 86_400_000;
const STAGE_RANK: Record<RtsStage, number> = { participation: 1, sport: 2, performance: 3 };

const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Monday of the week containing ms, as YYYY-MM-DD. */
function weekStartOf(ms: number): string {
  const d = new Date(ms);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDate(d.getTime());
}

/** Completed full weeks from the goal's start to now, oldest first, with how many days or sessions each had. */
function weekly(startMs: number, nowMs: number, dates: string[], perWeek: number): WeekCount[] {
  const weeks: WeekCount[] = [];
  const first = new Date(`${weekStartOf(startMs)}T12:00:00`);
  const thisWeek = weekStartOf(nowMs);
  for (let w = new Date(first); localDate(w.getTime()) < thisWeek; w.setDate(w.getDate() + 7)) {
    const start = localDate(w.getTime());
    const end = localDate(w.getTime() + 7 * DAY);
    const count = dates.filter((d) => d >= start && d < end).length;
    weeks.push({ weekStart: start, count, met: count >= perWeek });
  }
  return weeks;
}

const near = (value: number, target: number, tolerance = 0.03) => Math.abs(value - target) <= target * tolerance;

function evidenceFor(goal: Goal, input: ProgressInputs, notes: string[]): Evidence[] {
  const m = goal.metric;
  const done = input.sessions.filter((s) => !s.deletedAt && s.status === 'completed');
  switch (m.kind) {
    case 'one_rep_max': {
      const fromBenchmarks = input.benchmarks
        .filter((b) => !b.deletedAt && b.kind === 'one_rep_max' && b.activityId === m.activityId)
        .map((b): Evidence => ({ date: b.measuredOn, value: b.value, source: 'benchmark', label: tr(`1RM benchmark (${b.source})`, `1RM-Referenzwert (${b.source})`), ref: { type: 'benchmark', id: b.id } }));
      const fromSessions: Evidence[] = [];
      let multiRep = 0;
      for (const s of done) {
        const ids = new Set<string>();
        for (const b of s.prescribed.blocks) for (const st of exerciseSteps(b.steps)) if (st.activityId === m.activityId) ids.add(st.id);
        for (const br of s.blockResults) {
          for (const r of br.stepResults) {
            if (!ids.has(r.stepId) || !r.completed || !(typeof r.loadKg === 'number' && r.loadKg > 0)) continue;
            // A heavy set of several reps is not a one-rep max; it is not estimated into one either.
            if (r.reps === 1) fromSessions.push({ date: localDate(s.startedAt), value: r.loadKg, source: 'session', label: tr(`Single in ${s.prescribed.title}`, `Einzelwiederholung in ${s.prescribed.title}`), ref: { type: 'session', id: s.id } });
            else multiRep++;
          }
        }
      }
      if (multiRep) notes.push(tr(`${multiRep} logged ${multiRep === 1 ? 'set' : 'sets'} with more than one rep ${multiRep === 1 ? 'is' : 'are'} not counted as a one-rep max.`, `${multiRep} ${multiRep === 1 ? 'erfasster Satz' : 'erfasste Sätze'} mit mehr als einer Wiederholung ${multiRep === 1 ? 'zählt' : 'zählen'} nicht als One-Rep-Max.`));
      return [...fromBenchmarks, ...fromSessions];
    }
    case 'benchmark': {
      const list = input.benchmarks.filter((b) => !b.deletedAt && b.kind === m.benchmark);
      const methods = new Set(list.map((b) => b.source));
      if (methods.size > 1) notes.push(tr(`These values come from different methods (${[...methods].join(', ')}); compare them with care.`, `Diese Werte stammen aus verschiedenen Methoden (${[...methods].join(', ')}); vergleiche sie mit Vorsicht.`));
      return list.map((b) => ({ date: b.measuredOn, value: b.value, source: 'benchmark' as const, label: `${m.benchmark === 'ftp' ? 'FTP' : 'Pace'} (${b.source})`, ref: { type: 'benchmark' as const, id: b.id } }));
    }
    case 'distance_time': {
      const out: Evidence[] = [];
      let other = 0;
      for (const a of input.activities) {
        if (a.deletedAt || a.status === 'duplicate' || a.status === 'ignored' || a.sport !== m.sport || !a.distanceMeters) continue;
        if (near(a.distanceMeters, m.meters)) out.push({ date: localDate(a.startedAt), value: a.elapsedSeconds, source: 'activity', label: tr(`${Math.round(a.distanceMeters)} m recorded`, `${Math.round(a.distanceMeters)} m aufgezeichnet`), ref: { type: 'activity', id: a.id } });
        else other++;
      }
      for (const s of done) {
        if (s.prescribed.sport !== m.sport) continue;
        for (const br of s.blockResults) {
          if (br.score?.type !== 'distance' || !br.elapsedSeconds) continue;
          if (near(br.score.meters, m.meters)) out.push({ date: localDate(s.startedAt), value: br.elapsedSeconds, source: 'session', label: s.prescribed.title, ref: { type: 'session', id: s.id } });
          else other++;
        }
      }
      if (out.length > 1) notes.push(tr('Routes, pools and conditions may differ between these efforts, so small differences may not mean a change in fitness.', 'Strecken, Becken und Bedingungen können sich zwischen diesen Einheiten unterscheiden; kleine Unterschiede bedeuten daher nicht unbedingt eine veränderte Fitness.'));
      if (other) notes.push(tr(`${other} ${other === 1 ? 'effort' : 'efforts'} over other distances ${other === 1 ? 'is' : 'are'} not compared, and no time is estimated from them.`, `${other} ${other === 1 ? 'Einheit' : 'Einheiten'} über andere Strecken ${other === 1 ? 'wird' : 'werden'} nicht verglichen, und daraus wird keine Zeit geschätzt.`));
      return out;
    }
    case 'event':
      return goal.completedOn ? [{ date: goal.completedOn, value: 1, source: 'athlete', label: tr(`Finished ${m.name}`, `${m.name} beendet`) }] : [];
    case 'rehab_stage':
      return input.decisions
        .filter((d) => d.episodeId === m.episodeId && d.clinician.verified)
        .map((d) => ({ date: localDate(d.decidedAt), value: STAGE_RANK[d.stage], source: 'clinician' as const, label: `${d.stage} · ${d.clinician.name ?? 'clinician'}`, ref: { type: 'decision' as const, id: d.id } }));
    default:
      return [];
  }
}

export function goalProgress(goal: Goal, input: ProgressInputs): Progress {
  const notes: string[] = [];
  const m = goal.metric;
  const dir = directionOf(m);

  // Habits are counted per completed week since the goal began.
  if (m.kind === 'sessions_per_week' || m.kind === 'nutrition_logging') {
    const dates =
      m.kind === 'sessions_per_week'
        ? input.sessions.filter((s) => !s.deletedAt && s.status === 'completed').map((s) => localDate(s.startedAt))
        : [...new Set(input.foodLog.filter((e) => !e.deletedAt).map((e) => e.localDate))];
    const target = m.kind === 'sessions_per_week' ? m.perWeek : m.daysPerWeek;
    const weeks = weekly(goal.createdAt, input.nowMs, dates, target);
    const met = weeks.filter((w) => w.met).length;
    const recent = weeks.slice(-4);
    const current = recent.length ? recent.reduce((s, w) => s + w.count, 0) / recent.length : undefined;
    const code: ProgressCode = weeks.length ? { kind: 'habit', met, weeks: weeks.length, target, unit: m.kind === 'sessions_per_week' ? 'sessions' : 'days' } : { kind: 'habit_first_week' };
    return { evidence: [], current, fraction: weeks.length ? met / weeks.length : undefined, achieved: false, weeks, notes, milestonesReached: [], code, summary: describeProgress(code, m) };
  }

  const evidence = evidenceFor(goal, input, notes).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!evidence.length) {
    const code: ProgressCode = { kind: 'no_evidence', what: m.kind === 'rehab_stage' ? 'rehab' : m.kind === 'event' ? 'event' : 'result' };
    return { evidence, achieved: false, notes, milestonesReached: [], code, summary: describeProgress(code, m) };
  }

  if (dir === 'reach') {
    const achieved = m.kind === 'event' ? true : evidence.some((e) => e.value >= STAGE_RANK[(m as { stage: RtsStage }).stage]);
    const code: ProgressCode = { kind: 'reach', achieved };
    return { evidence, achieved, notes, milestonesReached: [], code, summary: describeProgress(code, m) };
  }

  // Benchmarks describe where the athlete is now: the latest counts. Performances count by the best.
  const current = m.kind === 'benchmark' ? evidence[evidence.length - 1].value : dir === 'higher' ? Math.max(...evidence.map((e) => e.value)) : Math.min(...evidence.map((e) => e.value));
  const better = (a: number, b: number) => (dir === 'higher' ? a >= b : a <= b);
  const achieved = goal.target !== undefined && better(current, goal.target);
  let fraction: number | undefined;
  if (goal.baseline && goal.target !== undefined && goal.target !== goal.baseline.value) {
    const raw = dir === 'higher' ? (current - goal.baseline.value) / (goal.target - goal.baseline.value) : (goal.baseline.value - current) / (goal.baseline.value - goal.target);
    fraction = Math.max(0, Math.min(1, raw));
  }
  const latest = evidence[evidence.length - 1];
  if (input.nowMs - new Date(`${latest.date}T12:00:00`).getTime() > 56 * DAY) notes.push(tr('No new comparable result in the last 8 weeks; a benchmark session would show where you are now.', 'Kein neues vergleichbares Ergebnis in den letzten 8 Wochen; ein Test würde zeigen, wo du jetzt stehst.'));
  const milestonesReached = goal.milestones.filter((ms) => ms.value !== undefined && better(current, ms.value)).map((ms) => ms.id);
  const n = evidence.length;
  const code: ProgressCode = { kind: 'value', latest: m.kind === 'benchmark', current, ...(goal.target !== undefined ? { target: goal.target } : {}), n };
  return { evidence, current, fraction, achieved, notes, milestonesReached, code, summary: describeProgress(code, m) };
}

export function snapshot(p: Progress, nowMs: number): ProgressSnapshot {
  return { ...(p.current !== undefined ? { current: p.current } : {}), ...(p.fraction !== undefined ? { fraction: p.fraction } : {}), evidenceCount: p.evidence.length || (p.weeks?.length ?? 0), code: p.code, summary: p.summary, calculatedAt: nowMs };
}
