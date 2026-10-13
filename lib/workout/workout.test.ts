import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newUuid } from '../id';
import { WORKOUT_PRESETS, instantiatePreset } from '../workoutPresets';
import type { Workout as LegacyWorkout, WorkoutSection } from '../types';
import {
  buildInsights,
  enduranceEfforts,
  enduranceSeries,
  liftSeries,
  performanceSummary,
  personalRecords,
  strengthProgressPct,
  weekSummary,
} from './analytics';
import { ACTIVITIES, resolveActivity } from './catalog';
import { parseEveryText, parseRepScheme, parseWorkRestText, wizardToContent } from './fromWizard';
import { formatBlockHeadline, formatClock, formatPrescription, formatScore } from './format';
import type { Block, Prescription, Session, Step, WorkoutContent } from './model';
import { deriveScore, initialSetResults, volumeKg } from './scoring';
import {
  EMPTY_DATA,
  attachToUser,
  clearDirty,
  completeSession,
  createWorkout,
  discardSession,
  mergeRemote,
  migrateLegacy,
  putBlockResult,
  removeScheduled,
  reviseWorkout,
  startSession,
} from './state';
import { IDLE_TIMER, describeClock, elapsedMs, pauseTimer, startTimer } from './timer';
import { validateWorkout } from './validate';

const ex = (name: string, prescription: Prescription = {}): Step => ({
  kind: 'exercise',
  id: newUuid(),
  name,
  activityId: resolveActivity(name)?.id ?? null,
  prescription,
});

const block = (config: Block['config'], steps: Step[], type: Block['type'] = 'conditioning'): Block => ({
  id: newUuid(),
  type,
  config,
  steps,
});

const workout = (...blocks: Block[]): WorkoutContent => ({ title: 'Test', sport: 'crossfit', blocks });

const codes = (content: WorkoutContent) => validateWorkout(content).errors.map((e) => e.code);

