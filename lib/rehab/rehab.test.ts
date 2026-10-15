import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newUuid } from '../id';
import { ACTIVITIES } from '../workout/catalog';
import { exerciseSteps, type WorkoutContent } from '../workout/model';
import { validateWorkout } from '../workout/validate';
import { EMPTY_DATA, withCurrentShape, type WorkoutData } from '../workout/state';
import { checkWorkout, limitsOn, needsPromptCare, withoutConflicts } from './conflicts';
import { ACTIVITY_TAGS, type InjuryEpisode, type Restriction } from './model';
import { addEpisode, addSymptomLog, removeEpisode, updateEpisode } from './state';

const NOW = new Date(2026, 9, 14, 10).getTime();
const ex = (name: string, activityId: string | null) => ({ kind: 'exercise' as const, id: newUuid(), name, activityId, prescription: { reps: 10 } });

const metcon: WorkoutContent = {
  title: 'Metcon',
  sport: 'crossfit',
  blocks: [
    { id: newUuid(), type: 'strength', config: { format: 'sets_reps', sets: 3 }, steps: [ex('Back Squat', 'back_squat'), ex('Strict Press', 'overhead_press')] },
    { id: newUuid(), type: 'conditioning', config: { format: 'amrap', durationSeconds: 600 }, steps: [ex('Box Jump', 'box_jump'), ex('Row', 'row'), ex('Mystery Move', null)] },
  ],
};

const restriction = (patch: Partial<Restriction> = {}): Restriction => ({
  id: newUuid(),
  episodeId: 'ep1',
  tags: ['jumping', 'running'],
  rule: 'avoid',
  issuer: { id: 'physio', name: 'Pat', role: 'physiotherapist', verified: true },
  effectiveFrom: '2026-10-01',
  status: 'active',
  createdAt: NOW,
  ...patch,
});

describe('restriction engine', () => {
  it('has movement tags for every catalog activity', () => {
    const missing = ACTIVITIES.map((a) => a.id).filter((id) => !(id in ACTIVITY_TAGS));
    assert.deepEqual(missing, []);
  });

  it('finds the exercises that clash, the most serious rule, and what it could not check', () => {
    const check = checkWorkout(metcon, limitsOn('2026-10-14', [restriction(), restriction({ tags: ['overhead'], rule: 'limit' })], []));
    assert.deepEqual(check.conflicts.map((c) => [c.stepName, c.tags.join(), c.limit.rule]), [
      ['Strict Press', 'overhead', 'limit'],
      ['Box Jump', 'jumping', 'avoid'],
    ]);
    assert.equal(check.worst, 'avoid');
    assert.deepEqual(check.unchecked.map((u) => u.stepName), ['Mystery Move']);
  });

  it('only applies restrictions in force on the workout’s date and not lifted', () => {
    const limits = (date: string) => limitsOn(date, [restriction({ effectiveFrom: '2026-10-10', expiresOn: '2026-10-20' }), restriction({ status: 'lifted', tags: ['squatting'] })], []);
    assert.equal(checkWorkout(metcon, limits('2026-10-09')).conflicts.length, 0);
    assert.equal(checkWorkout(metcon, limits('2026-10-15')).conflicts.length, 1);
    assert.equal(checkWorkout(metcon, limits('2026-10-21')).conflicts.length, 0);
  });

  it('treats the athlete’s own noted activities as a soft limit while the episode is open', () => {
    const episode: InjuryEpisode = { id: 'ep2', bodyRegion: 'knee', laterality: 'left', onsetType: 'gradual', reportedProblem: 'Sore when squatting', affectedActivities: ['squatting'], status: 'rehabilitating', createdAt: NOW, updatedAt: NOW };
    const check = checkWorkout(metcon, limitsOn('2026-10-14', [], [episode]));
    assert.deepEqual(check.conflicts.map((c) => [c.stepName, c.limit.source, c.limit.rule]), [['Back Squat', 'self', 'limit']]);
    assert.equal(checkWorkout(metcon, limitsOn('2026-10-14', [], [{ ...episode, status: 'resolved' }])).conflicts.length, 0);
  });

  it('drafts the workout without the clashing exercises, or nothing when nothing would be left', () => {
    const check = checkWorkout(metcon, limitsOn('2026-10-14', [restriction()], []));
    const draft = withoutConflicts(metcon, check);
    assert.deepEqual(draft?.blocks.map((b) => exerciseSteps(b.steps).map((s) => s.name)), [['Back Squat', 'Strict Press'], ['Row', 'Mystery Move']]);
    assert.equal(validateWorkout(draft as WorkoutContent).errors.length, 0);
    const jumpsOnly: WorkoutContent = { ...metcon, blocks: [{ ...metcon.blocks[1], steps: [ex('Box Jump', 'box_jump')] }] };
    assert.equal(withoutConflicts(jumpsOnly, checkWorkout(jumpsOnly, limitsOn('2026-10-14', [restriction()], []))), undefined);
  });

  it('escalates on any red flag and on nothing else', () => {
    assert.equal(needsPromptCare({ redFlags: [] }), false);
    assert.equal(needsPromptCare({ redFlags: ['cannot_bear_weight'] }), true);
  });
});

