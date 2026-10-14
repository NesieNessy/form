import { BLOCKING, type Analysis, type CameraView, type Confidence, type Frame, type Limitation, type Observation, type Point, type PoseClip } from './model';

/**
 * Deterministic bodyweight-squat analysis over pose landmarks (MediaPipe's
 * 33-point layout). Quality is checked first; only usable footage gets
 * observations, and every observation is a fixed template with the
 * repetitions it refers to and a confidence. Angles are given only as
 * rough, rounded descriptions because a single 2D camera cannot measure
 * them precisely.
 */

export const ENGINE_VERSION = 'squat_v1';

const P = { lShoulder: 11, rShoulder: 12, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28, lHeel: 29, rHeel: 30 } as const;
type Side = 'left' | 'right';
const sideIdx = (s: Side) =>
  s === 'left' ? { shoulder: P.lShoulder, hip: P.lHip, knee: P.lKnee, ankle: P.lAnkle, heel: P.lHeel } : { shoulder: P.rShoulder, hip: P.rHip, knee: P.rKnee, ankle: P.rAnkle, heel: P.rHeel };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};
const round1 = (x: number) => Math.round(x * 10) / 10;
const secs = (t: number) => Math.round(t * 10) / 10;

type Rep = { start: number; bottom: number; end: number }; // indices into the detected frames

