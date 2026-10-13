/**
 * The universal workout model (docs/concepts/workout_data_model_concept.md).
 *
 * Workout -> Block -> Step -> Prescription. A block's `type` is its training
 * purpose; its `config.format` is its execution logic. What was planned
 * (WorkoutVersion) and what happened (Session) are separate entities.
 */

export type Sport =
  | 'crossfit'
  | 'strength'
  | 'endurance'
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'triathlon'
  | 'yoga'
  | 'hiit'
  | 'other';

export const SPORTS: readonly Sport[] = [
  'crossfit',
  'strength',
  'endurance',
  'running',
  'cycling',
  'swimming',
  'triathlon',
  'yoga',
  'hiit',
  'other',
];

export type BlockType =
  | 'warmup'
  | 'strength'
  | 'skill'
  | 'accessory'
  | 'conditioning'
  | 'endurance'
  | 'interval'
  | 'mobility'
  | 'recovery'
  | 'transition'
  | 'cooldown';

export const BLOCK_TYPES: readonly BlockType[] = [
  'warmup',
  'strength',
  'skill',
  'accessory',
  'conditioning',
  'endurance',
  'interval',
  'mobility',
  'recovery',
  'transition',
  'cooldown',
];

export type BlockFormat = 'for_time' | 'amrap' | 'repeating_interval' | 'sets_reps' | 'continuous' | 'sequence';

export const BLOCK_FORMATS: readonly BlockFormat[] = [
  'for_time',
  'amrap',
  'repeating_interval',
  'sets_reps',
  'continuous',
  'sequence',
];

/**
 * Fields a format needs before it can be published are optional here so an
 * incomplete draft can be held; validate.ts is what enforces them.
 */
export type BlockConfig =
  | { format: 'for_time'; rounds?: number; repScheme?: number[]; timeCapSeconds?: number }
  | { format: 'amrap'; durationSeconds?: number }
  | {
      format: 'repeating_interval';
      intervalSeconds?: number;
      rounds?: number;
      /** Work portion of each interval; the remainder is rest. Omitted means work until done. */
      workSeconds?: number;
      /** One step per interval, cycling through the steps, instead of all steps every interval. */
      alternating?: boolean;
    }
  | { format: 'sets_reps'; sets?: number; restSeconds?: number }
  | { format: 'continuous'; durationSeconds?: number; distanceMeters?: number }
  | { format: 'sequence'; rounds?: number };

export type LoadUnit = 'kg' | 'percent_1rm';

export type IntensityType = 'rpe' | 'hr_zone' | 'pace_sec_per_km' | 'ftp_percent' | 'power_w';

export type Prescription = {
  reps?: number | 'max';
  durationSeconds?: number;
  distanceMeters?: number;
  calories?: number;
  load?: { value: number; unit: LoadUnit; per?: 'each' | 'total' };
  intensity?: { type: IntensityType; value: number };
  breaths?: number;
  side?: 'left' | 'right' | 'both';
  restSeconds?: number;
  /** Free-text target that could not be expressed in the typed fields. */
  note?: string;
};

export type ExerciseStep = {
  kind: 'exercise';
  id: string;
  name: string;
  /** Canonical catalog id, or null when the name did not resolve to a known activity. */
  activityId: string | null;
  prescription: Prescription;
  notes?: string;
};

export type RestStep = { kind: 'rest'; id: string; durationSeconds?: number };

export type TransitionStep = { kind: 'transition'; id: string; name?: string; durationSeconds?: number };

export type GroupStep = { kind: 'group'; id: string; label?: string; rounds?: number; steps: Step[] };

export type Step = ExerciseStep | RestStep | TransitionStep | GroupStep;

export type Block = {
  id: string;
  type: BlockType;
  label?: string;
  config: BlockConfig;
  steps: Step[];
  notes?: string;
  tags?: string[];
};

export type WorkoutContent = {
  title: string;
  sport: Sport;
  description?: string;
  tags?: string[];
  equipment?: string[];
  blocks: Block[];
};

export type VersionStatus = 'draft' | 'published' | 'archived';

/** Immutable once created; editing a workout creates the next version. */
export type WorkoutVersion = {
  id: string;
  workoutId: string;
  version: number;
  status: VersionStatus;
  content: WorkoutContent;
  createdAt: number;
};

export type WorkoutSource = 'manual' | 'preset' | 'import';

export type Workout = {
  id: string;
  currentVersionId: string;
  isTemplate: boolean;
  source: WorkoutSource;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type ScheduleStatus = 'planned' | 'completed' | 'skipped';

/** A workout version pinned to a date. Later edits to the workout do not change it. */
export type ScheduledWorkout = {
  id: string;
  workoutId: string;
  versionId: string;
  scheduledAt: number;
  status: ScheduleStatus;
  sessionId?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type Score =
  | { type: 'time'; seconds: number }
  | { type: 'rounds_reps'; rounds: number; reps: number }
  | { type: 'load'; kg: number }
  | { type: 'reps'; reps: number }
  | { type: 'distance'; meters: number }
  | { type: 'completed' };

export type StepResult = {
  stepId: string;
  setIndex?: number;
  reps?: number;
  loadKg?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  calories?: number;
  completed: boolean;
};

export type BlockResultStatus = 'completed' | 'partial' | 'skipped';

export type BlockResult = {
  blockId: string;
  status: BlockResultStatus;
  elapsedSeconds?: number;
  score?: Score;
  stepResults: StepResult[];
};

export type TimerState = {
  /** Wall-clock ms when the timer was last started, or null while paused. */
  startedAtMs: number | null;
  /** Time banked from earlier running periods. */
  accumulatedMs: number;
};

/** Live player position, kept on the session so a reload resumes mid-workout. */
export type SessionProgress = {
  blockIndex: number;
  timer: TimerState;
  roundsCompleted: number;
  /** True once the block's timer has been stopped and the result is being confirmed. */
  awaitingResult: boolean;
};

export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

export type Session = {
  id: string;
  workoutId: string;
  versionId: string;
  scheduledWorkoutId?: string;
  /** Snapshot of what was prescribed, so later edits never rewrite history. */
  prescribed: WorkoutContent;
  status: SessionStatus;
  entryMode: 'player' | 'manual';
  startedAt: number;
  endedAt?: number;
  blockResults: BlockResult[];
  rpe?: number;
  notes?: string;
  progress?: SessionProgress;
  updatedAt: number;
  deletedAt?: number;
};

export function walkSteps(steps: Step[], visit: (step: Step, depth: number) => void, depth = 0): void {
  for (const step of steps) {
    visit(step, depth);
    if (step.kind === 'group') walkSteps(step.steps, visit, depth + 1);
  }
}

export function exerciseSteps(steps: Step[]): ExerciseStep[] {
  const out: ExerciseStep[] = [];
  walkSteps(steps, (s) => {
    if (s.kind === 'exercise') out.push(s);
  });
  return out;
}

export function countExercises(content: WorkoutContent): number {
  return content.blocks.reduce((n, b) => n + exerciseSteps(b.steps).length, 0);
}
