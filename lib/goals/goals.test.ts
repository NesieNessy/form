import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Benchmark } from '../athlete/model';
import type { ExternalActivity } from '../health/model';
import { newUuid } from '../id';
import type { RtsDecision } from '../rehab/model';
import type { Session, WorkoutContent } from '../workout/model';
import { EMPTY_DATA, withCurrentShape, type WorkoutData } from '../workout/state';
import { formatGoalValue, type Goal } from './model';
import { goalProgress, type ProgressInputs } from './progress';
import { addGoal, recordEventFinished, refreshGoals, reviseGoal, setGoalStatus, suggestBaseline } from './state';

const NOW = new Date(2026, 9, 14, 12).getTime();
const DAY = 86_400_000;
const ymd = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const inputs = (patch: Partial<ProgressInputs> = {}): ProgressInputs => ({ benchmarks: [], sessions: [], activities: [], foodLog: [], decisions: [], nowMs: NOW, ...patch });
const goal = (patch: Partial<Goal>): Goal => ({ id: 'g', title: 'Goal', metric: { kind: 'event', name: 'x' }, targetDate: '2027-01-01', milestones: [], visibility: 'private', status: 'active', revisions: [], createdAt: NOW - 30 * DAY, updatedAt: NOW, ...patch });

const bench = (kind: Benchmark['kind'], value: number, daysAgo: number, patch: Partial<Benchmark> = {}): Benchmark => ({
  id: newUuid(),
  kind,
  value,
  unit: kind === 'one_rep_max' ? 'kg' : kind === 'ftp' ? 'w' : 'sec_per_km',
  measuredOn: ymd(NOW - daysAgo * DAY),
  source: 'test',
  createdAt: NOW,
  updatedAt: NOW,
  ...patch,
});

function squatSession(daysAgo: number, sets: { reps: number; kg: number }[]): Session {
  const stepId = newUuid();
  const blockId = newUuid();
  const content: WorkoutContent = { title: 'Heavy day', sport: 'strength', blocks: [{ id: blockId, type: 'strength', config: { format: 'sets_reps', sets: sets.length }, steps: [{ kind: 'exercise', id: stepId, name: 'Back Squat', activityId: 'back_squat', prescription: {} }] }] };
  return {
    id: newUuid(),
    workoutId: 'w',
    versionId: 'v',
    prescribed: content,
    status: 'completed',
    entryMode: 'manual',
    startedAt: NOW - daysAgo * DAY,
    blockResults: [{ blockId, status: 'completed', stepResults: sets.map((s, i) => ({ stepId, setIndex: i, reps: s.reps, loadKg: s.kg, completed: true })) }],
    updatedAt: NOW,
  };
}

const run = (daysAgo: number, meters: number, seconds: number, patch: Partial<ExternalActivity> = {}): ExternalActivity => ({
  id: newUuid(),
  provider: 'file',
  externalId: newUuid(),
  source: { format: 'gpx' },
  sport: 'running',
  startedAt: NOW - daysAgo * DAY,
  endedAt: NOW - daysAgo * DAY + seconds * 1000,
  elapsedSeconds: seconds,
  distanceMeters: meters,
  quality: [],
  status: 'standalone',
  ingestedAt: NOW,
  updatedAt: NOW,
  ...patch,
});

