import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { HealthObservation, MetricKey } from '../health/model';
import { newUuid } from '../id';
import { exerciseSteps, type WorkoutContent } from '../workout/model';
import { EMPTY_DATA, completeSession, createWorkout, startSession, withCurrentShape, type WorkoutData } from '../workout/state';
import { lighter, optionsFor, shortened } from './adjust';
import { recoveryInsight } from './insight';
import { chooseOption, insightFor, localDateOf, saveCheckIn } from './state';

const NOW = new Date(2026, 9, 14, 7, 0).getTime();
const DAY = 86_400_000;
const TODAY = localDateOf(NOW);

function obs(metric: MetricKey, value: number, daysAgo: number, method?: string): HealthObservation {
  const at = NOW - daysAgo * DAY - 3_600_000;
  return { id: newUuid(), metric, value, unit: '', observedAt: at, localDate: localDateOf(at), ingestedAt: at, provider: 'manual', origin: 'user_entered', updatedAt: at, ...(method ? { method } : {}) };
}

/** A week of ordinary nights, then today's values. */
function history(today: Partial<Record<'rhr' | 'hrv' | 'sleep', number>>): HealthObservation[] {
  const out: HealthObservation[] = [];
  for (let d = 1; d <= 10; d++) {
    out.push(obs('resting_hr_bpm', 50 + (d % 2), d), obs('hrv_ms', 70 + (d % 3), d, 'rmssd'), obs('sleep_duration_min', 460 + (d % 2) * 10, d));
  }
  if (today.rhr !== undefined) out.push(obs('resting_hr_bpm', today.rhr, 0));
  if (today.hrv !== undefined) out.push(obs('hrv_ms', today.hrv, 0, 'rmssd'));
  if (today.sleep !== undefined) out.push(obs('sleep_duration_min', today.sleep, 0));
  return out;
}

const checkIn = (v: Partial<Record<'fatigue' | 'soreness' | 'stress' | 'energy', number>>, unwell?: boolean) => [
  ...(v.fatigue !== undefined ? [obs('subjective_fatigue', v.fatigue, 0)] : []),
  ...(v.soreness !== undefined ? [obs('subjective_soreness', v.soreness, 0)] : []),
  ...(v.stress !== undefined ? [obs('subjective_stress', v.stress, 0)] : []),
  ...(v.energy !== undefined ? [obs('subjective_energy', v.energy, 0)] : []),
  ...(unwell !== undefined ? [obs('unwell', unwell ? 1 : 0, 0)] : []),
];

