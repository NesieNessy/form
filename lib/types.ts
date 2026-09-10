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

export type Exercise = {
  id: string;
  name: string;
  detail?: string;
};

export type WorkoutBodyDataSource = 'automatic' | 'screenshot' | 'manual';

export type WorkoutBodyData = {
  avgHeartRate?: string;
  calories?: string;
  duration?: string;
  zonesPct?: string;
  distance?: string;
  pace?: string;
  power?: string;
  avgSpeed?: string;
  maxHeartRate?: string;
  device?: string;
};

export type Workout = {
  id: string;
  title: string;
  dateLabel: string;
  intervalsLabel?: string;
  exercises: Exercise[];
  notes?: string;
  bodyDataSource?: WorkoutBodyDataSource;
  bodyData?: WorkoutBodyData;
  screenshotUri?: string;
  createdAt: number;
};
