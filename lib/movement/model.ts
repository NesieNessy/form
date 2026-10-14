/**
 * Movement analysis (docs/concepts/07-stage-5-movement-analysis.md).
 * Coaching observations about what is visible in a clip, from a small
 * fixed vocabulary, with timestamps and a stated confidence. Never a
 * diagnosis, an injury prediction or a clearance. Poor footage gets
 * "cannot assess reliably" instead of feedback.
 */

export type CameraView = 'side' | 'front';
export type MovementId = 'bodyweight_squat';

export type Movement = {
  id: MovementId;
  name: string;
  views: { view: CameraView; title: string; guide: string[] }[];
};

export const MOVEMENTS: Movement[] = [
  {
    id: 'bodyweight_squat',
    name: 'Bodyweight Squat',
    views: [
      {
        view: 'side',
        title: 'From the side',
        guide: [
          'Phone at hip height, about 3 metres away, side-on to you.',
          'Your whole body in the picture, head to feet, in every repetition.',
          'Good light from the front or above, not behind you.',
          'Fitted clothing helps the hips and knees show clearly.',
          'Do 3 to 8 squats at your normal pace.',
        ],
      },
      {
        view: 'front',
        title: 'From the front',
        guide: [
          'Phone at hip height, about 3 metres away, facing you.',
          'Your whole body in the picture, head to feet, in every repetition.',
          'Good light from the front or above, not behind you.',
          'Feet visible on the floor; nothing in front of your legs.',
          'Do 3 to 8 squats at your normal pace.',
        ],
      },
    ],
  },
];

export const movementName = (id: string) => MOVEMENTS.find((m) => m.id === id)?.name ?? id;
export const viewTitle = (id: string, view: CameraView) => MOVEMENTS.find((m) => m.id === id)?.views.find((v) => v.view === view)?.title ?? view;

/** The only things an analysis may say. */
export const OBSERVATION_LABELS = ['repetitions', 'depth', 'depth_consistency', 'torso_lean', 'heel_lift', 'tempo', 'knee_tracking', 'hip_symmetry'] as const;
export type ObservationLabel = (typeof OBSERVATION_LABELS)[number];
export type Confidence = 'low' | 'moderate' | 'high';

export const OBSERVATION_TITLE: Record<ObservationLabel, string> = {
  repetitions: 'Repetitions',
  depth: 'Depth',
  depth_consistency: 'Depth from rep to rep',
  torso_lean: 'Torso angle',
  heel_lift: 'Heels',
  tempo: 'Tempo',
  knee_tracking: 'Knee path',
  hip_symmetry: 'Hip level',
};

/** Why footage could not be used, or what limits it. */
export const LIMITATIONS = {
  too_short: 'The clip is shorter than 3 seconds.',
  low_frame_rate: 'Too few frames per second to follow the movement.',
  person_not_found: 'No person was found in most of the clip.',
  person_missing_in_parts: 'The person was not found in parts of the clip.',
  key_joints_not_visible: 'Hips, knees or ankles could not be seen clearly.',
  partial_occlusion: 'Some joints were hard to see, so confidence is lower.',
  body_out_of_frame: 'Part of the body left the picture.',
  camera_view_mismatch: 'The camera angle does not match the chosen view.',
  camera_view_unclear: 'The camera angle is between side and front, so confidence is lower.',
  no_repetitions_found: 'No squat repetitions were found.',
  too_few_repetitions: 'Fewer than 2 repetitions, which is not enough to compare.',
  feet_not_clear: 'The feet were not clear enough to say anything about the heels.',
  trimmed_to_60_seconds: 'Only the first 60 seconds were analysed.',
} as const;
export type Limitation = keyof typeof LIMITATIONS;

/** Limitations that make the clip unusable on their own. */
export const BLOCKING: Limitation[] = ['too_short', 'low_frame_rate', 'person_not_found', 'key_joints_not_visible', 'body_out_of_frame', 'camera_view_mismatch', 'no_repetitions_found', 'too_few_repetitions'];

export type Observation = { label: ObservationLabel; summary: string; confidence: Confidence; timestamps: number[] };

export type Analysis = {
  engineVersion: string;
  movementId: MovementId;
  cameraView: CameraView;
  quality: { usable: boolean; limitations: Limitation[] };
  repetitions: number;
  analysedSeconds: number;
  observations: Observation[];
};

export const CANNOT_ASSESS = 'Cannot assess this clip reliably.';
export const NOT_A_DIAGNOSIS = 'These are observations about what the camera could see, not a diagnosis or an injury assessment. Camera angle, clothing and light all affect them.';

/** One video frame's pose: normalized image coordinates (0 to 1) and visibility, or null when nobody was found. */
export type Point = { x: number; y: number; v: number };
export type Frame = { t: number; points: Point[] | null };
export type PoseClip = { width: number; height: number; durationSeconds: number; frames: Frame[]; trimmed?: boolean };

export type VideoAsset = {
  id: string;
  movementId: MovementId;
  cameraView: CameraView;
  storagePath: string;
  durationSeconds: number | null;
  sizeBytes: number | null;
  consentInference: boolean;
  sharedWithProfessionals: boolean;
  retentionUntil: string;
  status: 'pending' | 'uploaded' | 'deleted';
  createdAt: number;
};

export const RETENTION_DAYS = [30, 90, 365] as const;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
