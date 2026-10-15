import { tr } from '../i18n/tr';
import type { WorkoutContent } from '../workout/model';

/**
 * Injury rehabilitation and return to training
 * (docs/concepts/injury_rehabilitation_return_to_training_concept_en.md).
 *
 * The athlete owns the episode and their symptom log. Clinicians author
 * restrictions, rehab plans, review notes and return-to-sport decisions;
 * the athlete's app reads those and can never change or lift them. Nothing
 * here diagnoses, clears, or decides a dose.
 */

// ------------------------------------------------------------------ tags

/** What a restriction can be about: movement kinds a workout can be checked against. */
export type ActivityTag =
  | 'running'
  | 'jumping'
  | 'squatting'
  | 'lunging'
  | 'hinging'
  | 'overhead'
  | 'pressing'
  | 'pulling'
  | 'hanging'
  | 'inverted'
  | 'loaded_spine'
  | 'cycling'
  | 'rowing'
  | 'swimming'
  | 'core_flexion';

export const TAG_LABEL: Record<ActivityTag, string> = {
  running: tr('Running', 'Laufen'),
  jumping: tr('Jumping and landing', 'Springen und Landen'),
  squatting: tr('Squatting', 'Kniebeugen'),
  lunging: tr('Lunging', 'Ausfallschritte'),
  hinging: tr('Hip hinging', 'Hüftbeugen (Hinge)'),
  overhead: tr('Arms overhead', 'Arme über Kopf'),
  pressing: tr('Pressing', 'Drücken'),
  pulling: tr('Pulling', 'Ziehen'),
  hanging: tr('Hanging', 'Hängen'),
  inverted: tr('Upside down', 'Kopfüber'),
  loaded_spine: tr('Heavy load on the spine', 'Schwere Last auf der Wirbelsäule'),
  cycling: tr('Cycling', 'Radfahren'),
  rowing: tr('Rowing', 'Rudern'),
  swimming: tr('Swimming', 'Schwimmen'),
  core_flexion: tr('Sit-ups and crunches', 'Sit-ups und Crunches'),
};

export const TAG_ORDER = Object.keys(TAG_LABEL) as ActivityTag[];

/** Movement tags of every catalog activity. Kept by hand next to the catalog; a test checks every activity is covered. */
export const ACTIVITY_TAGS: Record<string, ActivityTag[]> = {
  back_squat: ['squatting', 'loaded_spine'],
  front_squat: ['squatting', 'loaded_spine'],
  overhead_squat: ['squatting', 'overhead', 'loaded_spine'],
  deadlift: ['hinging', 'loaded_spine'],
  bench_press: ['pressing'],
  overhead_press: ['overhead', 'pressing'],
  push_press: ['overhead', 'pressing', 'squatting'],
  push_jerk: ['overhead', 'pressing', 'jumping'],
  clean: ['hinging', 'squatting', 'jumping', 'loaded_spine'],
  clean_and_jerk: ['hinging', 'squatting', 'overhead', 'jumping', 'loaded_spine'],
  snatch: ['hinging', 'squatting', 'overhead', 'jumping', 'loaded_spine'],
  thruster: ['squatting', 'overhead', 'pressing', 'loaded_spine'],
  barbell_row: ['hinging', 'pulling'],
  hip_thrust: ['hinging'],
  dumbbell_thruster: ['squatting', 'overhead', 'pressing'],
  dumbbell_snatch: ['hinging', 'overhead'],
  dumbbell_hang_clean: ['hinging', 'squatting'],
  goblet_squat: ['squatting'],
  kettlebell_swing: ['hinging'],
  wall_ball: ['squatting', 'overhead'],
  walking_lunge: ['lunging'],
  pull_up: ['pulling', 'hanging', 'overhead'],
  chest_to_bar: ['pulling', 'hanging', 'overhead'],
  ring_row: ['pulling'],
  muscle_up: ['pulling', 'pressing', 'hanging', 'overhead'],
  toes_to_bar: ['hanging', 'core_flexion', 'overhead'],
  push_up: ['pressing'],
  handstand_push_up: ['inverted', 'overhead', 'pressing'],
  dip: ['pressing'],
  air_squat: ['squatting'],
  pistol: ['squatting'],
  burpee: ['jumping', 'pressing'],
  box_jump: ['jumping'],
  double_under: ['jumping'],
  single_under: ['jumping'],
  sit_up: ['core_flexion'],
  v_up: ['core_flexion'],
  tuck_crunch: ['core_flexion'],
  mountain_climber: [],
  jumping_jack: ['jumping'],
  plank: [],
  side_plank: [],
  hollow_hold: [],
  handstand_hold: ['inverted', 'overhead'],
  run: ['running'],
  row: ['rowing', 'pulling'],
  ski_erg: ['pulling', 'overhead'],
  bike: ['cycling'],
  cycling: ['cycling'],
  swim: ['swimming', 'overhead'],
  walk: [],
  downward_dog: ['inverted'],
  warrior_1: ['lunging', 'overhead'],
  warrior_2: ['lunging'],
  pigeon_pose: [],
  childs_pose: [],
  cat_cow: [],
  couch_stretch: [],
  pranayama: [],
  meditation: [],
};

// --------------------------------------------------------------- episodes

