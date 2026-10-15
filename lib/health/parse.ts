import { tr } from '../i18n/tr';
import { Decoder, Stream } from '@garmin/fitsdk';
import { XMLParser } from 'fast-xml-parser';
import type { Sport } from '../workout/model';
import type { ActivitySeries, ParseResult, ParsedActivity, QualityFlag } from './model';

/**
 * Reads GPX, TCX and FIT activity files into one activity summary.
 *
 * Totals the file states itself (a FIT session's distance, a TCX lap's time)
 * are preferred over totals recomputed from track points, because the
 * device saw more than the points it kept. Anything the file does not
 * contain stays undefined and is flagged, not estimated.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

type Point = {
  t?: number;
  lat?: number;
  lon?: number;
  ele?: number;
  hr?: number;
  dist?: number;
  power?: number;
  cadence?: number;
};

// ------------------------------------------------------------- helpers

/** 53-bit content hash (cyrb53). Stable across devices, so re-importing the same file is recognised. */
export function contentHash(bytes: Uint8Array): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 2654435761);
    h2 = Math.imul(h2 ^ bytes[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function haversine(a: Point, b: Point): number {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = ((b.lat as number) - (a.lat as number)) * rad;
  const dLon = ((b.lon as number) - (a.lon as number)) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat as number) * rad) * Math.cos((b.lat as number) * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

const avg = (values: (number | undefined)[]): number | undefined => {
  const xs = values.filter((v): v is number => typeof v === 'number' && v > 0);
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined;
};

/** Ascent with a 2 m hysteresis, so GPS altitude noise does not add up to a hill. */
function elevationGain(points: Point[]): number | undefined {
  const eles = points.map((p) => p.ele).filter((e): e is number => e !== undefined);
  if (eles.length < 2) return undefined;
  let gain = 0;
  let anchor = eles[0];
  for (const e of eles) {
    if (e - anchor >= 2) {
      gain += e - anchor;
      anchor = e;
    } else if (e < anchor) {
      anchor = e;
    }
  }
  return Math.round(gain);
}

/** One heart-rate value every `intervalSeconds`, at most 600 points, gaps kept as null. */
function heartRateSeries(points: Point[], startMs: number, endMs: number): ActivitySeries | undefined {
  const withHr = points.filter((p) => p.t !== undefined && p.hr !== undefined);
  if (withHr.length < 2) return undefined;
  const totalSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));
  const intervalSeconds = Math.max(5, Math.ceil(totalSeconds / 600 / 5) * 5);
  const buckets: number[][] = Array.from({ length: Math.ceil(totalSeconds / intervalSeconds) + 1 }, () => []);
  for (const p of withHr) buckets[Math.floor(((p.t as number) - startMs) / 1000 / intervalSeconds)]?.push(p.hr as number);
  return { metric: 'heart_rate_bpm', intervalSeconds, values: buckets.map((b) => (b.length ? Math.round(b.reduce((a, c) => a + c, 0) / b.length) : null)) };
}

function sportFrom(raw: string | undefined): Sport {
  const s = (raw ?? '').toLowerCase();
  if (/run|jog|trail/.test(s)) return 'running';
  if (/bik|cycl|ride|bicycl|ebike/.test(s)) return 'cycling';
  if (/swim/.test(s)) return 'swimming';
  if (/multisport|triathlon|transition/.test(s)) return 'triathlon';
  if (/yoga/.test(s)) return 'yoga';
  if (/hiit|interval|crossfit|cardio/.test(s)) return 'hiit';
  if (/strength|weight/.test(s)) return 'strength';
  if (/walk|hik/.test(s)) return 'endurance';
  return 'other';
}