describe('goal progress', () => {
  it('counts only true singles and 1RM benchmarks toward a one-rep max, and says what it left out', () => {
    const g = goal({ metric: { kind: 'one_rep_max', activityId: 'back_squat' }, target: 140, baseline: { value: 120, measuredAt: '2026-09-01', source: 'test' } });
    const p = goalProgress(g, inputs({ benchmarks: [bench('one_rep_max', 125, 20, { activityId: 'back_squat' }), bench('one_rep_max', 200, 5, { activityId: 'deadlift' })], sessions: [squatSession(3, [{ reps: 1, kg: 130 }, { reps: 3, kg: 135 }])] }));
    assert.deepEqual([p.current, p.fraction, p.achieved, p.evidence.length], [130, 0.5, false, 2]);
    assert.ok(p.notes.some((n) => n.includes('1 logged set with more than one rep is not counted')));
    assert.match(p.summary, /Best: 130 kg, target 140 kg\. Based on 2 results\./);
  });

  it('compares times only over the same distance, best counts, and other distances are not converted', () => {
    const g = goal({ metric: { kind: 'distance_time', sport: 'running', meters: 5000 }, target: 25 * 60, baseline: { value: 28 * 60, measuredAt: '2026-09-01', source: 'run' } });
    const p = goalProgress(g, inputs({ activities: [run(10, 5020, 27 * 60), run(4, 4990, 26 * 60), run(2, 10000, 55 * 60), run(1, 5000, 20 * 60, { status: 'duplicate' }), run(1, 5000, 24 * 60, { sport: 'cycling' })] }));
    assert.deepEqual([p.current, p.evidence.length], [26 * 60, 2]);
    assert.ok(Math.abs((p.fraction ?? 0) - 2 / 3) < 1e-9);
    assert.ok(p.notes.some((n) => n.includes('Routes')));
    assert.ok(p.notes.some((n) => n.includes('1 effort over other distances')));
  });

  it('uses the latest benchmark, flags mixed methods, and says when evidence is old', () => {
    const g = goal({ metric: { kind: 'benchmark', benchmark: 'ftp' }, target: 300 });
    const p = goalProgress(g, inputs({ benchmarks: [bench('ftp', 280, 100), bench('ftp', 260, 70, { source: 'estimate' })] }));
    assert.equal(p.current, 260, 'the latest value, not the best');
    assert.ok(p.notes.some((n) => n.includes('different methods')));
    assert.ok(p.notes.some((n) => n.includes('No new comparable result in the last 8 weeks')));
    assert.equal(p.fraction, undefined, 'no baseline, no fraction');
  });

  it('counts habit goals by full weeks and never marks them achieved', () => {
    const created = new Date(2026, 8, 14, 12).getTime(); // a Monday, four weeks ago
    const sessions = [1, 2, 3, 8, 9, 16, 22, 23, 24].map((d) => ({ ...squatSession(0, []), startedAt: created + d * DAY }));
    const g = goal({ metric: { kind: 'sessions_per_week', perWeek: 3 }, target: 3, createdAt: created });
    const p = goalProgress(g, inputs({ sessions }));
    assert.deepEqual(p.weeks?.map((w) => w.count), [3, 2, 1, 3]);
    assert.equal(p.summary, '2 of 4 full weeks at 3 or more sessions.');
    assert.equal(p.achieved, false);
  });

  it('reaches a rehab stage only through a verified clinician’s decision', () => {
    const g = goal({ metric: { kind: 'rehab_stage', episodeId: 'ep', stage: 'sport' } });
    const decision = (stage: RtsDecision['stage'], verified: boolean): RtsDecision => ({ id: newUuid(), episodeId: 'ep', stage, criteria: 'c', clinician: { id: 'p', name: 'Pat', role: 'physiotherapist', verified }, decidedAt: NOW });
    assert.equal(goalProgress(g, inputs({ decisions: [decision('performance', false)] })).achieved, false, 'an unverified decision does not count');
    assert.equal(goalProgress(g, inputs({ decisions: [decision('participation', true)] })).achieved, false, 'a lower stage is not enough');
    assert.equal(goalProgress(g, inputs({ decisions: [decision('sport', true)] })).achieved, true);
  });

  it('formats values in the goal’s own terms', () => {
    assert.equal(formatGoalValue({ kind: 'distance_time', sport: 'running', meters: 21097 }, 6300), '1:45:00');
    assert.equal(formatGoalValue({ kind: 'benchmark', benchmark: 'threshold_pace' }, 270), '4:30 /km');
  });
});