describe('the athlete’s rehab records', () => {
  const base = { bodyRegion: 'knee' as const, laterality: 'left' as const, onsetType: 'gradual' as const, reportedProblem: 'Pain on the outside of the knee when running', affectedActivities: ['running' as const] };

  it('keeps episodes in the athlete’s words and queues them for sync', () => {
    const res = addEpisode(EMPTY_DATA, base, NOW);
    assert.ok(res.ok);
    assert.deepEqual([res.data.episodes[res.episodeId].status, res.data.dirty.episodes], ['reported', [res.episodeId]]);
    assert.equal(addEpisode(EMPTY_DATA, { ...base, reportedProblem: '  ' }, NOW).ok, false);
    const moved = updateEpisode(res.data, res.episodeId, { status: 'rehabilitating', affectedActivities: ['running', 'jumping'] }, NOW + 1);
    assert.ok(moved.ok);
    assert.deepEqual(moved.data.episodes[res.episodeId].affectedActivities, ['running', 'jumping']);
    assert.ok(removeEpisode(moved.data, res.episodeId, NOW + 2).episodes[res.episodeId].deletedAt);
  });

  it('logs symptoms on a 0 to 10 scale, keeps red flags, refuses the impossible', () => {
    const ep = addEpisode(EMPTY_DATA, base, NOW);
    assert.ok(ep.ok);
    const log = addSymptomLog(ep.data, ep.episodeId, { intensity: 4, function: 7, context: 'after a 5 km run', redFlags: ['numbness'] }, NOW);
    assert.ok(log.ok);
    const saved = log.data.symptomLogs[log.logId];
    assert.deepEqual([saved.intensity, saved.function, saved.redFlags, saved.localDate], [4, 7, ['numbness'], '2026-10-14']);
    assert.equal(addSymptomLog(ep.data, ep.episodeId, { intensity: 11 }, NOW).ok, false);
    assert.equal(addSymptomLog(ep.data, ep.episodeId, { intensity: 3, loggedAt: NOW + 3_600_000 }, NOW).ok, false);
    assert.equal(addSymptomLog(ep.data, 'nope', { intensity: 3 }, NOW).ok, false);
  });

  it('upgrades a v6 store with empty rehab collections', () => {
    const v6 = { ...EMPTY_DATA } as Partial<WorkoutData>;
    delete v6.episodes;
    delete v6.symptomLogs;
    delete v6.clinical;
    const up = withCurrentShape(v6);
    assert.deepEqual([up.episodes, up.symptomLogs, up.clinical.restrictions, up.dirty.episodes], [{}, {}, [], []]);
  });
});