export function analyseSquat(clip: PoseClip, view: CameraView): Analysis {
  const limitations: Limitation[] = [];
  const add = (l: Limitation) => !limitations.includes(l) && limitations.push(l);
  if (clip.trimmed) add('trimmed_to_60_seconds');
  const aspect = clip.width / clip.height;
  // x in units of image height, so distances and angles are not stretched.
  const pt = (f: Frame, i: number): Point => {
    const p = f.points![i];
    return { x: p.x * aspect, y: p.y, v: p.v };
  };
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const result = (usable: boolean, repetitions: number, observations: Observation[]): Analysis => ({
    engineVersion: ENGINE_VERSION,
    movementId: 'bodyweight_squat',
    cameraView: view,
    quality: { usable, limitations },
    repetitions,
    analysedSeconds: round1(clip.durationSeconds),
    observations: usable ? observations : [],
  });
  const blocked = () => limitations.some((l) => BLOCKING.includes(l));

  if (clip.durationSeconds < 3) add('too_short');
  if (clip.frames.length / Math.max(clip.durationSeconds, 0.001) < 5) add('low_frame_rate');
  const frames = clip.frames.filter((f) => f.points && f.points.length >= 33);
  const found = frames.length / Math.max(clip.frames.length, 1);
  if (found < 0.5) add('person_not_found');
  else if (found < 0.8) add('person_missing_in_parts');
  if (blocked()) return result(false, 0, []);

  // The side nearer the camera is the one seen best.
  const vis = (s: Side) => mean(frames.flatMap((f) => [sideIdx(s).hip, sideIdx(s).knee, sideIdx(s).ankle].map((i) => f.points![i].v)));
  const side: Side = vis('left') >= vis('right') ? 'left' : 'right';
  const keyVis = view === 'side' ? vis(side) : Math.min(vis('left'), vis('right'));
  if (keyVis < 0.5) add('key_joints_not_visible');
  else if (keyVis < 0.7) add('partial_occlusion');

  const keys = view === 'side' ? Object.values(sideIdx(side)).filter((i) => i !== sideIdx(side).heel) : [P.lShoulder, P.rShoulder, P.lHip, P.rHip, P.lKnee, P.rKnee, P.lAnkle, P.rAnkle];
  const outside = frames.filter((f) => keys.some((i) => f.points![i].x < -0.02 || f.points![i].x > 1.02 || f.points![i].y < -0.02 || f.points![i].y > 1.02)).length;
  if (outside / frames.length > 0.2) add('body_out_of_frame');
  if (blocked()) return result(false, 0, []);

  const s = sideIdx(side);
  const hipY = (f: Frame) => (view === 'side' ? f.points![s.hip].y : (f.points![P.lHip].y + f.points![P.rHip].y) / 2);
  const raw = frames.map(hipY);
  const y = raw.map((_, i) => mean(raw.slice(Math.max(0, i - 1), i + 2)));
  const top = quantile(y, 0.1);
  const range = quantile(y, 0.9) - top;
  const standing = frames.filter((_, i) => y[i] <= top + 0.2 * range);
  const legLen = median(standing.map((f) => (view === 'side' ? dist(pt(f, s.hip), pt(f, s.ankle)) : (dist(pt(f, P.lHip), pt(f, P.lAnkle)) + dist(pt(f, P.rHip), pt(f, P.rAnkle))) / 2)));

  // Camera angle: shoulders far apart relative to the torso means front-on.
  const ratio = median(
    standing.map((f) => {
      const torso = dist(pt(f, P.lShoulder), pt(f, P.lHip)) || 1;
      return Math.abs(pt(f, P.lShoulder).x - pt(f, P.rShoulder).x) / torso;
    })
  );
  const seen: CameraView | 'unclear' = ratio > 0.45 ? 'front' : ratio < 0.3 ? 'side' : 'unclear';
  if (seen === 'unclear') add('camera_view_unclear');
  else if (seen !== view) add('camera_view_mismatch');

  const reps: Rep[] = [];
  if (legLen > 0 && range >= 0.25 * legLen) {
    let state: 'up' | 'down' = 'up';
    let lastUp = 0;
    let bottom = 0;
    for (let i = 0; i < y.length; i++) {
      if (state === 'up') {
        if (y[i] <= top + 0.25 * range) lastUp = i;
        else if (y[i] >= top + 0.45 * range) {
          state = 'down';
          bottom = i;
        }
      } else {
        if (y[i] > y[bottom]) bottom = i;
        if (y[i] <= top + 0.25 * range) {
          reps.push({ start: lastUp, bottom, end: i });
          state = 'up';
          lastUp = i;
        }
      }
    }
  }
  if (reps.length === 0) add('no_repetitions_found');
  else if (reps.length < 2) add('too_few_repetitions');
  if (blocked()) return result(false, reps.length, []);

  const t = (i: number) => secs(frames[i].t);
  const n = reps.length;
  const bottoms = reps.map((r) => frames[r.bottom]);
  const confidence = (indices: number[], cap: Confidence = 'high'): Confidence => {
    const v = mean(bottoms.flatMap((f) => indices.map((i) => f.points![i].v)));
    let c: Confidence = v >= 0.85 && n >= 4 ? 'high' : v >= 0.65 ? 'moderate' : 'low';
    if (limitations.includes('camera_view_unclear') || limitations.includes('partial_occlusion')) c = c === 'high' ? 'moderate' : 'low';
    return cap === 'moderate' && c === 'high' ? 'moderate' : cap === 'low' ? 'low' : c;
  };
  const fps = clip.frames.length / clip.durationSeconds;
  const obs: Observation[] = [{ label: 'repetitions', summary: n === 1 ? '1 repetition found.' : `${n} repetitions found.`, confidence: confidence([s.hip], 'high'), timestamps: reps.map((r) => t(r.bottom)) }];

  if (view === 'side') {
    // Hip height relative to the knee at the bottom, in thigh lengths (positive = hip below knee).
    const depth = bottoms.map((f) => (pt(f, s.hip).y - pt(f, s.knee).y) / (dist(pt(f, s.hip), pt(f, s.knee)) || 1));
    const reached = depth.map((d) => d >= -0.05);
    const shallow = reps.filter((_, i) => !reached[i]).map((r) => t(r.bottom));
    const count = reached.filter(Boolean).length;
    obs.push({
      label: 'depth',
      summary: count === n ? `Hips reached about knee height or lower in all ${n} repetitions.` : count === 0 ? `Hips stayed above knee height in all ${n} repetitions.` : `Hips reached about knee height in ${count} of ${n} repetitions.`,
      confidence: confidence([s.hip, s.knee]),
      timestamps: shallow,
    });
    const spread = Math.max(...depth) - Math.min(...depth);
    const order = depth.map((d, i) => ({ d, i })).sort((a, b) => a.d - b.d);
    obs.push(
      spread > 0.35
        ? { label: 'depth_consistency', summary: 'Depth varies across repetitions.', confidence: confidence([s.hip, s.knee]), timestamps: order.slice(0, 2).map((o) => t(reps[o.i].bottom)).sort((a, b) => a - b) }
        : { label: 'depth_consistency', summary: 'Depth is consistent across repetitions.', confidence: confidence([s.hip, s.knee]), timestamps: [] }
    );
    const lean = mean(bottoms.map((f) => (Math.atan2(Math.abs(pt(f, s.shoulder).x - pt(f, s.hip).x), pt(f, s.hip).y - pt(f, s.shoulder).y) * 180) / Math.PI));
    const rough = Math.round(lean / 5) * 5;
    obs.push({
      label: 'torso_lean',
      summary: lean < 30 ? `The torso stays fairly upright at the bottom (roughly ${rough}° from vertical).` : lean <= 50 ? `Moderate forward lean at the bottom (roughly ${rough}° from vertical).` : `Pronounced forward lean at the bottom (roughly ${rough}° from vertical).`,
      confidence: confidence([s.shoulder, s.hip], 'moderate'),
      timestamps: [],
    });
    const heelVis = mean(frames.map((f) => f.points![s.heel].v));
    if (heelVis < 0.6) add('feet_not_clear');
    else {
      const heelStand = median(standing.map((f) => f.points![s.heel].y));
      const lifted = reps.filter((r) => (heelStand - frames[r.bottom].points![s.heel].y) / legLen > 0.04).map((r) => t(r.bottom));
      obs.push(
        lifted.length * 2 >= n
          ? { label: 'heel_lift', summary: `Heels may lift at the bottom in ${lifted.length} of ${n} repetitions.`, confidence: confidence([s.heel], 'moderate'), timestamps: lifted }
          : { label: 'heel_lift', summary: 'Heels appear to stay down.', confidence: confidence([s.heel], 'moderate'), timestamps: [] }
      );
    }
  } else {
    // Knees closer to the midline than the ankles at the bottom.
    const inward = reps.filter((r) => {
      const f = frames[r.bottom];
      const mid = (pt(f, P.lHip).x + pt(f, P.rHip).x) / 2;
      const hipW = Math.abs(pt(f, P.lHip).x - pt(f, P.rHip).x) || 1;
      return ([['l', P.lKnee, P.lAnkle], ['r', P.rKnee, P.rAnkle]] as const).some(([, k, a]) => Math.abs(pt(f, k).x - mid) < Math.abs(pt(f, a).x - mid) - 0.15 * hipW);
    });
    obs.push(
      inward.length * 2 >= n
        ? { label: 'knee_tracking', summary: `Knees move inward at the bottom in ${inward.length} of ${n} repetitions.`, confidence: confidence([P.lKnee, P.rKnee, P.lAnkle, P.rAnkle]), timestamps: inward.map((r) => t(r.bottom)) }
        : { label: 'knee_tracking', summary: 'Knees stay roughly in line with the feet.', confidence: confidence([P.lKnee, P.rKnee, P.lAnkle, P.rAnkle]), timestamps: [] }
    );
    const tilt = bottoms.map((f) => (pt(f, P.lHip).y - pt(f, P.rHip).y) / (Math.abs(pt(f, P.lHip).x - pt(f, P.rHip).x) || 1));
    const lower: Side | null = tilt.filter((x) => x > 0.15).length * 2 > n ? 'left' : tilt.filter((x) => x < -0.15).length * 2 > n ? 'right' : null;
    obs.push({
      label: 'hip_symmetry',
      summary: lower ? `The ${lower} hip sits lower than the ${lower === 'left' ? 'right' : 'left'} at the bottom in most repetitions.` : 'Hips stay about level at the bottom.',
      confidence: confidence([P.lHip, P.rHip], 'moderate'),
      timestamps: [],
    });
    const excursion = reps.map((r) => (y[r.bottom] - y[r.start]) / legLen);
    const varies = Math.max(...excursion) - Math.min(...excursion) > 0.25 * mean(excursion);
    const order = excursion.map((d, i) => ({ d, i })).sort((a, b) => a.d - b.d);
    obs.push({
      label: 'depth_consistency',
      summary: varies ? 'Depth varies across repetitions.' : 'Depth is consistent across repetitions.',
      confidence: confidence([P.lHip, P.rHip]),
      timestamps: varies ? order.slice(0, 2).map((o) => t(reps[o.i].bottom)).sort((a, b) => a - b) : [],
    });
  }

  // Tempo from near standing to the bottom and back, not from the counting thresholds.
  const near = top + 0.05 * range;
  const from = (r: Rep) => {
    let i = r.bottom;
    while (i > 0 && y[i - 1] > near && i > r.start - Math.round(fps)) i--;
    return i;
  };
  const to = (r: Rep) => {
    let i = r.bottom;
    while (i < y.length - 1 && y[i + 1] > near && i < r.end + Math.round(fps)) i++;
    return i;
  };
  const down = mean(reps.map((r) => frames[r.bottom].t - frames[from(r)].t));
  const up = mean(reps.map((r) => frames[to(r)].t - frames[r.bottom].t));
  obs.push({ label: 'tempo', summary: `About ${round1(down)} s down and ${round1(up)} s up per repetition.`, confidence: fps >= 15 ? confidence([s.hip]) : 'low', timestamps: [] });

  return result(true, n, obs);
}