describe('goal records', () => {
  const lift = { title: 'Squat 140', metric: { kind: 'one_rep_max' as const, activityId: 'back_squat' }, target: 140, targetDate: '2027-03-01' };

  it('validates targets and dates', () => {
    assert.equal(addGoal(EMPTY_DATA, { ...lift, target: 0 }, NOW).ok, false);
    assert.equal(addGoal(EMPTY_DATA, { ...lift, targetDate: '2020-01-01' }, NOW).ok, false);
    assert.equal(addGoal(EMPTY_DATA, { ...lift, metric: { kind: 'sessions_per_week', perWeek: 20 }, target: 20 }, NOW).ok, false);
    assert.equal(addGoal(EMPTY_DATA, { title: 'Finish a sprint triathlon', metric: { kind: 'event', name: 'City Sprint' }, targetDate: '2027-06-01' }, NOW).ok, true);
  });

  it('keeps every earlier target when one changes', () => {
    const a = addGoal(EMPTY_DATA, lift, NOW);
    assert.ok(a.ok);
    const b = reviseGoal(a.data, a.goalId, { target: 130 }, 'Too ambitious after the break', NOW + 1);
    assert.ok(b.ok);
    const c = reviseGoal(b.data, a.goalId, { targetDate: '2027-05-01' }, '', NOW + 2);
    assert.ok(c.ok);
    const g = c.data.goals[a.goalId];
    assert.deepEqual(g.revisions.map((r) => r.changes), [{ target: { from: 140, to: 130 } }, { targetDate: { from: '2027-03-01', to: '2027-05-01' } }]);
    assert.equal(g.revisions[0].reason, 'Too ambitious after the break');
  });

  it('marks a goal achieved from the evidence, records milestones, and leaves habits alone', () => {
    const a = addGoal(EMPTY_DATA, { ...lift, target: 130, milestones: [{ label: '125 kg', value: 125 }] }, NOW);
    assert.ok(a.ok);
    const h = addGoal(a.data, { title: 'Train 3x a week', metric: { kind: 'sessions_per_week', perWeek: 3 }, target: 3, targetDate: '2027-01-01' }, NOW);
    assert.ok(h.ok);
    const data = refreshGoals(h.data, inputs({ sessions: [squatSession(0, [{ reps: 1, kg: 132 }])] }));
    const g = data.goals[a.goalId];
    assert.deepEqual([g.status, g.milestones[0].reachedAt !== undefined, g.revisions.at(-1)?.changes.status], ['achieved', true, { from: 'active', to: 'achieved' }]);
    assert.equal(data.goals[h.goalId].status, 'active');
    assert.equal(refreshGoals(data, inputs({ sessions: [squatSession(0, [{ reps: 1, kg: 132 }])] })), data, 'nothing new, nothing written');
  });

  it('lets the athlete pause or abandon, and record finishing an event, but not mark achieved by hand', () => {
    const e = addGoal(EMPTY_DATA, { title: 'Half marathon', metric: { kind: 'event', name: 'Autumn Half' }, targetDate: '2027-10-01' }, NOW);
    assert.ok(e.ok);
    const paused = setGoalStatus(e.data, e.goalId, 'paused', NOW);
    assert.equal(paused.goals[e.goalId].status, 'paused');
    assert.equal(recordEventFinished(paused, e.goalId, '2099-01-01', NOW).ok, false);
    const done = recordEventFinished(e.data, e.goalId, ymd(NOW), NOW);
    assert.ok(done.ok);
    assert.equal(refreshGoals(done.data, inputs()).goals[e.goalId].status, 'achieved');
  });

  it('offers the latest comparable result as the baseline', () => {
    const b = suggestBaseline({ kind: 'one_rep_max', activityId: 'back_squat' }, inputs({ benchmarks: [bench('one_rep_max', 118, 15, { activityId: 'back_squat' })] }));
    assert.deepEqual([b?.value, b?.measuredAt], [118, ymd(NOW - 15 * DAY)]);
    assert.equal(suggestBaseline({ kind: 'one_rep_max', activityId: 'deadlift' }, inputs()), undefined);
  });

  it('upgrades a v7 store with an empty goals collection', () => {
    const v7 = { ...EMPTY_DATA } as Partial<WorkoutData>;
    delete v7.goals;
    assert.deepEqual(withCurrentShape(v7).goals, {});
  });
});
