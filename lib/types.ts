export type RangeKey = '4w' | '3m' | '1y' | 'all';

export type Point = { label: string; value: number };

export type BodyMetricPoint = {
  date: string;
  weightKg: number;
  bodyFatPct: number;
  muscleMassKg: number;
  bmi: number;
};

export type StrengthLift = {
  exercise: string;
  color: string;
  unit: 'kg';
  current: number;
  deltaFromStart: number;
  points: Point[];
};

export type EnduranceDistance = '400m' | '1km' | '5km' | 'all';

export type EnduranceSession = {
  distance: EnduranceDistance;
  currentLabel: string;
  deltaPct: number;
  deltaLabel: string;
  points: Point[];
};

export type Goal = {
  id: string;
  label: string;
  unit: string;
  current: number;
  target: number;
  progressPct: number;
  higherIsBetter: boolean;
};

export type IconKey =
  | 'trending-up'
  | 'medal'
  | 'heart'
  | 'dumbbell'
  | 'flame'
  | 'trophy'
  | 'check-circle';

export type Insight = {
  id: string;
  icon: IconKey;
  color: string;
  title: string;
  body: string;
};

// Workout wizard — data model
export type WorkoutCategory = 'crossfit' | 'strength' | 'endurance' | 'other';

export type SectionKey = 'warmup' | 'skill' | 'strength' | 'accessory' | 'wod' | 'cooldown';

export type SectionWorkoutType =
  | 'forTime'
  | 'amrap'
  | 'emom'
  | 'tabata'
  | 'strength'
  | 'partnerWod'
  | 'custom';

export type StructureKind = 'fixedRounds' | 'repScheme' | 'timeBased' | 'custom';

export type WorkoutStructure =
  | { kind: 'fixedRounds'; rounds: number }
  | { kind: 'repScheme'; scheme: string }
  | { kind: 'timeBased'; minutes: number; seconds: number }
  | { kind: 'custom'; text: string };

export type ExerciseTarget = 'reps' | 'weight' | 'time' | 'distance' | 'calories' | 'rounds' | 'custom';

export type DistanceUnit = 'm' | 'km';

export type ExercisePrimary =
  | { target: 'reps'; reps: number }
  | { target: 'rounds'; rounds: number }
  | { target: 'calories'; calories: number }
  | { target: 'time'; minutes: number; seconds: number }
  | { target: 'distance'; value: number; unit: DistanceUnit }
  | { target: 'weight'; value: number }
  | { target: 'custom'; text: string };

export type Exercise = {
  id: string;
  name: string;
  primary: ExercisePrimary;
  weight?: { value: number; mode: 'each' | 'total' };
  notes?: string;
};

export type WorkoutSection = {
  key: SectionKey;
  workoutType?: SectionWorkoutType;
  structure?: WorkoutStructure;
  exercises: Exercise[];
};

export type Workout = {
  id: string;
  title: string;
  category: WorkoutCategory;
  dateTimeMs: number;
  dateLabel: string;
  notes?: string;
  sections: WorkoutSection[];
  durationLabel?: string;
  totalVolumeLabel?: string;
  createdAt: number;
  updatedAt: number;
};
