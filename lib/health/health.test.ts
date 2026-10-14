import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Encoder, Profile } from '@garmin/fitsdk';
import { newUuid } from '../id';
import type { WorkoutContent } from '../workout/model';
import { EMPTY_DATA, attachToUser, clearDirty, createWorkout, mergeRemote, withCurrentShape, type WorkoutData } from '../workout/state';
import { validateWorkout } from '../workout/validate';
import { BASELINE_POLICY, duplicateCandidates, matchCandidates, metricOverview, personalBaseline } from './logic';
import { localDateOf, validateObservation, type HealthObservation, type ParsedActivity } from './model';
import { contentHash, detectFormat, parseActivityFile } from './parse';
import { addObservation, importActivity, linkActivity, logActivityAsWorkout, removeActivity, removeSource, setActivityStatus } from './state';

const enc = (s: string) => new TextEncoder().encode(s);
const START = Date.UTC(2026, 9, 12, 7, 0, 0);

/** A straight-line run north: one point every 10 s at ~3 m/s, heart rate rising, a 1 m climb every point. */
function trackPoints(count = 61, opts: { gapAt?: number } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    t: START + i * 10_000 + (opts.gapAt !== undefined && i >= opts.gapAt ? 300_000 : 0),
    lat: 52.5 + (i * 30) / 111_195,
    lon: 13.4,
    ele: 40 + i,
    hr: 120 + i,
  }));
}

function gpx(points = trackPoints(), type = 'running') {
  return `<?xml version="1.0"?>
<gpx version="1.1" creator="Test Watch" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>Morning Run</name><type>${type}</type><trkseg>
${points.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.ele}</ele><time>${new Date(p.t).toISOString()}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${p.hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`).join('\n')}
</trkseg></trk></gpx>`;
}

function tcx() {
  const pts = trackPoints();
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
<Activities><Activity Sport="Biking"><Id>${new Date(START).toISOString()}</Id>
<Lap StartTime="${new Date(START).toISOString()}"><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters><Calories>150</Calories><MaximumHeartRateBpm><Value>181</Value></MaximumHeartRateBpm>
<Track>${pts.map((p, i) => `<Trackpoint><Time>${new Date(p.t).toISOString()}</Time><DistanceMeters>${(i * 5000) / 60}</DistanceMeters><HeartRateBpm><Value>${p.hr}</Value></HeartRateBpm></Trackpoint>`).join('')}</Track></Lap>
<Creator><Name>Edge 540</Name></Creator></Activity></Activities></TrainingCenterDatabase>`;
}

function fit(options: { withSession?: boolean } = {}) {
  const encoder = new Encoder();
  // The SDK's typings only know the generic message shape; field names follow its Profile.
  const onMesg = (num: number, fields: Record<string, unknown>) => encoder.onMesg(num, fields as Parameters<Encoder['onMesg']>[1]);
  const start = new Date(START);
  onMesg(Profile.MesgNum.FILE_ID, { manufacturer: 'development', product: 1, timeCreated: start, type: 'activity' });
  for (let i = 0; i <= 60; i++) {
    onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(START + i * 10_000), heartRate: 130 + (i % 10), distance: i * 30, power: 200 + i });
  }
  if (options.withSession !== false) {
    onMesg(Profile.MesgNum.SESSION, {
      timestamp: new Date(START + 600_000),
      startTime: start,
      sport: 'cycling',
      totalElapsedTime: 660,
      totalTimerTime: 600,
      totalDistance: 1800,
      totalAscent: 25,
      avgHeartRate: 134,
      maxHeartRate: 139,
      avgPower: 230,
      totalCalories: 140,
    });
  }
  return encoder.close();
}