describe('validateWorkout', () => {
  it('accepts a well-formed multi-block workout', () => {
    const content = workout(
      block({ format: 'sets_reps', sets: 5, restSeconds: 120 }, [ex('Back Squat', { reps: 5, load: { value: 75, unit: 'percent_1rm' } })], 'strength'),
      block({ format: 'amrap', durationSeconds: 720 }, [ex('Burpee', { reps: 10 }), ex('Wall Ball', { reps: 15 }), ex('Run', { distanceMeters: 200 })]),
      block({ format: 'sequence' }, [ex("Child's Pose", { durationSeconds: 120 })], 'cooldown')
    );
    const result = validateWorkout(content);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.equal(result.warnings.length, 0);
  });

  it('requires a duration for AMRAP', () => {
    assert.deepEqual(codes(workout(block({ format: 'amrap' }, [ex('Burpee', { reps: 10 })]))), ['MISSING_DURATION']);
  });

  it('requires interval length and count for interval work', () => {
    assert.deepEqual(codes(workout(block({ format: 'repeating_interval' }, [ex('Burpee', { reps: 5 })]))), ['MISSING_INTERVAL', 'MISSING_ROUNDS']);
  });

  it('rejects work longer than the interval', () => {
    const c = workout(block({ format: 'repeating_interval', intervalSeconds: 30, rounds: 8, workSeconds: 40 }, [ex('Burpee')]));
    assert.deepEqual(codes(c), ['WORK_EXCEEDS_INTERVAL']);
  });

  it('requires sets for sets-and-reps', () => {
    assert.deepEqual(codes(workout(block({ format: 'sets_reps' }, [ex('Deadlift', { reps: 5 })]))), ['MISSING_SETS']);
  });

  it('rejects rounds combined with a rep scheme', () => {
    const c = workout(block({ format: 'for_time', rounds: 3, repScheme: [21, 15, 9] }, [ex('Thruster')]));
    assert.deepEqual(codes(c), ['CONFLICTING_STRUCTURE']);
  });

  it('rejects empty workouts, empty blocks and empty groups', () => {
    assert.deepEqual(codes(workout()), ['NO_BLOCKS']);
    assert.deepEqual(codes(workout(block({ format: 'for_time' }, []))), ['EMPTY_BLOCK']);
    const group: Step = { kind: 'group', id: newUuid(), rounds: 3, steps: [] };
    assert.deepEqual(codes(workout(block({ format: 'sequence' }, [group]))), ['EMPTY_GROUP']);
  });

  it('supports nested groups but caps the depth', () => {
    const nest = (depth: number): Step =>
      depth === 0 ? ex('Burpee', { reps: 5 }) : { kind: 'group', id: newUuid(), rounds: 2, steps: [nest(depth - 1)] };
    assert.equal(validateWorkout(workout(block({ format: 'sequence' }, [nest(2)]))).valid, true);
    assert.ok(codes(workout(block({ format: 'sequence' }, [nest(3)]))).includes('NESTING_TOO_DEEP'));
  });

  it('rejects non-positive and malformed numbers', () => {
    const c = workout(
      block({ format: 'for_time' }, [
        ex('Burpee', { reps: 0 }),
        ex('Run', { distanceMeters: -5 }),
        ex('Plank', { durationSeconds: 0 }),
        { kind: 'rest', id: newUuid() },
      ])
    );
    assert.deepEqual(codes(c), ['INVALID_REPS', 'INVALID_DISTANCE', 'INVALID_DURATION', 'MISSING_DURATION']);
  });

  it('flags duplicate ids', () => {
    const step = ex('Burpee', { reps: 5 });
    assert.ok(codes(workout(block({ format: 'for_time' }, [step, step]))).includes('DUPLICATE_ID'));
  });

  it('warns about intensity above 100% 1RM and reports unknown exercises as info only', () => {
    const c = workout(block({ format: 'sets_reps', sets: 1 }, [ex('Back Squat', { reps: 1, load: { value: 105, unit: 'percent_1rm' } }), ex('Zercher Carry', { reps: 1 })]));
    const result = validateWorkout(c);
    assert.equal(result.valid, true);
    assert.deepEqual(result.warnings.map((w) => w.code), ['HIGH_INTENSITY']);
    assert.deepEqual(result.infos.map((w) => w.code), ['UNRESOLVED_EXERCISE']);
  });

  it('rejects an activity id that is not in the catalog', () => {
    const step: Step = { kind: 'exercise', id: newUuid(), name: 'Made Up', activityId: 'not_real', prescription: { reps: 5 } };
    assert.deepEqual(codes(workout(block({ format: 'for_time' }, [step]))), ['UNKNOWN_ACTIVITY']);
  });
});

describe('catalog', () => {
  it('has unique ids', () => {
    assert.equal(new Set(ACTIVITIES.map((a) => a.id)).size, ACTIVITIES.length);
  });

  it('resolves names, synonyms, plurals and decorated preset names', () => {
    assert.equal(resolveActivity('Pull-ups')?.id, 'pull_up');
    assert.equal(resolveActivity('C&J')?.id, 'clean_and_jerk');
    assert.equal(resolveActivity('50 Sit-Ups')?.id, 'sit_up');
    assert.equal(resolveActivity('Min 1: 20 Push-ups')?.id, 'push_up');
    assert.equal(resolveActivity('Dumbbell Snatches, 50/35 lbs')?.id, 'dumbbell_snatch');
    assert.equal(resolveActivity('Side Plank Lifts (L)')?.id, 'side_plank');
    assert.equal(resolveActivity('Burpees')?.id, 'burpee');
  });

  it('leaves unknown names unresolved instead of guessing', () => {
    assert.equal(resolveActivity('Tabata V-Ups'), undefined);
    assert.equal(resolveActivity(''), undefined);
  });
});

