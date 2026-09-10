import { colors } from '@/theme/colors';
import type {
  BodyMetricPoint,
  EnduranceSession,
  Exercise,
  Goal,
  Insight,
  Point,
  StrengthLift,
} from './types';

// Stand-in for what an on-device OCR/AI pass would pull out of a workout
// screenshot — there's no real analysis backend, so StepAnalyzing "detects"
// this fixed result after its simulated processing delay.
export const mockAnalyzedWorkout: {
  title: string;
  intervalsLabel: string;
  exercises: Exercise[];
  notes: string;
} = {
  title: 'Squat Snatch',
  intervalsLabel: '5 Rounds: 2:00 on / 1:00 off',
  exercises: [
    { id: 'ex-1', name: '10 Thrusters' },
    { id: 'ex-2', name: '10 Pull Ups' },
    { id: 'ex-3', name: 'Max Rep Cal', detail: 'any machine in remaining time left in the 2:00 window' },
  ],
  notes: 'Score total calories on the bike over the 5 rounds.\nBarbell weights: Level 1 35/25 kg, Level 2 42.5/30 kg, Level 3 52.5/35 kg.',
};

export const weekStrip = [
  { day: 'Mon', date: 7, done: true },
  { day: 'Tue', date: 8, done: true },
  { day: 'Wed', date: 9, done: true, today: true },
  { day: 'Thu', date: 10, done: true },
  { day: 'Fri', date: 11, done: false },
  { day: 'Sat', date: 12, done: false },
  { day: 'Sun', date: 13, done: false },
];

export const formScore = {
  score: 82,
  rating: 'GOOD',
  deltaLabel: '+6 this month',
  breakdown: [
    { label: 'Strength', value: 86, color: colors.purple },
    { label: 'Endurance', value: 78, color: colors.teal },
    { label: 'Recovery', value: 81, color: colors.blue },
    { label: 'Consistency', value: 84, color: colors.green },
  ],
};

export const homeSummary = {
  weeklyGoal: { current: 4, target: 5 },
  greeting: 'Good morning! \u{1F44B}',
  subGreeting: 'Consistently better. Keep it up.',
  quote: 'Discipline today.\nA stronger tomorrow.',
  stats: [
    { label: 'Weight', value: '74.2 kg', delta: '-2.8 kg', positive: true },
    { label: 'Body Fat', value: '16.8%', delta: '-2.4%', positive: true },
    { label: 'Strength', value: '+18%', delta: 'stronger', positive: true },
    { label: 'Endurance', value: '+12%', delta: 'better', positive: true },
  ],
};

export const bodyMetricHistory: BodyMetricPoint[] = [
  { date: 'Jul', weightKg: 79.8, bodyFatPct: 21.2, muscleMassKg: 58.1, bmi: 25.9 },
  { date: 'Aug', weightKg: 78.0, bodyFatPct: 19.8, muscleMassKg: 58.4, bmi: 25.3 },
  { date: 'Sep', weightKg: 76.1, bodyFatPct: 18.1, muscleMassKg: 58.6, bmi: 24.7 },
  { date: 'Oct', weightKg: 74.2, bodyFatPct: 16.8, muscleMassKg: 58.7, bmi: 24.1 },
];

export const trendsOverview = [
  {
    key: 'weight',
    label: 'Weight',
    value: '74.2 kg',
    delta: '-0.3 kg / week',
    color: colors.blue,
    points: bodyMetricHistory.map((p) => p.weightKg),
    positive: true,
  },
  {
    key: 'bodyfat',
    label: 'Body Fat Percentage',
    value: '16.8%',
    delta: '-0.4% / week',
    color: colors.pink,
    points: bodyMetricHistory.map((p) => p.bodyFatPct),
    positive: true,
  },
  {
    key: 'strength',
    label: 'Strength',
    value: '+18%',
    delta: '(vs. start)',
    color: colors.purple,
    points: [0, 6, 11, 18],
    positive: true,
  },
  {
    key: 'endurance',
    label: 'Endurance',
    value: '+12%',
    delta: '(vs. start)',
    color: colors.teal,
    points: [0, 4, 8, 12],
    positive: true,
  },
];

export const strengthLifts: StrengthLift[] = [
  {
    exercise: 'Squat',
    color: colors.purple,
    unit: 'kg',
    current: 80,
    deltaFromStart: 25,
    points: [
      { label: 'Jul', value: 55 },
      { label: 'Aug', value: 63 },
      { label: 'Sep', value: 72 },
      { label: 'Oct', value: 80 },
    ],
  },
  {
    exercise: 'Bench Press',
    color: colors.amber,
    unit: 'kg',
    current: 60,
    deltaFromStart: 20,
    points: [
      { label: 'Jul', value: 40 },
      { label: 'Aug', value: 47 },
      { label: 'Sep', value: 54 },
      { label: 'Oct', value: 60 },
    ],
  },
  {
    exercise: 'Deadlift',
    color: colors.blue,
    unit: 'kg',
    current: 100,
    deltaFromStart: 30,
    points: [
      { label: 'Jul', value: 70 },
      { label: 'Aug', value: 82 },
      { label: 'Sep', value: 91 },
      { label: 'Oct', value: 100 },
    ],
  },
  {
    exercise: 'Overhead Press',
    color: colors.pink,
    unit: 'kg',
    current: 42.5,
    deltaFromStart: 12.5,
    points: [
      { label: 'Jul', value: 30 },
      { label: 'Aug', value: 34 },
      { label: 'Sep', value: 38.5 },
      { label: 'Oct', value: 42.5 },
    ],
  },
];

