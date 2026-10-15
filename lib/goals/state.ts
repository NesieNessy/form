import { tr } from '../i18n/tr';
import { newUuid } from '../id';
import { mark, type WorkoutData } from '../workout/state';
import { directionOf, formatGoalValue, type Goal, type GoalMetric, type GoalStatus, type Milestone } from './model';
import { goalProgress, snapshot, type ProgressInputs } from './progress';

type Result<T> = ({ ok: true; data: WorkoutData } & T) | { ok: false; error: string };

const today = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const put = (data: WorkoutData, goal: Goal): WorkoutData => ({ ...data, goals: { ...data.goals, [goal.id]: goal }, dirty: mark(data.dirty, { goals: [goal.id] }) });

export type GoalInput = {
  title: string;
  metric: GoalMetric;
  target?: number;
  targetDate: string;
  baseline?: Goal['baseline'];
  milestones?: Omit<Milestone, 'id'>[];
  visibility?: Goal['visibility'];
};

export function checkGoal(input: Pick<GoalInput, 'title' | 'metric' | 'target' | 'targetDate'>, nowMs: number): string | undefined {
  if (!input.title.trim()) return tr('Give the goal a name.', 'Gib dem Ziel einen Namen.');
  if (input.title.length > 120) return tr('Keep the name under 120 characters.', 'Halte den Namen unter 120 Zeichen.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) return tr('Choose a target date.', 'Wähle ein Zieldatum.');
  if (input.targetDate < today(nowMs)) return tr('The target date cannot be in the past.', 'Das Zieldatum kann nicht in der Vergangenheit liegen.');
  const needsTarget = !['event', 'rehab_stage'].includes(input.metric.kind);
  if (needsTarget && !(typeof input.target === 'number' && input.target > 0)) return tr('Enter a target above zero.', 'Gib ein Ziel über null ein.');
  if (input.metric.kind === 'sessions_per_week' && (input.target ?? 0) > 14) return tr('More than 14 sessions a week is not a sensible target.', 'Mehr als 14 Einheiten pro Woche sind kein sinnvolles Ziel.');
  if (input.metric.kind === 'nutrition_logging' && (input.target ?? 0) > 7) return tr('A week has 7 days.', 'Eine Woche hat 7 Tage.');
  if (input.metric.kind === 'event' && !input.metric.name.trim()) return tr('Name the event.', 'Nenne das Event.');
  return undefined;
}

export function addGoal(data: WorkoutData, input: GoalInput, nowMs: number): Result<{ goalId: string }> {
  const error = checkGoal(input, nowMs);
  if (error) return { ok: false, error };
  const goalId = newUuid();
  const goal: Goal = {
    id: goalId,
    title: input.title.trim(),
    metric: input.metric,
    ...(input.target !== undefined ? { target: input.target } : {}),
    targetDate: input.targetDate,
    ...(input.baseline ? { baseline: input.baseline } : {}),
    milestones: (input.milestones ?? []).filter((m) => m.label.trim()).map((m) => ({ ...m, id: newUuid() })),
    visibility: input.visibility ?? 'private',
    status: 'active',
    revisions: [],
    createdAt: nowMs,
    updatedAt: nowMs,
  };
  return { ok: true, goalId, data: put(data, goal) };
}

/** Changes a target, date or name. The old values stay in the revision history; nothing is overwritten silently. */
export function reviseGoal(data: WorkoutData, goalId: string, patch: { title?: string; target?: number; targetDate?: string }, reason: string, nowMs: number): Result<object> {
  const goal = data.goals[goalId];
  if (!goal || goal.deletedAt) return { ok: false, error: tr('This goal no longer exists.', 'Dieses Ziel gibt es nicht mehr.') };
  const next = { ...goal, ...patch };
  const error = checkGoal(next, nowMs);
  if (error) return { ok: false, error };
  const changes: Goal['revisions'][number]['changes'] = {};
  if (patch.title !== undefined && patch.title !== goal.title) changes.title = { from: goal.title, to: patch.title };
  if (patch.target !== undefined && patch.target !== goal.target) changes.target = { from: goal.target ?? null, to: patch.target };
  if (patch.targetDate !== undefined && patch.targetDate !== goal.targetDate) changes.targetDate = { from: goal.targetDate, to: patch.targetDate };
  if (!Object.keys(changes).length) return { ok: true, data };
  return { ok: true, data: put(data, { ...next, revisions: [...goal.revisions, { at: nowMs, changes, ...(reason.trim() ? { reason: reason.trim().slice(0, 300) } : {}) }], updatedAt: nowMs }) };
}

/**
 * Pausing, resuming or abandoning is the athlete's call. "Achieved" is not
 * set by hand: it follows from the evidence, and for a rehab stage only from
 * a verified clinician's decision.
 */
export function setGoalStatus(data: WorkoutData, goalId: string, status: Exclude<GoalStatus, 'achieved'>, nowMs: number): WorkoutData {
  const goal = data.goals[goalId];
  if (!goal || goal.deletedAt || goal.status === status) return data;
  return put(data, { ...goal, status, revisions: [...goal.revisions, { at: nowMs, changes: { status: { from: goal.status, to: status } } }], updatedAt: nowMs });
}

/** The athlete records finishing an event goal. */
export function recordEventFinished(data: WorkoutData, goalId: string, date: string, nowMs: number): Result<object> {
  const goal = data.goals[goalId];
  if (!goal || goal.metric.kind !== 'event') return { ok: false, error: tr('Only an event goal is finished this way.', 'Nur ein Event-Ziel wird auf diese Weise beendet.') };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today(nowMs)) return { ok: false, error: tr('Choose the day you finished it.', 'Wähle den Tag, an dem du es geschafft hast.') };
  return { ok: true, data: put(data, { ...goal, completedOn: date, updatedAt: nowMs }) };
}