describe('wizardToContent', () => {
  const section = (s: Partial<WorkoutSection>): WorkoutSection => ({ key: 'wod', exercises: [], ...s });
  const reps = (name: string, n: number) => ({ id: `e-${name}`, name, primary: { target: 'reps' as const, reps: n } });

  it('parses the free-text helpers', () => {
    assert.deepEqual(parseRepScheme('21-15-9'), [21, 15, 9]);
    assert.equal(parseRepScheme('21-x-9'), undefined);
    assert.deepEqual(parseEveryText('Every 3 min for 12 min, alternating'), { intervalSeconds: 180, rounds: 4, alternating: true });
    assert.deepEqual(parseEveryText('Every 90 sec'), { intervalSeconds: 90, rounds: undefined, alternating: false });
    assert.deepEqual(parseWorkRestText('3 Sets: 8 x 20/10 sec'), { rounds: 8, workSeconds: 20, restSeconds: 10 });
  });

  it('maps each wizard workout type onto a core format', () => {
    const content = wizardToContent({
      title: ' Monday ',
      category: 'crossfit',
      notes: 'felt good',
      sections: [
        section({ key: 'strength', workoutType: 'strength', structure: { kind: 'fixedRounds', rounds: 5 }, exercises: [{ ...reps('Back Squat', 5), weight: { value: 80, mode: 'total' } }] }),
        section({ workoutType: 'forTime', structure: { kind: 'repScheme', scheme: '21-15-9' }, exercises: [reps('Thruster', 21), reps('Pull Up', 21)] }),
        section({ key: 'accessory', workoutType: 'amrap', structure: { kind: 'timeBased', minutes: 12, seconds: 0 }, exercises: [reps('Burpee', 10)] }),
        section({ key: 'skill', workoutType: 'emom', structure: { kind: 'timeBased', minutes: 10, seconds: 0 }, exercises: [reps('Box Jump', 5)] }),
        section({ key: 'cooldown', workoutType: 'tabata', structure: { kind: 'custom', text: '' }, exercises: [reps('Air Squat', 10)] }),
        section({ key: 'warmup', exercises: [] }),
      ],
    });

    assert.equal(content.title, 'Monday');
    assert.equal(content.description, 'felt good');
    assert.deepEqual(
      content.blocks.map((b) => b.config),
      [
        { format: 'sets_reps', sets: 5 },
        { format: 'for_time', repScheme: [21, 15, 9] },
        { format: 'amrap', durationSeconds: 720 },
        { format: 'repeating_interval', intervalSeconds: 60, rounds: 10 },
        { format: 'repeating_interval', intervalSeconds: 30, workSeconds: 20, rounds: 8 },
      ]
    );
    assert.deepEqual(content.blocks.map((b) => b.type), ['strength', 'conditioning', 'accessory', 'skill', 'cooldown']);
    const squat = content.blocks[0].steps[0];
    assert.ok(squat.kind === 'exercise');
    assert.equal(squat.activityId, 'back_squat');
    assert.deepEqual(squat.prescription, { reps: 5, load: { value: 80, unit: 'kg', per: 'total' } });
    assert.equal(validateWorkout(content).valid, true);
  });

  it('keeps unparseable structure as a note and leaves the gap for validation', () => {
    const content = wizardToContent({
      title: '',
      category: 'crossfit',
      sections: [section({ workoutType: 'amrap', structure: { kind: 'custom', text: 'as long as it takes' }, exercises: [reps('Burpee', 10)] })],
    });
    assert.equal(content.title, 'Untitled Workout');
    assert.deepEqual(content.blocks[0].config, { format: 'amrap' });
    assert.equal(content.blocks[0].notes, 'as long as it takes');
    assert.deepEqual(codes(content), ['MISSING_DURATION']);
  });

  it('turns timed pauses into rest steps and "Max" into max reps', () => {
    const content = wizardToContent({
      title: 't',
      category: 'other',
      sections: [
        section({
          workoutType: 'custom',
          exercises: [
            { id: 'a', name: 'Max Pull-ups', primary: { target: 'custom', text: 'Max' } },
            { id: 'b', name: '1 min Pause', primary: { target: 'time', minutes: 1, seconds: 0 } },
            { id: 'c', name: 'Row', primary: { target: 'distance', value: 2, unit: 'km' } },
          ],
        }),
      ],
    });
    const [a, b, c] = content.blocks[0].steps;
    assert.ok(a.kind === 'exercise' && a.prescription.reps === 'max');
    assert.deepEqual({ kind: b.kind, d: b.kind === 'rest' ? b.durationSeconds : 0 }, { kind: 'rest', d: 60 });
    assert.ok(c.kind === 'exercise' && c.prescription.distanceMeters === 2000 && c.activityId === 'row');
  });

  it('gives each movement of a multi-movement Tabata its own intervals, with the pauses between', () => {
    const preset = WORKOUT_PRESETS.find((p) => p.id === 'preset-5');
    assert.ok(preset);
    const { title, sections } = instantiatePreset(preset);
    const content = wizardToContent({ title, category: 'crossfit', sections });
    assert.deepEqual(
      content.blocks.map((b) => [b.type, b.config.format, b.steps.length]),
      [
        ['conditioning', 'repeating_interval', 1],
        ['recovery', 'continuous', 1],
        ['conditioning', 'repeating_interval', 1],
        ['recovery', 'continuous', 1],
        ['conditioning', 'repeating_interval', 1],
      ]
    );
    assert.deepEqual(content.blocks[0].config, { format: 'repeating_interval', intervalSeconds: 30, workSeconds: 20, rounds: 8 });
    assert.deepEqual(content.blocks[1].config, { format: 'continuous', durationSeconds: 60 });
    assert.equal(content.blocks[0].notes, '3 Sets: 8 x 20/10 sec');
    assert.equal(content.blocks[2].notes, undefined);
  });

  it('converts every bundled preset into a publishable workout', () => {
    for (const preset of WORKOUT_PRESETS) {
      const { title, sections } = instantiatePreset(preset);
      const result = validateWorkout(wizardToContent({ title, category: 'crossfit', sections }));
      assert.equal(result.valid, true, `${preset.id}: ${JSON.stringify(result.errors)}`);
    }
  });
});

