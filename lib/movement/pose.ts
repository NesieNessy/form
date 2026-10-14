import type { PoseClip } from './model';

/**
 * Pose estimation runs on the device so no frame leaves it. The web build
 * uses MediaPipe in the browser (pose.web.ts); a native implementation is
 * still to come, so phones say so instead of guessing.
 */
export const poseSupported = false;

export async function extractPose(_uri: string, _onProgress?: (fraction: number) => void): Promise<PoseClip> {
  throw new Error('POSE_NOT_SUPPORTED');
}
