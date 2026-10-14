/**
 * Generates the files the end-to-end tests upload or seed: activity files
 * (GPX and a FIT made with Garmin's SDK) and stored data from older app
 * versions. Run with tsx before Playwright; writes to e2e/.fixtures.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Encoder, Profile } from '@garmin/fitsdk';
import { newUuid } from '../lib/id';
import { EMPTY_DATA, createWorkout } from '../lib/workout/state';

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

console.log(`e2e fixtures written to ${OUT}`);
