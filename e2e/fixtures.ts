/**
 * Generates the files the end-to-end tests upload or seed: activity files
 * (GPX and a FIT made with Garmin's SDK) and stored data from older app
 * versions. Run with tsx before Playwright; writes to e2e/.fixtures.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Encoder, Profile } from '@garmin/fitsdk';
import { newUuid } from '../lib/id';
import { addObservation } from '../lib/health/state';
import { EMPTY_DATA, completeSession, createWorkout, startSession } from '../lib/workout/state';

const OUT = join(__dirname, '.fixtures');
mkdirSync(OUT, { recursive: true });

const today = new Date();
const at = (h: number, m = 0) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m).getTime();
const RUN = at(7, 0);

function gpx(start: number, count: number, name: string, creator: string) {
  const pts = Array.from({ length: count }, (_, i) => ({ t: start + i * 10_000, lat: 52.5 + (i * 30) / 111_195, hr: 130 + (i % 20) }));
  return `<?xml version="1.0"?>
<gpx version="1.1" creator="${creator}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>${name}</name><type>running</type><trkseg>
${pts.map((p) => `<trkpt lat="${p.lat}" lon="13.4"><ele>40</ele><time>${new Date(p.t).toISOString()}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${p.hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`).join('\n')}
</trkseg></trk></gpx>`;
}

// A 30-minute run at 07:00, 5.4 km.
writeFileSync(join(OUT, 'morning-run.gpx'), gpx(RUN, 181, 'Morning Run', 'Test Watch'));
// The same run from a phone app: a minute later, slightly shorter.
writeFileSync(join(OUT, 'phone-run.gpx'), gpx(RUN + 60_000, 175, 'Run (phone)', 'Phone App'));
writeFileSync(join(OUT, 'notes.txt'), 'not an activity');

// A 30-minute ride at 17:30, 14.4 km, 210 W.
const RIDE = at(17, 30);
const encoder = new Encoder();
const onMesg = (num: number, fields: Record<string, unknown>) => encoder.onMesg(num, fields as Parameters<Encoder['onMesg']>[1]);
onMesg(Profile.MesgNum.FILE_ID, { manufacturer: 'development', product: 1, timeCreated: new Date(RIDE), type: 'activity' });
for (let i = 0; i <= 180; i++) onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(RIDE + i * 10_000), heartRate: 140, distance: i * 80, power: 210 });
onMesg(Profile.MesgNum.SESSION, {
  timestamp: new Date(RIDE + 1_800_000),
  startTime: new Date(RIDE),
  sport: 'cycling',
  totalElapsedTime: 1800,
  totalTimerTime: 1800,
  totalDistance: 14400,
  totalAscent: 120,
  avgHeartRate: 140,
  maxHeartRate: 158,
  avgPower: 210,
});
writeFileSync(join(OUT, 'evening-ride.fit'), encoder.close());

// Store v3 (before activities and measurements) with an easy run planned at 07:30 today.
const created = createWorkout(
  EMPTY_DATA,
  {
    title: 'Easy Run',
    sport: 'running',
    blocks: [{ id: newUuid(), type: 'endurance', config: { format: 'continuous', durationSeconds: 1800 }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Run', activityId: 'run', prescription: {} }] }],
  },
  { source: 'manual', scheduledAt: at(7, 30), nowMs: Date.now() }
);
const { activities: _a, observations: _o, ...v3 } = created.data;
const { activities: _da, observations: _do, ...dirty } = v3.dirty;
writeFileSync(join(OUT, 'store-v3.json'), JSON.stringify({ state: { ...v3, dirty }, version: 3 }));

// Store v4 (before nutrition) with a ride done this morning, a weight from last week, and no food log.
const ride = createWorkout(
  EMPTY_DATA,
  {
    title: 'Long Ride',
    sport: 'cycling',
    blocks: [{ id: newUuid(), type: 'endurance', config: { format: 'continuous', durationSeconds: 7200 }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Ride', activityId: 'bike', prescription: {} }] }],
  },
  { source: 'manual', scheduledAt: at(6), nowMs: Date.now() }
);
const started = startSession(ride.data, ride.scheduledId as string, 'manual', at(6));
if ('error' in started) throw new Error(started.error);
const done = completeSession(started.data, started.sessionId, { rpe: 6 }, at(8));
const weighed = addObservation(done, { metric: 'weight_kg', value: 70, unit: 'kg', observedAt: Date.now() - 7 * 86_400_000 }, Date.now()).data;
const { foods: _f, foodLog: _l, savedMeals: _m, ...v4 } = weighed;
const { foods: _df, foodLog: _dl, savedMeals: _dm, ...dirty4 } = v4.dirty;
writeFileSync(join(OUT, 'store-v4.json'), JSON.stringify({ state: { ...v4, dirty: dirty4 }, version: 4 }));

console.log(`e2e fixtures written to ${OUT}`);
