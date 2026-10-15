import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyseSquat, ENGINE_VERSION } from './analysis';
import { OBSERVATION_LABELS, type CameraView, type Frame, type Point, type PoseClip } from './model';
import { describeObservation, observationText } from './describe';
import { checkAnalysis } from './validate';

/**
 * Synthetic pose clips with known geometry: standing hip at y 0.5, knee at
 * 0.7, ankle at 0.9 in a square frame; each repetition goes smoothly down
 * and up again.
 */
type Spec = {
  view: CameraView;
  reps?: number;
  repSeconds?: number;
  fps?: number;
  /** Hip below (+) or above (-) the knee at the bottom, in thigh lengths, one per rep or one for all. */
  depth?: number | number[];
  leanDeg?: number;
  visibility?: number;
  kneesIn?: number;
  heelLift?: number;
  missingEvery?: number;
  outOfFrame?: boolean;
};

function clip(spec: Spec): PoseClip {
  const { view, reps = 5, repSeconds = 2.5, fps = 20, depth = 0.1, leanDeg = 35, visibility = 0.92, kneesIn = 0, heelLift = 0, missingEvery = 0, outOfFrame = false } = spec;
  const lead = 1; // seconds standing before and after
  const duration = lead * 2 + reps * repSeconds;
  const frames: Frame[] = [];
  for (let k = 0; k * (1 / fps) <= duration; k++) {
    const time = k / fps;
    const inRep = time - lead;
    const r = Math.floor(inRep / repSeconds);
    const phase = inRep >= 0 && r < reps ? (1 - Math.cos((2 * Math.PI * (inRep - r * repSeconds)) / repSeconds)) / 2 : 0;
    const d = Array.isArray(depth) ? depth[Math.max(0, Math.min(reps - 1, r))] : depth;
    if (missingEvery && k % missingEvery === 0) {
      frames.push({ t: time, points: null });
      continue;
    }
    const pts: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.3, v: visibility }));
    const set = (i: number, x: number, y: number, v = visibility) => (pts[i] = { x, y, v });
    const kneeY = 0.7 + 0.02 * phase;
    const thigh = 0.2;
    const hipY = 0.5 + phase * (kneeY + d * thigh - 0.5);
    const lean = ((leanDeg * Math.PI) / 180) * phase;
    const shift = outOfFrame ? 0.6 * phase : 0;
    if (view === 'side') {
      const hipX = 0.5 - 0.12 * phase + shift;
      const kneeX = 0.56 + 0.06 * phase + shift;
      // The left side faces the camera; the right side is hidden behind it.
      const place = (i: number, x: number, y: number, far: boolean) => set(i, x + (far ? 0.01 : 0), y, far ? 0.35 : visibility);
      for (const far of [false, true]) {
        const o = far ? 1 : 0;
        place(23 + o, hipX, hipY, far);
        place(25 + o, kneeX, kneeY, far);
        place(27 + o, 0.53 + shift, 0.9, far);
        place(11 + o, hipX + Math.sin(lean) * 0.25, hipY - Math.cos(lean) * 0.25, far);
        place(29 + o, 0.5 + shift, 0.92 - heelLift * phase, far);
        place(31 + o, 0.6 + shift, 0.92, far);
      }
    } else {
      const w = (half: number, side: 1 | -1) => 0.5 + side * half + shift;
      for (const [side, o] of [[1, 0], [-1, 1]] as const) {
        set(23 + o, w(0.08, side), hipY);
        set(25 + o, w(0.09 - kneesIn * 0.07 * phase, side), kneeY);
        set(27 + o, w(0.1, side), 0.9);
        set(11 + o, w(0.12, side), hipY - 0.25);
        set(29 + o, w(0.1, side), 0.92);
        set(31 + o, w(0.11, side), 0.93);
      }
    }
    frames.push({ t: time, points: pts });
  }
  return { width: 1, height: 1, durationSeconds: duration, frames };
}

const find = (a: ReturnType<typeof analyseSquat>, label: string) => a.observations.find((o) => o.label === label);