describe('format', () => {
  it('formats clocks, prescriptions, headlines and scores', () => {
    assert.equal(formatClock(75), '1:15');
    assert.equal(formatClock(3725), '1:02:05');
    assert.equal(formatPrescription({ reps: 10, load: { value: 22.5, unit: 'kg', per: 'each' } }), '10 reps · 22.5 kg each');
    assert.equal(formatPrescription({ distanceMeters: 5000, intensity: { type: 'pace_sec_per_km', value: 300 } }), '5 km · 5:00 /km');
    assert.equal(formatBlockHeadline(block({ format: 'for_time', repScheme: [21, 15, 9] }, [])), 'For Time · 21-15-9');
    assert.equal(formatBlockHeadline(block({ format: 'repeating_interval', intervalSeconds: 120, rounds: 5 }, [])), 'E2MOM · 10:00');
    assert.equal(formatBlockHeadline(block({ format: 'repeating_interval', intervalSeconds: 30, workSeconds: 20, rounds: 8 }, [])), 'Intervals · 8 × 0:20 / 0:10');
    assert.equal(formatScore({ type: 'rounds_reps', rounds: 5, reps: 12 }), '5 + 12');
    assert.equal(formatScore(undefined), '—');
  });
});

describe('timer', () => {
  it('derives elapsed time from wall-clock stamps across pause and resume', () => {
    let t = startTimer(IDLE_TIMER, 1_000);
    assert.equal(elapsedMs(t, 6_000), 5_000);
    t = pauseTimer(t, 6_000);
    assert.equal(elapsedMs(t, 60_000), 5_000, 'paused time does not count');
    t = startTimer(t, 100_000);
    // A long gap between ticks (app backgrounded) still yields the right total.
    assert.equal(elapsedMs(t, 100_000 + 3_600_000), 5_000 + 3_600_000);
  });

  it('counts an AMRAP down and stops at zero', () => {
    const c = describeClock({ format: 'amrap', durationSeconds: 720 }, 700);
    assert.deepEqual([c.mode, c.displaySeconds, c.finished], ['down', 20, false]);
    const done = describeClock({ format: 'amrap', durationSeconds: 720 }, 9_999);
    assert.deepEqual([done.displaySeconds, done.finished, done.countedSeconds], [0, true, 720]);
  });

  it('gives E2MOM for ten minutes exactly five interval starts', () => {
    const cfg = { format: 'repeating_interval' as const, intervalSeconds: 120, rounds: 5 };
    const starts = new Set<number>();
    for (let s = 0; s < 600; s++) starts.add(describeClock(cfg, s).round as number);
    assert.deepEqual([...starts], [1, 2, 3, 4, 5]);
    assert.equal(describeClock(cfg, 600).finished, true);
    assert.equal(describeClock(cfg, 130).displaySeconds, 110);
  });

  it('splits Tabata intervals into work and rest and cycles alternating steps', () => {
    const cfg = { format: 'repeating_interval' as const, intervalSeconds: 30, workSeconds: 20, rounds: 8, alternating: true };
    assert.deepEqual([describeClock(cfg, 5, 2).phase, describeClock(cfg, 5, 2).displaySeconds], ['work', 15]);
    assert.deepEqual([describeClock(cfg, 25, 2).phase, describeClock(cfg, 25, 2).displaySeconds], ['rest', 5]);
    assert.equal(describeClock(cfg, 35, 2).activeStepIndex, 1);
    assert.equal(describeClock(cfg, 65, 2).activeStepIndex, 0);
  });

  it('holds a For Time clock at the cap', () => {
    const c = describeClock({ format: 'for_time', timeCapSeconds: 600 }, 700);
    assert.deepEqual([c.displaySeconds, c.finished], [600, true]);
    assert.equal(describeClock({ format: 'for_time' }, 700).finished, false);
  });
});