/** Summaries derived from the points, used where the file gives no total of its own. */
function summarise(points: Point[]) {
  const timed = points.filter((p) => p.t !== undefined).sort((a, b) => (a.t as number) - (b.t as number));
  const located = points.filter((p) => p.lat !== undefined && p.lon !== undefined);
  const flags: QualityFlag[] = [];

  let distance: number | undefined;
  const lastDist = [...points].reverse().find((p) => p.dist !== undefined)?.dist;
  if (lastDist !== undefined) distance = lastDist;
  else if (located.length >= 2) {
    distance = 0;
    for (let i = 1; i < located.length; i++) distance += haversine(located[i - 1], located[i]);
  }

  let moving: number | undefined;
  if (timed.length >= 2 && located.length >= 2) {
    moving = 0;
    let gaps = 0;
    let fastest = 0;
    for (let i = 1; i < timed.length; i++) {
      const [a, b] = [timed[i - 1], timed[i]];
      const dt = ((b.t as number) - (a.t as number)) / 1000;
      if (dt <= 0) continue;
      if (dt > 120) gaps++;
      if (a.lat === undefined || b.lat === undefined) continue;
      const speed = haversine(a, b) / dt;
      fastest = Math.max(fastest, speed);
      // Under 0.5 m/s counts as standing still; a gap of more than two minutes is a pause, not movement.
      if (speed >= 0.5 && dt <= 120) moving += dt;
    }
    moving = Math.round(moving);
    if (gaps > 0) flags.push('gps_gaps');
    if (fastest > 40) flags.push('implausible_speed');
  }

  return {
    startedAt: timed[0]?.t,
    endedAt: timed[timed.length - 1]?.t,
    distance: distance !== undefined ? Math.round(distance) : undefined,
    moving,
    elevationGain: elevationGain(points),
    avgHr: avg(points.map((p) => p.hr)),
    maxHr: points.reduce<number | undefined>((m, p) => (p.hr !== undefined && (m === undefined || p.hr > m) ? p.hr : m), undefined),
    avgPower: avg(points.map((p) => p.power)),
    avgCadence: avg(points.map((p) => p.cadence)),
    flags,
  };
}

function finish(base: {
  format: 'gpx' | 'tcx' | 'fit';
  hash: string;
  points: Point[];
  sport: Sport;
  name?: string;
  device?: string;
  creator?: string;
  fileName?: string;
  totals?: Partial<{ startedAt: number; elapsed: number; moving: number; distance: number; ascent: number; avgHr: number; maxHr: number; avgPower: number; avgCadence: number; calories: number }>;
  extraFlags?: QualityFlag[];
}): ParseResult {
  const s = summarise(base.points);
  const t = base.totals ?? {};
  const startedAt = t.startedAt ?? s.startedAt;
  if (startedAt === undefined) return { ok: false, code: 'NO_ACTIVITY', message: tr('The file has no timestamps, so there is no activity to import.', 'Die Datei hat keine Zeitstempel, daher gibt es keine Aktivität zum Importieren.') };

  const elapsedFromPoints = s.endedAt !== undefined ? Math.round((s.endedAt - startedAt) / 1000) : undefined;
  const elapsed = t.elapsed !== undefined ? Math.round(t.elapsed) : elapsedFromPoints;
  if (!elapsed || elapsed <= 0) return { ok: false, code: 'NO_ACTIVITY', message: tr('The file has no recorded duration, so there is no activity to import.', 'Die Datei hat keine aufgezeichnete Dauer, daher gibt es keine Aktivität zum Importieren.') };

  const quality = new Set<QualityFlag>([...s.flags, ...(base.extraFlags ?? [])]);
  const avgHr = t.avgHr ?? s.avgHr;
  const distance = t.distance ?? s.distance;
  if (avgHr === undefined) quality.add('no_heart_rate');
  if (distance === undefined && base.sport !== 'strength' && base.sport !== 'yoga') quality.add('no_distance');
  if (elapsed < 120) quality.add('short_recording');

  const activity: ParsedActivity = {
    provider: 'file',
    externalId: `${base.format}:${startedAt}:${base.hash}`,
    source: { format: base.format, fileName: base.fileName, device: base.device, creator: base.creator },
    sport: base.sport,
    name: base.name,
    startedAt,
    endedAt: startedAt + elapsed * 1000,
    elapsedSeconds: elapsed,
    movingSeconds: t.moving !== undefined ? Math.round(t.moving) : s.moving,
    distanceMeters: distance !== undefined && distance > 0 ? Math.round(distance) : undefined,
    elevationGainMeters: t.ascent ?? s.elevationGain,
    avgHeartRate: avgHr,
    maxHeartRate: t.maxHr ?? s.maxHr,
    avgPowerWatts: t.avgPower ?? s.avgPower,
    avgCadence: t.avgCadence ?? s.avgCadence,
    caloriesEstimate: t.calories,
    quality: [...quality],
    series: heartRateSeries(base.points, startedAt, startedAt + elapsed * 1000),
  };
  // Drop keys with no value so "not in the file" is simply absent.
  for (const key of Object.keys(activity) as (keyof ParsedActivity)[]) if (activity[key] === undefined) delete activity[key];
  for (const key of Object.keys(activity.source) as (keyof ParsedActivity['source'])[]) if (activity.source[key] === undefined) delete activity.source[key];
  return { ok: true, activity };
}