const strength: WorkoutContent = {
  title: 'Squats',
  sport: 'strength',
  blocks: [
    { id: newUuid(), type: 'strength', config: { format: 'sets_reps', sets: 5, restSeconds: 120 }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Back Squat', activityId: 'back_squat', prescription: { reps: 5, load: { value: 100, unit: 'kg' }, intensity: { type: 'rpe', value: 8 } } }] },
    { id: newUuid(), type: 'conditioning', config: { format: 'amrap', durationSeconds: 900 }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Burpee', activityId: 'burpee', prescription: { reps: 10 } }] },
  ],
};

const run = (observations: HealthObservation[], scheduled = createWorkout(EMPTY_DATA, strength, { source: 'manual', scheduledAt: NOW + 3 * 3_600_000, nowMs: NOW })) =>
  recoveryInsight({ today: TODAY, nowMs: NOW, observations, sessions: [], scheduled: Object.values(scheduled.data.scheduled) });

describe('recovery insight (recovery_v1)', () => {
  it('abstains without a check-in or any usable measurement', () => {
    const i = run([]);
    assert.deepEqual([i.status, i.options], ['limited_data', []]);
    assert.ok(i.missing.includes('no check-in today'));
    assert.ok(i.missing.includes('no resting heart rate today'));
  });

  it('does not compare against a normal that is not established yet', () => {
    const i = run([obs('resting_hr_bpm', 70, 0), obs('resting_hr_bpm', 50, 1)]);
    assert.equal(i.status, 'limited_data');
    assert.ok(i.missing.includes('resting heart rate: your normal is not known yet'));
  });

  it('calls a usual day steady and suggests nothing', () => {
    const i = run([...history({ rhr: 51, hrv: 71, sleep: 465 }), ...checkIn({ fatigue: 4, soreness: 3, stress: 4, energy: 6 })]);
    assert.deepEqual([i.status, i.options], ['steady', []]);
    assert.ok(i.signals.find((s) => s.key === 'resting_hr')?.detail.includes('your normal'));
  });

  it('suggests easing off when several signals point the same way, and never more than three options', () => {
    const i = run([...history({ rhr: 57, hrv: 60, sleep: 420 }), ...checkIn({ fatigue: 6, energy: 5 })]);
    assert.equal(i.status, 'attention');
    assert.ok(i.options.length <= 3);
    assert.ok(i.options.length > 0);
    assert.equal(i.scheduledId !== undefined, true);
  });

  it('puts rest first when a feeling is strong, and trusts the athlete over the device', () => {
    const i = run([...history({ rhr: 51, hrv: 71, sleep: 465 }), ...checkIn({ soreness: 9 })]);
    assert.deepEqual([i.status, i.options[0]], ['attention', 'rest']);
  });

  it('holds back when the device says one thing and the athlete clearly another', () => {
    const i = run([...history({ rhr: 60, hrv: 50 }), ...checkIn({ fatigue: 2, soreness: 1, energy: 9 })]);
    assert.deepEqual([i.status, i.options], ['conflicting', []]);
  });

  it('never pushes a workout when the athlete feels unwell', () => {
    const i = run([...history({ rhr: 51 }), ...checkIn({ energy: 8 }, true)]);
    assert.deepEqual([i.status, i.options], ['unwell', ['rest', 'reschedule']]);
    const later = run([...history({ rhr: 51 }), ...checkIn({ energy: 8 }, true), { ...obs('unwell', 0, 0), observedAt: NOW }]);
    assert.notEqual(later.status, 'unwell', 'a later "no" replaces an earlier "yes" the same day');
  });

  it('notices a jump in training load only against enough history', () => {
    let data = EMPTY_DATA;
    const add = (daysAgo: number, minutes: number) => {
      const content: WorkoutContent = { title: 'Run', sport: 'running', blocks: [{ id: newUuid(), type: 'endurance', config: { format: 'continuous', durationSeconds: minutes * 60 }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Run', activityId: 'run', prescription: {} }] }] };
      const start = NOW - daysAgo * DAY;
      const c = createWorkout(data, content, { source: 'manual', scheduledAt: start, nowMs: start });
      // Timed with the player: a session logged by hand states no duration and adds no load.
      const s = startSession(c.data, c.scheduledId as string, 'player', start);
      assert.ok('sessionId' in s);
      data = completeSession(s.data, s.sessionId, {}, start + minutes * 60_000);
    };
    for (const d of [24, 17, 10]) add(d, 60);
    for (const d of [1, 2, 3, 4]) add(d, 60);
    const load = recoveryInsight({ today: TODAY, nowMs: NOW, observations: [], sessions: Object.values(data.sessions), scheduled: [] }).signals.find((s) => s.key === 'load');
    assert.deepEqual([load?.direction, load?.strength], ['worse', 'strong']);
  });
});

describe('options and approval', () => {
  it('makes a workout about a third shorter or about 15 % lighter, with fresh ids', () => {
    const short = shortened(strength, newUuid);
    assert.deepEqual(short.blocks.map((b) => b.config), [{ format: 'sets_reps', sets: 4, restSeconds: 120 }, { format: 'amrap', durationSeconds: 600 }]);
    const light = lighter(strength, newUuid);
    assert.deepEqual(exerciseSteps(light.blocks[0].steps)[0].prescription, { reps: 5, load: { value: 85, unit: 'kg' }, intensity: { type: 'rpe', value: 7 } });
    assert.notEqual(light.blocks[0].id, strength.blocks[0].id);
  });

  it('replaces an option that would change nothing', () => {
    const bodyweight: WorkoutContent = { title: 'Burpees', sport: 'hiit', blocks: [{ id: newUuid(), type: 'conditioning', config: { format: 'for_time' }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Burpee', activityId: 'burpee', prescription: { reps: 50 } }] }] };
    assert.deepEqual(optionsFor(['lighter', 'shorten', 'keep'], bodyweight, newUuid), ['reschedule', 'keep']);
    assert.deepEqual(optionsFor(['rest', 'lighter', 'reschedule'], strength, newUuid), ['rest', 'lighter', 'reschedule']);
  });

  it('changes the plan only when the athlete chooses, and records the choice without values', () => {
    const created = createWorkout(EMPTY_DATA, strength, { source: 'manual', scheduledAt: NOW + 3 * 3_600_000, nowMs: NOW });
    let data: WorkoutData = { ...created.data, observations: Object.fromEntries(history({ rhr: 58, hrv: 58, sleep: 400 }).map((o) => [o.id, o])) };
    data = saveCheckIn(data, { fatigue: 7, soreness: 5, stress: 4, energy: 4, unwell: false }, NOW);
    const insight = insightFor(data, NOW);
    assert.equal(insight.status, 'attention');
    const day = Object.values(data.recovery)[0];
    assert.equal(day.decision, undefined, 'nothing chosen yet');
    assert.equal(JSON.stringify(day).includes('bpm'), false, 'no values in the summary');
    const entry = data.scheduled[created.scheduledId as string];

    const lighterDay = chooseOption(data, insight, 'lighter', NOW + 1000);
    const moved = lighterDay.scheduled[entry.id];
    assert.notEqual(moved.versionId, entry.versionId, 'a new version, the old one stays in history');
    assert.equal(exerciseSteps(lighterDay.versions[moved.versionId].content.blocks[0].steps)[0].prescription.load?.value, 85);
    assert.equal(Object.values(lighterDay.recovery)[0].decision?.option, 'lighter');

    const rested = chooseOption(data, insight, 'rest', NOW + 1000);
    assert.equal(rested.scheduled[entry.id].status, 'skipped');
    const later = chooseOption(data, insight, 'reschedule', NOW + 1000);
    assert.equal(later.scheduled[entry.id].scheduledAt, entry.scheduledAt + DAY);
    const kept = chooseOption(data, insight, 'keep', NOW + 1000);
    assert.equal(kept.scheduled[entry.id], data.scheduled[entry.id]);
    assert.equal(Object.values(kept.recovery).length, 1, 'one summary per day');
  });

  it('refuses an option that was not offered', () => {
    const created = createWorkout(EMPTY_DATA, strength, { source: 'manual', scheduledAt: NOW + 3_600_000, nowMs: NOW });
    const insight = insightFor(created.data, NOW);
    assert.equal(insight.status, 'limited_data');
    assert.equal(chooseOption(created.data, insight, 'rest', NOW), created.data);
  });

  it('upgrades a v5 store with an empty recovery collection', () => {
    const v5 = { ...EMPTY_DATA } as Partial<WorkoutData>;
    delete v5.recovery;
    assert.deepEqual(withCurrentShape(v5).recovery, {});
  });
});