describe('scoring', () => {
  it('pre-fills one row per set from the prescription', () => {
    const b = block({ format: 'sets_reps', sets: 3 }, [ex('Back Squat', { reps: 5, load: { value: 80, unit: 'kg' } }), ex('Bench Press', { reps: 8, load: { value: 70, unit: 'percent_1rm' } })]);
    const rows = initialSetResults(b);
    assert.equal(rows.length, 6);
    assert.deepEqual(rows[0], { stepId: b.steps[0].id, setIndex: 0, reps: 5, loadKg: 80, completed: false });
    assert.equal(rows[3].loadKg, undefined, 'a percentage is not turned into kilograms');
  });

  it('scores by format and counts volume only from completed sets with both numbers', () => {
    const b = block({ format: 'sets_reps', sets: 2 }, [ex('Deadlift', { reps: 5 })]);
    const stepResults = [
      { stepId: b.steps[0].id, setIndex: 0, reps: 5, loadKg: 100, completed: true },
      { stepId: b.steps[0].id, setIndex: 1, reps: 5, loadKg: 110, completed: false },
      { stepId: b.steps[0].id, setIndex: 2, reps: undefined, loadKg: 90, completed: true },
    ];
    assert.deepEqual(deriveScore(b, { elapsedSeconds: 300, roundsCompleted: 0, stepResults }), { type: 'load', kg: 100 });
    assert.equal(volumeKg(stepResults), 500);
    assert.deepEqual(deriveScore(block({ format: 'for_time' }, []), { elapsedSeconds: 312.4, roundsCompleted: 0, stepResults: [] }), { type: 'time', seconds: 312 });
    assert.deepEqual(deriveScore(block({ format: 'amrap', durationSeconds: 600 }, []), { elapsedSeconds: 600, roundsCompleted: 7, stepResults: [] }), { type: 'rounds_reps', rounds: 7, reps: 0 });
  });
});

const strengthContent = (): WorkoutContent =>
  workout(block({ format: 'sets_reps', sets: 1 }, [ex('Back Squat', { reps: 5, load: { value: 60, unit: 'kg' } })], 'strength'));

/** Creates a workout scheduled at `atMs` and completes it with the given squat load. */
function logSquat(data: typeof EMPTY_DATA, atMs: number, kg: number) {
  const created = createWorkout(data, strengthContent(), { source: 'manual', scheduledAt: atMs, nowMs: atMs });
  const started = startSession(created.data, created.scheduledId as string, 'manual', atMs);
  assert.ok('sessionId' in started);
  const session = started.data.sessions[started.sessionId];
  const b = session.prescribed.blocks[0];
  const result = { blockId: b.id, status: 'completed' as const, score: { type: 'load' as const, kg }, stepResults: [{ stepId: b.steps[0].id, setIndex: 0, reps: 5, loadKg: kg, completed: true }] };
  return completeSession(putBlockResult(started.data, started.sessionId, result, atMs), started.sessionId, {}, atMs);
}