// ------------------------------------------------------------- GPX / TCX

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', removeNSPrefix: true, parseTagValue: false, trimValues: true });

const list = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const time = (v: unknown): number | undefined => {
  const ms = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(ms) ? ms : undefined;
};

// The XML and FIT libraries return loosely shaped objects; every field read from them goes through num()/time().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;

function parseGpx(text: string, hash: string, fileName?: string): ParseResult {
  const doc: Node = xml.parse(text);
  const gpx = doc?.gpx;
  if (!gpx) return { ok: false, code: 'CORRUPT_FILE', message: tr('That file does not look like a GPX file.', 'Diese Datei sieht nicht wie eine GPX-Datei aus.') };
  const tracks = list<Node>(gpx.trk);
  const points: Point[] = [];
  for (const trk of tracks) {
    for (const seg of list<Node>(trk.trkseg)) {
      for (const p of list<Node>(seg.trkpt)) {
        const ext = p.extensions?.TrackPointExtension ?? p.extensions ?? {};
        points.push({
          t: time(p.time),
          lat: num(p['@lat']),
          lon: num(p['@lon']),
          ele: num(p.ele),
          hr: num(ext.hr ?? ext.heartrate),
          cadence: num(ext.cad ?? ext.cadence),
          power: num(ext.power ?? p.extensions?.power),
        });
      }
    }
  }
  if (points.length === 0) return { ok: false, code: 'NO_ACTIVITY', message: tr('The file has no recorded track, so there is no activity to import.', 'Die Datei hat keinen aufgezeichneten Track, daher gibt es keine Aktivität zum Importieren.') };
  const first = tracks[0] ?? {};
  return finish({
    format: 'gpx',
    hash,
    points,
    sport: sportFrom(String(first.type ?? '')),
    name: typeof first.name === 'string' ? first.name : undefined,
    creator: typeof gpx['@creator'] === 'string' ? gpx['@creator'] : undefined,
    fileName,
  });
}

function parseTcx(text: string, hash: string, fileName?: string): ParseResult {
  const doc: Node = xml.parse(text);
  const activity = list<Node>(doc?.TrainingCenterDatabase?.Activities?.Activity)[0];
  if (!activity) return { ok: false, code: 'NO_ACTIVITY', message: tr('The file has no activity in it.', 'Die Datei enthält keine Aktivität.') };
  const laps = list<Node>(activity.Lap);
  const points: Point[] = [];
  for (const lap of laps) {
    for (const track of list<Node>(lap.Track)) {
      for (const p of list<Node>(track.Trackpoint)) {
        const ext = p.Extensions?.TPX ?? {};
        points.push({
          t: time(p.Time),
          lat: num(p.Position?.LatitudeDegrees),
          lon: num(p.Position?.LongitudeDegrees),
          ele: num(p.AltitudeMeters),
          dist: num(p.DistanceMeters),
          hr: num(p.HeartRateBpm?.Value),
          cadence: num(p.Cadence ?? ext.RunCadence),
          power: num(ext.Watts),
        });
      }
    }
  }
  const sum = (key: string) => {
    const values = laps.map((l) => num(l[key])).filter((v): v is number => v !== undefined);
    return values.length === laps.length && values.length > 0 ? values.reduce((a, b) => a + b, 0) : undefined;
  };
  const maxHr = laps.map((l) => num(l.MaximumHeartRateBpm?.Value)).filter((v): v is number => v !== undefined);
  const creator = activity.Creator?.Name;
  return finish({
    format: 'tcx',
    hash,
    points,
    sport: sportFrom(String(activity['@Sport'] ?? '')),
    device: typeof creator === 'string' ? creator : undefined,
    fileName,
    totals: {
      startedAt: time(activity.Id) ?? time(laps[0]?.['@StartTime']),
      elapsed: sum('TotalTimeSeconds'),
      distance: sum('DistanceMeters'),
      calories: sum('Calories'),
      maxHr: maxHr.length ? Math.max(...maxHr) : undefined,
    },
  });
}

// ------------------------------------------------------------------ FIT