describe('squat analysis', () => {
  it('counts repetitions and describes depth, lean and tempo from the side', () => {
    const a = analyseSquat(clip({ view: 'side', reps: 5, leanDeg: 40 }), 'side');
    assert.equal(a.quality.usable, true);
    assert.deepEqual(a.quality.limitations, []);
    assert.equal(a.repetitions, 5);
    assert.equal(find(a, 'depth')?.summary, 'Hips reached about knee height or lower in all 5 repetitions.');
    assert.equal(find(a, 'depth_consistency')?.summary, 'Depth is consistent across repetitions.');
    assert.match(find(a, 'torso_lean')!.summary, /^Moderate forward lean at the bottom \(roughly 40° from vertical\)\.$/);
    assert.equal(find(a, 'torso_lean')?.confidence, 'moderate', 'angles from one camera are never high confidence');
    assert.match(find(a, 'tempo')!.summary, /^About 1\.\d s down and 1\.\d s up per repetition\.$/);
    assert.equal(find(a, 'repetitions')?.timestamps.length, 5);
    assert.equal(a.engineVersion, ENGINE_VERSION);
  });

  it('points to the shallow repetitions when depth varies', () => {
    const a = analyseSquat(clip({ view: 'side', reps: 4, depth: [0.1, -0.5, 0.1, -0.45] }), 'side');
    assert.equal(find(a, 'depth')?.summary, 'Hips reached about knee height in 2 of 4 repetitions.');
    assert.equal(find(a, 'depth_consistency')?.summary, 'Depth varies across repetitions.');
    assert.equal(find(a, 'depth')?.timestamps.length, 2);
    assert.ok(find(a, 'depth')!.timestamps.every((t) => (t > 3 && t < 6) || t > 8), 'the 2nd and 4th repetitions');
  });

  it('notices heels lifting', () => {
    assert.equal(find(analyseSquat(clip({ view: 'side', heelLift: 0.06 }), 'side'), 'heel_lift')?.summary, 'Heels may lift at the bottom in 5 of 5 repetitions.');
    assert.equal(find(analyseSquat(clip({ view: 'side' }), 'side'), 'heel_lift')?.summary, 'Heels appear to stay down.');
  });

  it('describes the knee path and hip level from the front', () => {
    const a = analyseSquat(clip({ view: 'front', kneesIn: 1 }), 'front');
    assert.equal(a.quality.usable, true);
    assert.equal(find(a, 'knee_tracking')?.summary, 'Knees move inward at the bottom in 5 of 5 repetitions.');
    assert.equal(find(a, 'hip_symmetry')?.summary, 'Hips stay about level at the bottom.');
    assert.equal(find(analyseSquat(clip({ view: 'front' }), 'front'), 'knee_tracking')?.summary, 'Knees stay roughly in line with the feet.');
  });

  it('says it cannot assess poor footage instead of guessing', () => {
    const cases: [PoseClip, CameraView, string][] = [
      [clip({ view: 'side', visibility: 0.3 }), 'side', 'key_joints_not_visible'],
      [clip({ view: 'side', missingEvery: 1 }), 'side', 'person_not_found'],
      [clip({ view: 'front' }), 'side', 'camera_view_mismatch'],
      [clip({ view: 'side', reps: 1 }), 'side', 'too_few_repetitions'],
      [clip({ view: 'side', depth: -0.9 }), 'side', 'no_repetitions_found'],
      [clip({ view: 'side', fps: 3 }), 'side', 'low_frame_rate'],
      [clip({ view: 'side', outOfFrame: true }), 'side', 'body_out_of_frame'],
      [{ ...clip({ view: 'side' }), durationSeconds: 2 }, 'side', 'too_short'],
    ];
    for (const [c, view, reason] of cases) {
      const a = analyseSquat(c, view);
      assert.equal(a.quality.usable, false, reason);
      assert.ok(a.quality.limitations.includes(reason as never), `${reason}: got ${a.quality.limitations.join(', ')}`);
      assert.deepEqual(a.observations, [], 'no feedback on unusable footage');
    }
  });

  it('lowers confidence for partly hidden joints and missing frames, but still assesses', () => {
    const a = analyseSquat(clip({ view: 'side', visibility: 0.62, missingEvery: 4 }), 'side');
    assert.equal(a.quality.usable, true);
    assert.deepEqual(a.quality.limitations.sort(), ['partial_occlusion', 'person_missing_in_parts']);
    assert.ok(a.observations.every((o) => o.confidence !== 'high'));
  });

  it('uses only the fixed vocabulary, and the server-side check accepts what it produces', () => {
    for (const view of ['side', 'front'] as const) {
      const a = analyseSquat(clip({ view, kneesIn: view === 'front' ? 1 : 0 }), view);
      assert.ok(a.observations.every((o) => (OBSERVATION_LABELS as readonly string[]).includes(o.label)));
      assert.equal(checkAnalysis(a), undefined);
      assert.ok(a.observations.every((o) => !/diagnos|injur|risk|clear(ed|ance)|pain/i.test(o.summary)));
    }
    assert.match(checkAnalysis({ ...analyseSquat(clip({ view: 'side' }), 'side'), observations: [{ label: 'injury_risk' as never, summary: 'x', confidence: 'high', timestamps: [] }] }) ?? '', /label/);
  });

  it('rebuilds each sentence from its variant and values, so it can be shown in the reader’s language', () => {
    const a = analyseSquat(clip({ view: 'side', reps: 4, depth: [0.1, -0.5, 0.1, -0.45] }), 'side');
    for (const o of a.observations) assert.equal(describeObservation(o.label, o.variant!, o.params!), o.summary);
    assert.equal(observationText({ label: 'depth', summary: 'stored text', variant: 'some', params: { n: 5, count: 3 } }), 'Hips reached about knee height in 3 of 5 repetitions.');
    assert.equal(observationText({ label: 'depth', summary: 'stored text' }), 'stored text', 'older analyses keep their sentence');
  });
});