describe('state', () => {
  const NOW = Date.UTC(2026, 9, 13, 12);

  it('creates a published workout with a pinned schedule entry and marks it for sync', () => {
    const { data, workoutId, versionId, scheduledId } = createWorkout(EMPTY_DATA, strengthContent(), { source: 'manual', scheduledAt: NOW, nowMs: NOW });
    assert.equal(data.versions[versionId].status, 'published');
    assert.equal(data.scheduled[scheduledId as string].versionId, versionId);
    assert.deepEqual(data.dirty, { versions: [versionId], workouts: [workoutId], scheduled: [scheduledId], sessions: [] });
  });

  it('stores an invalid workout as a draft that cannot be started', () => {
    const { data, versionId, scheduledId } = createWorkout(EMPTY_DATA, workout(block({ format: 'amrap' }, [ex('Burpee')])), { source: 'import', scheduledAt: NOW, nowMs: NOW });
    assert.equal(data.versions[versionId].status, 'draft');
    assert.deepEqual(startSession(data, scheduledId as string, 'player', NOW), { error: 'not_published' });
  });

  it('keeps the session measured against the version it started from when the workout is later revised', () => {
    const created = createWorkout(EMPTY_DATA, strengthContent(), { source: 'manual', scheduledAt: NOW, nowMs: NOW });
    const started = startSession(created.data, created.scheduledId as string, 'player', NOW);
    assert.ok('sessionId' in started);

    const revised = reviseWorkout(started.data, created.workoutId, { ...strengthContent(), title: 'Changed' }, NOW + 1);
    assert.equal(revised.data.versions[revised.versionId].version, 2);
    assert.equal(revised.data.workouts[created.workoutId].currentVersionId, revised.versionId);
    assert.equal(revised.data.versions[created.versionId].content.title, 'Test', 'the old version is untouched');
    assert.equal(revised.data.scheduled[created.scheduledId as string].versionId, created.versionId, 'the schedule keeps its pinned version');
    assert.equal(revised.data.sessions[started.sessionId].prescribed.title, 'Test', 'the snapshot is untouched');
  });

  it('resumes the open session instead of starting a second one', () => {
    const created = createWorkout(EMPTY_DATA, strengthContent(), { source: 'manual', scheduledAt: NOW, nowMs: NOW });
    const first = startSession(created.data, created.scheduledId as string, 'player', NOW);
    assert.ok('sessionId' in first);
    const second = startSession(first.data, created.scheduledId as string, 'player', NOW + 5);
    assert.ok('sessionId' in second);
    assert.equal(second.sessionId, first.sessionId);
    assert.equal(Object.keys(second.data.sessions).length, 1);
  });

  it('completes a session, marks the schedule entry done and queues both for sync', () => {
    const data = logSquat(EMPTY_DATA, NOW, 80);
    const session = Object.values(data.sessions)[0];
    const entry = Object.values(data.scheduled)[0];
    assert.equal(session.status, 'completed');
    assert.equal(session.progress, undefined);
    assert.deepEqual([entry.status, entry.sessionId], ['completed', session.id]);
    assert.ok(data.dirty.sessions.includes(session.id) && data.dirty.scheduled.includes(entry.id));
  });

  it('discards an unfinished session without leaving a trace', () => {
    const created = createWorkout(EMPTY_DATA, strengthContent(), { source: 'manual', scheduledAt: NOW, nowMs: NOW });
    const started = startSession(created.data, created.scheduledId as string, 'player', NOW);
    assert.ok('sessionId' in started);
    const after = discardSession(started.data, started.sessionId);
    assert.deepEqual(after.sessions, {});
    assert.equal(after.scheduled[created.scheduledId as string].status, 'planned');
  });

  it('tombstones a removed entry, its session and the now-unused workout', () => {
    const data = logSquat(EMPTY_DATA, NOW, 80);
    const entry = Object.values(data.scheduled)[0];
    const after = removeScheduled(data, entry.id, NOW + 10);
    assert.ok(after.scheduled[entry.id].deletedAt);
    assert.ok(Object.values(after.sessions)[0].deletedAt);
    assert.ok(after.workouts[entry.workoutId].deletedAt);
  });

  it('keeps a template when its last schedule entry is removed', () => {
    const created = createWorkout(EMPTY_DATA, strengthContent(), { source: 'manual', scheduledAt: NOW, isTemplate: true, nowMs: NOW });
    const after = removeScheduled(created.data, created.scheduledId as string, NOW + 10);
    assert.equal(after.workouts[created.workoutId].deletedAt, undefined);
  });

  it('merges server state without overwriting unsent local changes', () => {
    const created = createWorkout(EMPTY_DATA, strengthContent(), { source: 'manual', scheduledAt: NOW, nowMs: NOW });
    const sid = created.scheduledId as string;
    const remoteEntry = { ...created.data.scheduled[sid], status: 'skipped' as const, updatedAt: NOW + 1000 };
    const snapshot = { workouts: [], versions: [], scheduled: [remoteEntry], sessions: [] };

    assert.equal(mergeRemote(created.data, snapshot).scheduled[sid].status, 'planned', 'dirty local row wins');
    const clean = clearDirty(created.data, { scheduled: [sid] });
    assert.equal(mergeRemote(clean, snapshot).scheduled[sid].status, 'skipped', 'newer remote row wins once local is clean');
    const stale = { ...snapshot, scheduled: [{ ...remoteEntry, updatedAt: NOW - 1000 }] };
    assert.equal(mergeRemote(clean, stale).scheduled[sid].status, 'planned', 'older remote row is ignored');
  });

  it('adopts never-synced data on first sign-in and drops another account’s data', () => {
    const local = clearDirty(logSquat(EMPTY_DATA, NOW, 80), { versions: Object.keys(logSquat(EMPTY_DATA, NOW, 80).versions) });
    const adopted = attachToUser(local, 'user-a');
    assert.equal(adopted.ownerUserId, 'user-a');
    assert.equal(adopted.dirty.versions.length, 1);
    assert.equal(adopted.dirty.sessions.length, 1);

    const switched = attachToUser(adopted, 'user-b');
    assert.equal(switched.ownerUserId, 'user-b');
    assert.deepEqual(switched.workouts, {});
    assert.deepEqual(switched.sessions, {});
  });

  it('migrates v1 store records without inventing a completed status', () => {
    const legacy: LegacyWorkout = {
      id: 'workout-1',
      title: 'Old one',
      category: 'crossfit',
      dateTimeMs: NOW,
      dateLabel: 'x',
      notes: 'note',
      durationLabel: '28:14',
      sections: [{ key: 'wod', workoutType: 'forTime', structure: { kind: 'fixedRounds', rounds: 3 }, exercises: [{ id: 'e1', name: 'Burpee', primary: { target: 'reps', reps: 10 } }] }],
      createdAt: NOW,
      updatedAt: NOW,
    };
    const data = migrateLegacy({ workouts: [legacy] }, NOW);
    const version = Object.values(data.versions)[0];
    const entry = Object.values(data.scheduled)[0];
    assert.equal(version.status, 'published');
    assert.equal(version.content.description, 'note\nDuration: 28:14');
    assert.deepEqual([entry.status, entry.scheduledAt], ['planned', NOW]);
    assert.deepEqual(data.sessions, {});
  });
});