function parseFit(bytes: Uint8Array, hash: string, fileName?: string): ParseResult {
  const stream = Stream.fromByteArray(bytes);
  if (!Decoder.isFIT(stream)) return { ok: false, code: 'CORRUPT_FILE', message: tr('That file does not look like a FIT file.', 'Diese Datei sieht nicht wie eine FIT-Datei aus.') };
  const decoder = new Decoder(stream);
  const intact = decoder.checkIntegrity();
  const { messages, errors } = decoder.read({ convertTypesToStrings: true, convertDateTimesToDates: true, applyScaleAndOffset: true, mergeHeartRates: true });
  const m = messages as Node;
  const records: Node[] = m.recordMesgs ?? [];
  const session: Node = (m.sessionMesgs ?? [])[0];
  if (!session && records.length === 0) return { ok: false, code: 'NO_ACTIVITY', message: tr('The file has no activity in it.', 'Die Datei enthält keine Aktivität.') };

  const semicircles = 180 / 2 ** 31;
  const points: Point[] = records.map((r) => ({
    t: r.timestamp instanceof Date ? r.timestamp.getTime() : undefined,
    lat: num(r.positionLat) !== undefined ? (r.positionLat as number) * semicircles : undefined,
    lon: num(r.positionLong) !== undefined ? (r.positionLong as number) * semicircles : undefined,
    ele: num(r.enhancedAltitude ?? r.altitude),
    dist: num(r.distance),
    hr: num(r.heartRate),
    power: num(r.power),
    cadence: num(r.cadence),
  }));

  const fileId: Node = (m.fileIdMesgs ?? [])[0];
  const device = fileId ? [fileId.manufacturer, fileId.garminProduct ?? fileId.product].filter((v) => typeof v === 'string' || typeof v === 'number').join(' ') : undefined;
  const start: Date | undefined = session?.startTime instanceof Date ? session.startTime : undefined;

  return finish({
    format: 'fit',
    hash,
    points,
    sport: sportFrom(String(session?.sport ?? '')),
    device: device || undefined,
    fileName,
    extraFlags: !intact || errors.length ? ['file_errors'] : [],
    totals: session
      ? {
          startedAt: start?.getTime(),
          elapsed: num(session.totalElapsedTime),
          moving: num(session.totalTimerTime),
          distance: num(session.totalDistance),
          ascent: num(session.totalAscent),
          avgHr: num(session.avgHeartRate),
          maxHr: num(session.maxHeartRate),
          avgPower: num(session.avgPower),
          avgCadence: num(session.avgCadence),
          calories: num(session.totalCalories),
        }
      : undefined,
  });
}

// ---------------------------------------------------------------- entry

/** UTF-8 decoding that also works where TextDecoder is missing. */
function decodeUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  try {
    return decodeURIComponent(escape(out));
  } catch {
    return out;
  }
}

export function detectFormat(bytes: Uint8Array, fileName?: string): 'gpx' | 'tcx' | 'fit' | undefined {
  if (bytes.length >= 12 && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === '.FIT') return 'fit';
  const head = decodeUtf8(bytes.subarray(0, 2000));
  if (/<gpx[\s>]/i.test(head)) return 'gpx';
  if (/<TrainingCenterDatabase[\s>]/i.test(head)) return 'tcx';
  const ext = fileName?.toLowerCase().split('.').pop();
  return ext === 'gpx' || ext === 'tcx' || ext === 'fit' ? ext : undefined;
}

export function parseActivityFile(bytes: Uint8Array, fileName?: string): ParseResult {
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, code: 'TOO_LARGE', message: tr('That file is larger than 25 MB.', 'Diese Datei ist größer als 25 MB.') };
  const format = detectFormat(bytes, fileName);
  if (!format) return { ok: false, code: 'UNSUPPORTED_FORMAT', message: tr('Use a GPX, TCX or FIT file, as exported by Garmin, Strava, Apple Health exporters and most watches.', 'Verwende eine GPX-, TCX- oder FIT-Datei, wie sie Garmin, Strava, Apple-Health-Exporte und die meisten Uhren erzeugen.') };
  const hash = contentHash(bytes);
  try {
    if (format === 'fit') return parseFit(bytes, hash, fileName);
    const text = decodeUtf8(bytes);
    return format === 'gpx' ? parseGpx(text, hash, fileName) : parseTcx(text, hash, fileName);
  } catch {
    return { ok: false, code: 'CORRUPT_FILE', message: tr(`That ${format.toUpperCase()} file could not be read. It may be damaged or incomplete.`, `Diese ${format.toUpperCase()}-Datei konnte nicht gelesen werden. Sie ist vielleicht beschädigt oder unvollständig.`) };
  }
}