export const BODY_REGIONS = ['head_neck', 'shoulder', 'elbow', 'wrist_hand', 'upper_back', 'lower_back', 'hip', 'thigh', 'knee', 'lower_leg', 'ankle_foot', 'chest', 'other'] as const;
export type BodyRegion = (typeof BODY_REGIONS)[number];
export const BODY_REGION_LABEL: Record<BodyRegion, string> = {
  head_neck: tr('Head or neck', 'Kopf oder Nacken'),
  shoulder: tr('Shoulder', 'Schulter'),
  elbow: tr('Elbow', 'Ellbogen'),
  wrist_hand: tr('Wrist or hand', 'Handgelenk oder Hand'),
  upper_back: tr('Upper back', 'Oberer Rücken'),
  lower_back: tr('Lower back', 'Unterer Rücken'),
  hip: tr('Hip', 'Hüfte'),
  thigh: tr('Thigh', 'Oberschenkel'),
  knee: tr('Knee', 'Knie'),
  lower_leg: tr('Lower leg', 'Unterschenkel'),
  ankle_foot: tr('Ankle or foot', 'Sprunggelenk oder Fuß'),
  chest: tr('Chest', 'Brust'),
  other: tr('Somewhere else', 'Woanders'),
};

export type Laterality = 'left' | 'right' | 'both' | 'none';

/** The athlete's own tracking status. Return-to-sport stages are separate and only a clinician records them. */
export type EpisodeStatus = 'reported' | 'under_assessment' | 'rehabilitating' | 'paused' | 'resolved';
export const EPISODE_STATUS_LABEL: Record<EpisodeStatus, string> = {
  reported: tr('Noted', 'Notiert'),
  under_assessment: tr('Being assessed', 'Wird abgeklärt'),
  rehabilitating: tr('In rehab', 'In der Reha'),
  paused: tr('Paused', 'Pausiert'),
  resolved: tr('Resolved', 'Abgeschlossen'),
};

export type InjuryEpisode = {
  id: string;
  bodyRegion: BodyRegion;
  laterality: Laterality;
  /** YYYY-MM-DD, approximate is fine. */
  onsetDate?: string;
  onsetType: 'sudden' | 'gradual' | 'unknown';
  /** In the athlete's own words. Not a diagnosis. */
  reportedProblem: string;
  /** What hurts or should be avoided, as the athlete sees it. Checked against workouts like a soft restriction. */
  affectedActivities: ActivityTag[];
  status: EpisodeStatus;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

/** Things that call for prompt professional assessment. Placeholder list pending clinician review. */
export const RED_FLAGS = {
  cannot_bear_weight: tr('I cannot put weight on it', 'Ich kann es nicht belasten'),
  numbness: tr('Numbness, tingling or weakness that is new', 'Neue Taubheit, Kribbeln oder Schwäche'),
  deformity: tr('It looks deformed or very swollen', 'Es sieht verformt oder stark geschwollen aus'),
  fever: tr('Fever or feeling very ill along with the pain', 'Fieber oder starkes Krankheitsgefühl zusammen mit den Schmerzen'),
} as const;
export type RedFlag = keyof typeof RED_FLAGS;

export type SymptomLog = {
  id: string;
  episodeId: string;
  loggedAt: number;
  localDate: string;
  /** User-reported, 0 = none, 10 = worst imaginable. */
  intensity: number;
  /** Ability to do what matters to the athlete, 0 = not at all, 10 = fully. Optional. */
  function?: number;
  /** What was being done when it was noticed. */
  context?: string;
  redFlags: RedFlag[];
  note?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

// --------------------------------------------- clinician-authored records

export type RestrictionRule = 'avoid' | 'review_required' | 'limit';
export const RULE_LABEL: Record<RestrictionRule, string> = {
  avoid: tr('Avoid', 'Vermeiden'),
  review_required: tr('Ask before doing', 'Vorher fragen'),
  limit: tr('Limited', 'Eingeschränkt'),
};

export type Issuer = { id: string; name: string | null; role: string; verified: boolean };

export type Restriction = {
  id: string;
  episodeId: string;
  tags: ActivityTag[];
  rule: RestrictionRule;
  /** E.g. "pain-free range only". Shown to the athlete; not to a coach. */
  note?: string;
  issuer: Issuer;
  effectiveFrom: string;
  expiresOn?: string;
  status: 'active' | 'lifted';
  liftedAt?: number;
  createdAt: number;
};

export type RehabPlan = {
  id: string;
  episodeId: string;
  version: number;
  status: 'published' | 'retired';
  /** Workout Core content; a dose the clinician did not give is absent, never guessed. */
  content: WorkoutContent;
  sessionsPerWeek?: number;
  notes?: string;
  author: Issuer;
  createdAt: number;
};

export type RtsStage = 'participation' | 'sport' | 'performance';
export const RTS_LABEL: Record<RtsStage, string> = {
  participation: tr('Return to participation', 'Rückkehr ins Training'),
  sport: tr('Return to sport', 'Rückkehr zum Sport'),
  performance: tr('Return to performance', 'Rückkehr zur Leistung'),
};

export type RtsDecision = { id: string; episodeId: string; stage: RtsStage; criteria: string; clinician: Issuer; decidedAt: number };

export type CaseNote = { id: string; episodeId: string; body: string; author: Issuer; createdAt: number };

/** Everything clinicians wrote for the athlete, as last fetched. Read-only on the device. */
export type ClinicalRecords = {
  restrictions: Restriction[];
  plans: RehabPlan[];
  decisions: RtsDecision[];
  notes: CaseNote[];
  fetchedAt: number;
};

export const EMPTY_CLINICAL: ClinicalRecords = { restrictions: [], plans: [], decisions: [], notes: [], fetchedAt: 0 };