describe('analytics', () => {
  const DAY = 86_400_000;
  const NOW = new Date(2026, 9, 14, 18).getTime(); // Wednesday

  const history = () => {
    let data = EMPTY_DATA;
    data = logSquat(data, NOW - 40 * DAY, 60);
    data = logSquat(data, NOW - 20 * DAY, 70);
    data = logSquat(data, NOW - 6 * DAY, 65);
    data = logSquat(data, NOW - 1 * DAY, 80);
    return data;
  };

  it('builds lift series from logged loads and counts only real records', () => {
    const data = history();
    const sessions = Object.values(data.sessions);
    const [squat] = liftSeries(sessions, 'all', NOW);
    assert.equal(squat.name, 'Back Squat');
    assert.deepEqual(squat.points.map((p) => p.value), [60, 70, 65, 80]);
    assert.deepEqual([squat.current, squat.deltaFromStart], [80, 20]);
    assert.equal(strengthProgressPct([squat]), 33);

    const records = personalRecords(sessions);
    assert.deepEqual(records.map((r) => [r.kg, r.previousKg]), [[70, 60], [80, 70]], 'the first entry and the dip are not records');
    assert.deepEqual(liftSeries(sessions, '4w', NOW)[0].points.map((p) => p.value), [70, 65, 80]);
  });

  it('returns nothing rather than a number when there is no data', () => {
    assert.deepEqual(liftSeries([], 'all', NOW), []);
    assert.equal(strengthProgressPct([]), undefined);
    assert.equal(enduranceSeries([], '5km', 'all', NOW), undefined);
    assert.deepEqual(buildInsights([], [], NOW), []);
    const perf = performanceSummary([], [], '4w', NOW);
    assert.deepEqual([perf.volumeChangePct, perf.consistencyPct, perf.prCount], [undefined, undefined, 0]);
  });

  it('summarises the Monday-to-Sunday week', () => {
    const data = history();
    const week = weekSummary(Object.values(data.sessions), Object.values(data.scheduled), NOW);
    assert.deepEqual(week.days.map((d) => d.day), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    assert.equal(week.completedCount, 1);
    assert.deepEqual(week.days.filter((d) => d.done).map((d) => d.day), ['Tue']);
    assert.deepEqual(week.days.filter((d) => d.today).map((d) => d.day), ['Wed']);
  });

  it('compares volume with the previous period and reports planned-vs-done', () => {
    const data = history();
    const perf = performanceSummary(Object.values(data.sessions), Object.values(data.scheduled), '4w', NOW);
    // In window: 70, 65, 80 (x5 reps) = 1075. Previous 4 weeks: 60 x5 = 300.
    assert.equal(perf.volumeChangePct, Math.round(((1075 - 300) / 300) * 100));
    assert.equal(perf.sessionCount, 3);
    assert.equal(perf.prCount, 2);
    assert.deepEqual([perf.plannedCompletedCount, perf.plannedCount, perf.consistencyPct], [3, 3, 100]);
  });

  it('groups endurance efforts into distance benchmarks within 5%', () => {
    const run = (atMs: number, meters: number, seconds: number): Session => {
      const b = block({ format: 'continuous', distanceMeters: meters }, [ex('Run', { distanceMeters: meters })], 'endurance');
      return {
        id: newUuid(), workoutId: 'w', versionId: 'v', prescribed: { title: 'Run', sport: 'running', blocks: [b] },
        status: 'completed', entryMode: 'manual', startedAt: atMs, updatedAt: atMs,
        blockResults: [{ blockId: b.id, status: 'completed', elapsedSeconds: seconds, score: { type: 'distance', meters }, stepResults: [] }],
      };
    };
    const sessions = [run(NOW - 30 * DAY, 5000, 1668), run(NOW - 10 * DAY, 5100, 1500), run(NOW - 2 * DAY, 10000, 3300)];
    const efforts = enduranceEfforts(sessions);
    assert.equal(efforts.length, 3);
    const fiveK = enduranceSeries(efforts, '5km', 'all', NOW);
    assert.equal(fiveK?.points.length, 2, 'the 10 km is not a 5 km benchmark');
    assert.deepEqual([fiveK?.currentLabel, fiveK?.deltaLabel, fiveK?.deltaPct], ['25:00 min', '-2:48 min', -10]);
    assert.equal(enduranceSeries(efforts, 'all', 'all', NOW)?.points.length, 3);
  });

  it('writes insights that cite their numbers', () => {
    const data = history();
    const insights = buildInsights(Object.values(data.sessions), Object.values(data.scheduled), NOW);
    const byId = Object.fromEntries(insights.map((i) => [i.id, i.body]));
    assert.equal(byId.week, 'You completed 1 session so far this week.');
    assert.match(byId.record, /^Back Squat: 80 kg on .+, up from 70 kg\.$/);
    assert.match(byId.strength, /^Back Squat is up 20 kg across 4 sessions since /);
    assert.equal(byId.consistency, 'You completed 3 of 3 planned sessions in the last four weeks.');
  });
});
