import type { PoseClip, Frame } from './model';

/**
 * Pose landmarks from a video in the browser with MediaPipe's pose
 * landmarker. The video is decoded and analysed on this device; only the
 * library, its runtime and the model are downloaded (pinned release, jsDelivr and
 * Google's model storage). At most the
 * first 60 seconds are sampled, at about 12 frames a second.
 */
export const poseSupported = true;

const VERSION = '1.1.0';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const WASM = `${CDN}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const MAX_SECONDS = 60;
const SAMPLE_FPS = 12;

type Landmarker = { detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks: { x: number; y: number; visibility?: number }[][] }; close: () => void };
let cached: Promise<Landmarker> | null = null;
// The landmarker needs timestamps that only ever increase, across clips too.
let clock = 0;

async function landmarker(): Promise<Landmarker> {
  if (!cached) {
    cached = (async () => {
      // Loaded at run time from the same pinned CDN release as its runtime files; the bundler never sees it.
      const load = new Function('url', 'return import(url)') as (url: string) => Promise<typeof import('@mediapipe/tasks-vision')>;
      const { FilesetResolver, PoseLandmarker } = await load(`${CDN}/vision_bundle.mjs`);
      const files = await FilesetResolver.forVisionTasks(WASM);
      const make = (delegate: 'GPU' | 'CPU') =>
        PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numPoses: 1 }) as unknown as Promise<Landmarker>;
      return make('GPU').catch(() => make('CPU'));
    })();
    cached.catch(() => (cached = null));
  }
  return cached;
}

function once(el: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => (cleanup(), resolve());
    const bad = () => (cleanup(), reject(new Error('VIDEO_NOT_READABLE')));
    const cleanup = () => {
      el.removeEventListener(event, ok);
      el.removeEventListener('error', bad);
    };
    el.addEventListener(event, ok);
    el.addEventListener('error', bad);
  });
}

export async function extractPose(uri: string, onProgress?: (fraction: number) => void): Promise<PoseClip> {
  const model = await landmarker();
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.src = uri;
  await once(video, 'loadeddata');
  if (!Number.isFinite(video.duration)) {
    // Browser recordings (WebM) often carry no duration until the end has been seeked to.
    video.currentTime = 1e7;
    await once(video, 'seeked');
  }
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const seconds = Math.min(duration, MAX_SECONDS);
  const frames: Frame[] = [];
  const steps = Math.floor(seconds * SAMPLE_FPS);
  for (let k = 0; k <= steps; k++) {
    const t = k / SAMPLE_FPS;
    video.currentTime = t;
    await once(video, 'seeked');
    clock += Math.round(1000 / SAMPLE_FPS);
    const res = model.detectForVideo(video, clock);
    const pose = res.landmarks[0];
    frames.push({ t, points: pose ? pose.map((p) => ({ x: p.x, y: p.y, v: p.visibility ?? 0 })) : null });
    if (k % 6 === 0) onProgress?.(k / Math.max(steps, 1));
  }
  onProgress?.(1);
  const clip: PoseClip = { width: video.videoWidth || 1, height: video.videoHeight || 1, durationSeconds: seconds, frames, trimmed: duration > MAX_SECONDS };
  video.removeAttribute('src');
  video.load();
  return clip;
}