export const strengthOverallProgressPct = 18;

export const enduranceSessions: EnduranceSession[] = [
  {
    distance: '5km',
    currentLabel: '24:38 min',
    deltaPct: -11,
    deltaLabel: '-3:12 min',
    points: [
      { label: 'Jul', value: 27.8 },
      { label: 'Aug', value: 26.9 },
      { label: 'Sep', value: 25.6 },
      { label: 'Oct', value: 24.6 },
    ],
  },
];

export const enduranceStats = {
  avgHeartRate: { value: '148 bpm', delta: '-12 bpm' },
  vo2max: { value: '52', delta: '+8%' },
  avgPace: '4:56 min/km',
  totalDistance: '42.8 km',
  sessions: 9,
};

export const bodyComposition: Point[][] = [];
export const bodyCompositionMonths = ['Jul', 'Aug', 'Sep', 'Oct'];
export const bodyCompositionSeries = [
  { label: 'Fat Mass', color: colors.pink, values: [21.2, 19.8, 18.1, 16.8] },
  { label: 'Muscle Mass', color: colors.purple, values: [58.1, 58.4, 58.6, 58.7] },
  { label: 'Other', color: colors.textTertiary, values: [20.7, 21.8, 23.3, 26.5] },
];

export const bodyDevelopment = {
  before: { weightKg: 79.8, bodyFatPct: 21.2, muscleMassKg: 58.1 },
  after: { weightKg: 74.2, bodyFatPct: 16.8, muscleMassKg: 58.7 },
};

export const performanceOverview = [
  { label: 'Training Volume', value: '+28%', sub: 'more weight × reps', icon: 'trending-up' as const, color: colors.blue },
  { label: 'Workouts', value: '+2', sub: 'per week', icon: 'flame' as const, color: colors.orange },
  { label: 'Personal Records', value: '12', sub: 'new PRs', icon: 'trophy' as const, color: colors.amber },
  { label: 'Training Consistency', value: '92%', sub: 'of planned workouts', icon: 'check-circle' as const, color: colors.green },
];

export const comparison = {
  metric: 'Strength',
  exercise: 'Squat',
  before: { label: 'Before (Jan 2026)', color: colors.blue, values: { '1RM': 60, '5RM': 50, '10RM': 40 } },
  after: { label: 'Now (Sep 2026)', color: colors.purple, values: { '1RM': 80, '5RM': 70, '10RM': 60 } },
  caption: "You're 33% stronger.\nKeep it up!",
};

export const goals: (Goal & { currentLabel: string; targetLabel: string })[] = [
  { id: 'weight', label: 'Weight', unit: 'kg', current: 74.2, target: 70.0, progressPct: 60, higherIsBetter: false, currentLabel: '74.2 kg', targetLabel: '70.0 kg' },
  { id: 'bodyfat', label: 'Body Fat Percentage', unit: '%', current: 16.8, target: 12.0, progressPct: 40, higherIsBetter: false, currentLabel: '16.8%', targetLabel: '12.0%' },
  { id: 'squat', label: 'Squat', unit: 'kg', current: 80, target: 100, progressPct: 65, higherIsBetter: true, currentLabel: '80 kg', targetLabel: '100 kg' },
  { id: '5k', label: '5K Time', unit: 'min', current: 24.38, target: 22.0, progressPct: 55, higherIsBetter: false, currentLabel: '24:38 min', targetLabel: '22:00 min' },
];

export const prognosis = "At this rate, you'll reach your target weight in about 8 weeks.";

export const insights: Insight[] = [
  {
    id: 'strength',
    icon: 'trending-up',
    color: colors.purple,
    title: 'Strong Progress',
    body: 'Your strength has increased by 16% over the last 8 weeks.',
  },
  {
    id: 'endurance',
    icon: 'medal',
    color: colors.teal,
    title: 'Endurance Improved',
    body: 'Your 5K time has gotten 3:12 faster.',
  },
  {
    id: 'bodyfat',
    icon: 'heart',
    color: colors.pink,
    title: 'Body Fat Dropping',
    body: "You've lost 4.4% body fat. Keep it up!",
  },
  {
    id: 'recommendation',
    icon: 'dumbbell',
    color: colors.amber,
    title: 'Training Recommendation',
    body: 'Your upper body has caught up. Focus on legs this week for balanced progress.',
  },
];

export const longTerm = {
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
  weight: [79.8, 79.0, 78.2, 77.5, 76.9, 76.4, 75.8, 74.9, 74.2],
  bodyFat: [21.2, 20.6, 19.9, 19.3, 18.7, 18.1, 17.6, 17.1, 16.8],
  strengthIndex: [100, 108, 115, 122, 131, 140, 150, 160, 168],
  caption: "You're making progress.\nKeep going — you're headed the right way!",
};

export const timeRanges: { key: '4w' | '3m' | '1y' | 'all'; label: string }[] = [
  { key: '4w', label: '4 Weeks' },
  { key: '3m', label: '3 Months' },
  { key: '1y', label: '1 Year' },
  { key: 'all', label: 'All' },
];