describe('activity files', () => {
  it('reads a GPX track: distance, moving time, climb and heart rate from the points', () => {
    const res = parseActivityFile(enc(gpx()), 'run.gpx');
    assert.ok(res.ok, JSON.stringify(res));
    const a = res.activity;
    assert.deepEqual([a.sport, a.name, a.source.format, a.source.creator], ['running', 'Morning Run', 'gpx', 'Test Watch']);
    assert.equal(a.startedAt, START);
    assert.equal(a.elapsedSeconds, 600);
    assert.ok(Math.abs((a.distanceMeters ?? 0) - 1800) <= 2, `distance ${a.distanceMeters}`);
    assert.equal(a.movingSeconds, 600);
    assert.equal(a.elevationGainMeters, 60);
    assert.deepEqual([a.avgHeartRate, a.maxHeartRate], [150, 180]);
    assert.deepEqual(a.quality, []);
    assert.equal(a.series?.metric, 'heart_rate_bpm');
    assert.equal(a.series?.values.filter((v) => v !== null).length, 61);
  });

  it('prefers the totals a TCX file states over totals rebuilt from its points', () => {
    const res = parseActivityFile(enc(tcx()), 'ride.tcx');
    assert.ok(res.ok, JSON.stringify(res));
    const a = res.activity;
    assert.deepEqual([a.sport, a.source.device, a.elapsedSeconds, a.distanceMeters, a.caloriesEstimate, a.maxHeartRate], ['cycling', 'Edge 540', 600, 5000, 150, 181]);
    assert.ok(a.quality.includes('no_distance') === false);
  });

  it('decodes a FIT file with the official SDK and uses its session totals', () => {
    const bytes = fit();
    assert.equal(detectFormat(bytes), 'fit');
    const res = parseActivityFile(bytes, 'ride.fit');
    assert.ok(res.ok, JSON.stringify(res));
    const a = res.activity;
    assert.deepEqual(
      [a.sport, a.startedAt, a.elapsedSeconds, a.movingSeconds, a.distanceMeters, a.elevationGainMeters, a.avgHeartRate, a.maxHeartRate, a.avgPowerWatts, a.caloriesEstimate],
      ['cycling', START, 660, 600, 1800, 25, 134, 139, 230, 140]
    );
    assert.deepEqual(a.quality, [], 'a clean file has no quality flags');
  });

  it('falls back to the records when a FIT file has no session summary', () => {
    const res = parseActivityFile(fit({ withSession: false }), 'partial.fit');
    assert.ok(res.ok, JSON.stringify(res));
    assert.deepEqual([res.activity.elapsedSeconds, res.activity.distanceMeters, res.activity.avgHeartRate, res.activity.sport], [600, 1800, 134, 'other']);
  });

  it('flags gaps and missing heart rate instead of filling them', () => {
    const pts = trackPoints(61, { gapAt: 30 }).map(({ hr: _hr, ...p }) => ({ ...p, hr: undefined as unknown as number }));
    const text = gpx(pts).replace(/<extensions>.*?<\/extensions>/g, '');
    const res = parseActivityFile(enc(text));
    assert.ok(res.ok);
    assert.ok(res.activity.quality.includes('gps_gaps'));
    assert.ok(res.activity.quality.includes('no_heart_rate'));
    assert.equal(res.activity.avgHeartRate, undefined);
    assert.equal(res.activity.movingSeconds, 590, 'the five-minute pause is not counted as moving');
  });

  it('gives the same id to the same file and a different one to a different file', () => {
    const a = parseActivityFile(enc(gpx()));
    const b = parseActivityFile(enc(gpx()));
    const c = parseActivityFile(enc(gpx(trackPoints(62))));
    assert.ok(a.ok && b.ok && c.ok);
    assert.equal(a.activity.externalId, b.activity.externalId);
    assert.notEqual(a.activity.externalId, c.activity.externalId);
    assert.notEqual(contentHash(enc('x')), contentHash(enc('y')));
  });

  it('rejects what it cannot read with a reason', () => {
    const cases: [Uint8Array, string, string][] = [
      [enc('hello'), 'notes.txt', 'UNSUPPORTED_FORMAT'],
      [enc('<gpx><trk><trkseg></trkseg></trk></gpx>'), 'empty.gpx', 'NO_ACTIVITY'],
      [enc('<gpx><trk><trkseg><trkpt lat="1" lon="2"></trkpt></trkseg></trk></gpx>'), 'notime.gpx', 'NO_ACTIVITY'],
      [new Uint8Array(26 * 1024 * 1024), 'huge.fit', 'TOO_LARGE'],
      [fit().slice(0, 40), 'cut.fit', 'NO_ACTIVITY'],
    ];
    for (const [bytes, name, code] of cases) {
      const res = parseActivityFile(bytes, name);
      assert.deepEqual([res.ok, !res.ok && res.code], [false, code], name);
    }
  });
});