export function removeGoal(data: WorkoutData, goalId: string, nowMs: number): WorkoutData {
  const goal = data.goals[goalId];
  if (!goal) return data;
  return put(data, { ...goal, deletedAt: nowMs, updatedAt: nowMs });
}

export function setVisibility(data: WorkoutData, goalId: string, visibility: Goal['visibility'], nowMs: number): WorkoutData {
  const goal = data.goals[goalId];
  if (!goal || goal.visibility === visibility) return data;
  return put(data, { ...goal, visibility, updatedAt: nowMs });
}

/** The best comparable result before the goal starts, offered as its baseline. */
export function suggestBaseline(metric: GoalMetric, input: ProgressInputs): Goal['baseline'] | undefined {
  const probe: Goal = { id: 'probe', title: 'probe', metric, targetDate: '9999-12-31', milestones: [], visibility: 'private', status: 'active', revisions: [], createdAt: input.nowMs, updatedAt: input.nowMs };
  const p = goalProgress(probe, input);
  if (p.current === undefined || !p.evidence.length) return undefined;
  const latest = p.evidence[p.evidence.length - 1];
  return { value: p.current, measuredAt: latest.date, source: formatGoalValue(metric, p.current) + ` (${latest.label})` };
}

/**
 * Recalculates progress for active goals and records it when it changed,
 * marking reached milestones and achieved goals. Consistency goals are
 * habits and are never marked achieved automatically.
 */
export function refreshGoals(data: WorkoutData, input: ProgressInputs): WorkoutData {
  let next = data;
  for (const goal of Object.values(data.goals)) {
    if (goal.deletedAt || goal.status !== 'active') continue;
    const p = goalProgress(goal, input);
    const snap = snapshot(p, input.nowMs);
    const milestones = goal.milestones.map((m) => (p.milestonesReached.includes(m.id) && !m.reachedAt ? { ...m, reachedAt: input.nowMs } : m));
    const habit = goal.metric.kind === 'sessions_per_week' || goal.metric.kind === 'nutrition_logging';
    const achieved = p.achieved && !habit;
    const same =
      goal.progress?.summary === snap.summary && goal.progress?.fraction === snap.fraction && goal.progress?.current === snap.current && milestones.every((m, i) => m === goal.milestones[i]) && !achieved;
    if (same) continue;
    next = put(next, {
      ...goal,
      progress: snap,
      milestones,
      ...(achieved ? { status: 'achieved' as const, revisions: [...goal.revisions, { at: input.nowMs, changes: { status: { from: 'active', to: 'achieved' } } }] } : {}),
      updatedAt: input.nowMs,
    });
  }
  return next;
}

export { directionOf };
