import { tr } from '../i18n/tr';
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
    name: tr('Bodyweight Squat', 'Kniebeuge ohne Gewicht'),
    views: [
      {
        view: 'side',
        title: tr('From the side', 'Von der Seite'),
        guide: [
          tr('Phone at hip height, about 3 metres away, side-on to you.', 'Telefon auf Hüfthöhe, etwa 3 Meter entfernt, seitlich zu dir.'),
          tr('Your whole body in the picture, head to feet, in every repetition.', 'Dein ganzer Körper im Bild, von Kopf bis Fuß, in jeder Wiederholung.'),
          tr('Good light from the front or above, not behind you.', 'Gutes Licht von vorn oder oben, nicht hinter dir.'),
          tr('Fitted clothing helps the hips and knees show clearly.', 'Eng anliegende Kleidung lässt Hüfte und Knie gut erkennen.'),
          tr('Do 3 to 8 squats at your normal pace.', 'Mach 3 bis 8 Kniebeugen in deinem normalen Tempo.'),
        ],
      },
      {
        view: 'front',
        title: tr('From the front', 'Von vorn'),
        guide: [
          tr('Phone at hip height, about 3 metres away, facing you.', 'Telefon auf Hüfthöhe, etwa 3 Meter entfernt, dir zugewandt.'),
          tr('Your whole body in the picture, head to feet, in every repetition.', 'Dein ganzer Körper im Bild, von Kopf bis Fuß, in jeder Wiederholung.'),
          tr('Good light from the front or above, not behind you.', 'Gutes Licht von vorn oder oben, nicht hinter dir.'),
          tr('Feet visible on the floor; nothing in front of your legs.', 'Füße sichtbar auf dem Boden; nichts vor deinen Beinen.'),
          tr('Do 3 to 8 squats at your normal pace.', 'Mach 3 bis 8 Kniebeugen in deinem normalen Tempo.'),
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
  repetitions: tr('Repetitions', 'Wiederholungen'),
  depth: tr('Depth', 'Tiefe'),
  depth_consistency: tr('Depth from rep to rep', 'Tiefe von Wiederholung zu Wiederholung'),
  torso_lean: tr('Torso angle', 'Oberkörperwinkel'),
  heel_lift: tr('Heels', 'Fersen'),
  tempo: tr('Tempo', 'Tempo'),
  knee_tracking: tr('Knee path', 'Kniebahn'),
  hip_symmetry: tr('Hip level', 'Hüfthöhe'),
};

/** Why footage could not be used, or what limits it. */
export const LIMITATIONS = {
  too_short: tr('The clip is shorter than 3 seconds.', 'Der Clip ist kürzer als 3 Sekunden.'),
  low_frame_rate: tr('Too few frames per second to follow the movement.', 'Zu wenige Bilder pro Sekunde, um der Bewegung zu folgen.'),
  person_not_found: tr('No person was found in most of the clip.', 'In den meisten Teilen des Clips wurde keine Person gefunden.'),
  person_missing_in_parts: tr('The person was not found in parts of the clip.', 'In Teilen des Clips wurde die Person nicht gefunden.'),
  key_joints_not_visible: tr('Hips, knees or ankles could not be seen clearly.', 'Hüfte, Knie oder Sprunggelenke waren nicht klar zu sehen.'),
  partial_occlusion: tr('Some joints were hard to see, so confidence is lower.', 'Einige Gelenke waren schwer zu sehen, daher ist die Sicherheit geringer.'),
  body_out_of_frame: tr('Part of the body left the picture.', 'Ein Teil des Körpers war nicht mehr im Bild.'),
  camera_view_mismatch: tr('The camera angle does not match the chosen view.', 'Der Kamerawinkel passt nicht zur gewählten Perspektive.'),
  camera_view_unclear: tr('The camera angle is between side and front, so confidence is lower.', 'Der Kamerawinkel liegt zwischen seitlich und frontal, daher ist die Sicherheit geringer.'),
  no_repetitions_found: tr('No squat repetitions were found.', 'Es wurden keine Kniebeugen gefunden.'),
  too_few_repetitions: tr('Fewer than 2 repetitions, which is not enough to compare.', 'Weniger als 2 Wiederholungen, das reicht nicht für einen Vergleich.'),
  feet_not_clear: tr('The feet were not clear enough to say anything about the heels.', 'Die Füße waren nicht deutlich genug, um etwas über die Fersen zu sagen.'),
  trimmed_to_60_seconds: tr('Only the first 60 seconds were analysed.', 'Nur die ersten 60 Sekunden wurden analysiert.'),
} as const;
export type Limitation = keyof typeof LIMITATIONS;

/** Limitations that make the clip unusable on their own. */
export const BLOCKING: Limitation[] = ['too_short', 'low_frame_rate', 'person_not_found', 'key_joints_not_visible', 'body_out_of_frame', 'camera_view_mismatch', 'no_repetitions_found', 'too_few_repetitions'];

export type Observation = {
  label: ObservationLabel;
  /** Which sentence, with values, so it can be shown in the reader's language (lib/movement/describe.ts). */
  variant?: string;
  params?: Record<string, number | string>;
  /** The sentence in the language it was made in; the fallback for older analyses. */
  summary: string;
  confidence: Confidence;
  timestamps: number[];
};

export type Analysis = {
  engineVersion: string;
  movementId: MovementId;
  cameraView: CameraView;
  quality: { usable: boolean; limitations: Limitation[] };
  repetitions: number;
  analysedSeconds: number;
  observations: Observation[];
};

export const CANNOT_ASSESS = tr('Cannot assess this clip reliably.', 'Dieser Clip lässt sich nicht verlässlich beurteilen.');
export const NOT_A_DIAGNOSIS = tr('These are observations about what the camera could see, not a diagnosis or an injury assessment. Camera angle, clothing and light all affect them.', 'Das sind Beobachtungen zu dem, was die Kamera sehen konnte, keine Diagnose und keine Einschätzung von Verletzungen. Kamerawinkel, Kleidung und Licht beeinflussen sie.');

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