const parsedRun = (): ParsedActivity => {
  const res = parseActivityFile(enc(gpx()), 'run.gpx');
  assert.ok(res.ok);
  return res.activity;
};

const plannedRun = (): WorkoutContent => ({
  title: 'Easy run',
  sport: 'running',
  blocks: [{ id: newUuid(), type: 'endurance', config: { format: 'continuous', durationSeconds: 1800 }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Run', activityId: 'run', prescription: { durationSeconds: 1800 } }] }],
});

describe('activities in the store', () => {
  const NOW = START + 3_600_000;

  it('imports once: the same file again changes nothing', () => {
    const first = importActivity(EMPTY_DATA, parsedRun(), NOW);
    const again = importActivity(first.data, parsedRun(), NOW + 5);
    assert.equal(again.alreadyImported, true);
    assert.equal(again.data, first.data);
    assert.equal(Object.keys(again.data.activities).length, 1);
    assert.deepEqual(first.data.dirty.activities, [first.activityId]);
  });

  it('suggests, never decides, that two recordings are the same effort', () => {
    const watch = importActivity(EMPTY_DATA, parsedRun(), NOW);
    const phone = { ...parsedRun(), externalId: 'gpx:other-app', startedAt: START + 90_000, distanceMeters: 1830, elapsedSeconds: 610 };
    const both = importActivity(watch.data, phone, NOW);
    const a = both.data.activities[watch.activityId];
    const b = both.data.activities[both.activityId];
    assert.deepEqual(duplicateCandidates(b, Object.values(both.data.activities)).map((x) => x.id), [a.id]);
    assert.equal(b.status, 'new', 'nothing is merged automatically');

    const ride = { ...b, sport: 'cycling' as const };
    assert.deepEqual(duplicateCandidates(ride, [a]), [], 'a ride is not a duplicate of a run');
    const later = { ...b, startedAt: START + 20 * 60_000 };
    assert.deepEqual(duplicateCandidates(later, [a]), [], 'twenty minutes apart is a second session');

    const marked = setActivityStatus(both.data, b.id, 'duplicate', NOW, a.id);
    assert.deepEqual([marked.activities[b.id].status, marked.activities[b.id].duplicateOfId], ['duplicate', a.id]);
  });

  it('matches an activity to the planned workout that day and completes it with real numbers', () => {
    const plannedAt = START + 30 * 60_000;
    const created = createWorkout(EMPTY_DATA, plannedRun(), { source: 'manual', scheduledAt: plannedAt, nowMs: NOW });
    const other = createWorkout(created.data, { ...plannedRun(), title: 'Swim', sport: 'swimming' }, { source: 'manual', scheduledAt: plannedAt, nowMs: NOW });
    const imported = importActivity(other.data, parsedRun(), NOW);
    const activity = imported.data.activities[imported.activityId];

    const candidates = matchCandidates(activity, Object.values(imported.data.scheduled), imported.data.versions);
    assert.deepEqual(candidates.map((c) => [c.entry.id, c.confidence]), [[created.scheduledId, 'likely'], [other.scheduledId, 'possible']]);

    const linked = linkActivity(imported.data, imported.activityId, created.scheduledId as string, NOW);
    const session = Object.values(linked.sessions)[0];
    assert.deepEqual([session.status, session.entryMode, session.startedAt, session.scheduledWorkoutId], ['completed', 'import', START, created.scheduledId]);
    assert.deepEqual(session.blockResults[0].score, { type: 'distance', meters: activity.distanceMeters });
    assert.equal(session.blockResults[0].elapsedSeconds, 600);
    assert.equal(session.prescribed.blocks[0].config.format === 'continuous' && session.prescribed.blocks[0].config.durationSeconds, 1800, 'the plan stays the plan');
    assert.deepEqual([linked.scheduled[created.scheduledId as string].status, linked.activities[imported.activityId].status], ['completed', 'linked']);
    assert.equal(matchCandidates(activity, Object.values(linked.scheduled), linked.versions).length, 1, 'a completed workout is no longer offered');
    assert.equal(linkActivity(linked, imported.activityId, other.scheduledId as string, NOW), linked, 'an activity is used once');
  });

  it('does not score a structured workout from a file that cannot describe its structure', () => {
    const intervals: WorkoutContent = {
      title: 'Intervals',
      sport: 'running',
      blocks: [
        { id: newUuid(), type: 'warmup', config: { format: 'continuous', durationSeconds: 600 }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Run', activityId: 'run', prescription: {} }] },
        { id: newUuid(), type: 'interval', config: { format: 'repeating_interval', intervalSeconds: 120, rounds: 6, workSeconds: 60 }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Run', activityId: 'run', prescription: {} }] },
      ],
    };
    const created = createWorkout(EMPTY_DATA, intervals, { source: 'manual', scheduledAt: START, nowMs: NOW });
    const imported = importActivity(created.data, parsedRun(), NOW);
    const linked = linkActivity(imported.data, imported.activityId, created.scheduledId as string, NOW);
    const session = Object.values(linked.sessions)[0];
    assert.deepEqual(session.blockResults.map((r) => [r.status, r.score, r.elapsedSeconds]), [['completed', undefined, undefined], ['completed', undefined, undefined]]);
    assert.equal(session.endedAt, START + 600_000, 'the session still carries the real duration');
  });

  it('logs an unplanned activity as its own workout without inventing a plan', () => {
    const imported = importActivity(EMPTY_DATA, parsedRun(), NOW);
    const logged = logActivityAsWorkout(imported.data, imported.activityId, NOW);
    const version = Object.values(logged.versions)[0];
    const session = Object.values(logged.sessions)[0];
    assert.equal(version.content.title, 'Morning Run');
    assert.deepEqual(version.content.blocks[0].config, { format: 'continuous' }, 'no duration or distance target was made up');
    assert.equal(validateWorkout(version.content).valid, true);
    assert.equal(session.blockResults[0].score?.type, 'distance');
    assert.deepEqual([Object.values(logged.scheduled)[0].status, logged.activities[imported.activityId].status], ['completed', 'standalone']);
  });

  it('keeps the recorded result when the source data is deleted', () => {
    const imported = importActivity(EMPTY_DATA, parsedRun(), NOW);
    const logged = logActivityAsWorkout(imported.data, imported.activityId, NOW);
    const removed = removeActivity(logged, imported.activityId, NOW + 1);
    assert.ok(removed.activities[imported.activityId].deletedAt);
    assert.equal(removed.activities[imported.activityId].series, undefined, 'the raw series is dropped');
    assert.equal(Object.values(removed.sessions)[0].status, 'completed');

    const withManual = addObservation(removed, { metric: 'resting_hr_bpm', value: 52, unit: 'bpm', observedAt: NOW }, NOW).data;
    const cleared = removeSource(withManual, 'manual', NOW + 2);
    assert.ok(Object.values(cleared.observations).every((o) => o.deletedAt));
  });

  it('syncs health records like the rest, and upgrades an older store', () => {
    const imported = importActivity(EMPTY_DATA, parsedRun(), NOW);
    const withObs = addObservation(imported.data, { metric: 'weight_kg', value: 74.2, unit: 'kg', observedAt: NOW }, NOW);
    const adopted = attachToUser(clearDirty(withObs.data, { activities: [imported.activityId], observations: [withObs.observationId] }), 'user-a');
    assert.deepEqual([adopted.dirty.activities, adopted.dirty.observations], [[imported.activityId], [withObs.observationId]]);

    const clean = clearDirty(adopted, { activities: [imported.activityId] });
    const remote = { ...clean.activities[imported.activityId], status: 'ignored' as const, updatedAt: NOW + 10 };
    const merged = mergeRemote(clean, { workouts: [], versions: [], scheduled: [], sessions: [], benchmarks: [], activities: [remote], observations: [], foods: [], foodLog: [], savedMeals: [] });
    assert.equal(merged.activities[imported.activityId].status, 'ignored');

    const v3 = { ...EMPTY_DATA } as Partial<WorkoutData>;
    delete v3.activities;
    delete v3.observations;
    v3.dirty = { versions: ['x'] } as WorkoutData['dirty'];
    const upgraded = withCurrentShape(v3);
    assert.deepEqual([upgraded.activities, upgraded.observations, upgraded.dirty.versions, upgraded.dirty.activities], [{}, {}, ['x'], []]);
  });
});

describe('measurements and baselines', () => {
  const day = (offset: number) => START + offset * 86_400_000;
  const obs = (offset: number, value: number, extra: Partial<HealthObservation> = {}): HealthObservation => ({
    id: newUuid(),
    metric: 'resting_hr_bpm',
    value,
    unit: 'bpm',
    observedAt: day(offset),
    localDate: localDateOf(day(offset)),
    ingestedAt: day(offset),
    provider: 'manual',
    origin: 'user_entered',
    updatedAt: day(offset),
    ...extra,
  });

  it('validates range, method and date', () => {
    assert.deepEqual(validateObservation({ metric: 'resting_hr_bpm', value: 52, observedAt: START }, START), []);
    assert.deepEqual(validateObservation({ metric: 'resting_hr_bpm', value: 520, observedAt: START }, START).map((i) => i.field), ['value']);
    assert.deepEqual(validateObservation({ metric: 'hrv_ms', value: 60, observedAt: START }, START).map((i) => i.field), ['method'], 'HRV needs its method');
    assert.deepEqual(validateObservation({ metric: 'hrv_ms', value: 60, observedAt: START, method: 'rmssd' }, START), []);
    assert.deepEqual(validateObservation({ metric: 'weight_kg', value: 74, observedAt: START + 86_400_000 }, START).map((i) => i.field), ['observedAt']);
  });

  it(`has no baseline until ${BASELINE_POLICY.minDays} days of data in ${BASELINE_POLICY.windowDays}`, () => {
    const six = [0, 1, 2, 3, 4, 5].map((d) => obs(d, 50 + d));
    assert.deepEqual(personalBaseline(six, 'resting_hr_bpm', localDateOf(day(6))), { status: 'insufficient', metric: 'resting_hr_bpm', days: 6, needed: 7, version: 'baseline_v1' });
  });

  it('uses one value per day and the median, so one outlier does not move it', () => {
    const values = [50, 51, 52, 50, 49, 51, 120];
    const list = [...values.map((v, d) => obs(d, v)), obs(3, 99, { observedAt: day(3) - 3_600_000 })]; // an earlier reading on day 3 is superseded
    const b = personalBaseline(list, 'resting_hr_bpm', localDateOf(day(7)));
    assert.ok(b.status === 'ready');
    assert.deepEqual([b.median, b.spread, b.days], [51, 1, 7]);
  });

  it('ignores values older than the window and does not count the day being judged', () => {
    const old = [0, 1, 2, 3, 4, 5, 6].map((d) => obs(d - 40, 60));
    const recent = [0, 1, 2].map((d) => obs(d, 50));
    assert.equal(personalBaseline([...old, ...recent, obs(3, 70)], 'resting_hr_bpm', localDateOf(day(3))).status, 'insufficient');
  });

  it('never mixes HRV measured with different methods', () => {
    const rmssd = [0, 1, 2, 3, 4, 5, 6].map((d) => obs(d, 60, { metric: 'hrv_ms', unit: 'ms', method: 'rmssd' }));
    const sdnn = [0, 1, 2].map((d) => obs(d, 110, { metric: 'hrv_ms', unit: 'ms', method: 'sdnn' }));
    const b = personalBaseline([...rmssd, ...sdnn], 'hrv_ms', localDateOf(day(7)), 'rmssd');
    assert.ok(b.status === 'ready' && b.median === 60 && b.days === 7);
    assert.equal(personalBaseline([...rmssd, ...sdnn], 'hrv_ms', localDateOf(day(7)), 'sdnn').status, 'insufficient');
  });

  it('describes today against the athlete’s own normal, and stays quiet without one', () => {
    const list = [...[0, 1, 2, 3, 4, 5, 6].map((d) => obs(d, 50 + (d % 2))), obs(7, 58)];
    const rhr = metricOverview(list, localDateOf(day(7))).find((m) => m.metric === 'resting_hr_bpm');
    assert.ok(rhr && rhr.baseline.status === 'ready');
    assert.deepEqual([rhr.latest?.value, rhr.difference, rhr.unusual], [58, 8, true]);
    const sleep = metricOverview(list, localDateOf(day(7))).find((m) => m.metric === 'sleep_duration_min');
    assert.deepEqual([sleep?.latest, sleep?.difference, sleep?.unusual], [undefined, undefined, undefined], 'missing is missing, not zero');
  });
});
