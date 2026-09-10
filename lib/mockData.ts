import { colors } from '@/theme/colors';
import type {
  BodyMetricPoint,
  EnduranceSession,
  Goal,
  Insight,
  Point,
  StrengthLift,
} from './types';

export const weekStrip = [
  { day: 'Mo', date: 7, done: true },
  { day: 'Di', date: 8, done: true },
  { day: 'Mi', date: 9, done: true, today: true },
  { day: 'Do', date: 10, done: true },
  { day: 'Fr', date: 11, done: false },
  { day: 'Sa', date: 12, done: false },
  { day: 'So', date: 13, done: false },
];

export const homeSummary = {
  weeklyGoal: { current: 4, target: 5 },
  greeting: 'Guten Morgen! \u{1F44B}',
  subGreeting: 'Konstant besser. Weiter so.',
  quote: 'Disziplin heute.\nEin stärkeres Morgen.',
  stats: [
    { label: 'Gewicht', value: '74,2 kg', delta: '-2,8 kg', positive: true },
    { label: 'Körperfett', value: '16,8 %', delta: '-2,4 %', positive: true },
    { label: 'Kraftleistung', value: '+18 %', delta: 'stärker', positive: true },
    { label: 'Ausdauer', value: '+12 %', delta: 'besser', positive: true },
  ],
};

export const bodyMetricHistory: BodyMetricPoint[] = [
  { date: 'Jul', weightKg: 79.8, bodyFatPct: 21.2, muscleMassKg: 58.1, bmi: 25.9 },
  { date: 'Aug', weightKg: 78.0, bodyFatPct: 19.8, muscleMassKg: 58.4, bmi: 25.3 },
  { date: 'Sep', weightKg: 76.1, bodyFatPct: 18.1, muscleMassKg: 58.6, bmi: 24.7 },
  { date: 'Okt', weightKg: 74.2, bodyFatPct: 16.8, muscleMassKg: 58.7, bmi: 24.1 },
];

export const trendsOverview = [
  {
    key: 'weight',
    label: 'Gewicht',
    value: '74,2 kg',
    delta: '-0,3 kg / Woche',
    color: colors.blue,
    points: bodyMetricHistory.map((p) => p.weightKg),
    positive: true,
  },
  {
    key: 'bodyfat',
    label: 'Körperfettanteil',
    value: '16,8 %',
    delta: '-0,4 % / Woche',
    color: colors.purple,
    points: bodyMetricHistory.map((p) => p.bodyFatPct),
    positive: true,
  },
  {
    key: 'strength',
    label: 'Kraftleistung',
    value: '+18 %',
    delta: '(im Vergleich zum Start)',
    color: colors.orange,
    points: [0, 6, 11, 18],
    positive: true,
  },
  {
    key: 'endurance',
    label: 'Ausdauer',
    value: '+12 %',
    delta: '(im Vergleich zum Start)',
    color: colors.teal,
    points: [0, 4, 8, 12],
    positive: true,
  },
];

export const strengthLifts: StrengthLift[] = [
  {
    exercise: 'Kniebeuge (Squat)',
    color: colors.purple,
    unit: 'kg',
    current: 80,
    deltaFromStart: 25,
    points: [
      { label: 'Jul', value: 55 },
      { label: 'Aug', value: 63 },
      { label: 'Sep', value: 72 },
      { label: 'Okt', value: 80 },
    ],
  },
  {
    exercise: 'Bankdrücken (Bench Press)',
    color: colors.amber,
    unit: 'kg',
    current: 60,
    deltaFromStart: 20,
    points: [
      { label: 'Jul', value: 40 },
      { label: 'Aug', value: 47 },
      { label: 'Sep', value: 54 },
      { label: 'Okt', value: 60 },
    ],
  },
  {
    exercise: 'Kreuzheben (Deadlift)',
    color: colors.blue,
    unit: 'kg',
    current: 100,
    deltaFromStart: 30,
    points: [
      { label: 'Jul', value: 70 },
      { label: 'Aug', value: 82 },
      { label: 'Sep', value: 91 },
      { label: 'Okt', value: 100 },
    ],
  },
  {
    exercise: 'Schulterdrücken (Overhead Press)',
    color: colors.pink,
    unit: 'kg',
    current: 42.5,
    deltaFromStart: 12.5,
    points: [
      { label: 'Jul', value: 30 },
      { label: 'Aug', value: 34 },
      { label: 'Sep', value: 38.5 },
      { label: 'Okt', value: 42.5 },
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
      { label: 'Okt', value: 24.6 },
    ],
  },
];

export const enduranceStats = {
  avgHeartRate: { value: '148 bpm', delta: '-12 bpm' },
  vo2max: { value: '52', delta: '+8 %' },
  avgPace: '4:56 min/km',
  totalDistance: '42,8 km',
  sessions: 9,
};

export const bodyComposition: Point[][] = [];
export const bodyCompositionMonths = ['Jul', 'Aug', 'Sep', 'Okt'];
export const bodyCompositionSeries = [
  { label: 'Fettmasse', color: colors.pink, values: [21.2, 19.8, 18.1, 16.8] },
  { label: 'Muskelmasse', color: colors.blue, values: [58.1, 58.4, 58.6, 58.7] },
  { label: 'Sonstiges', color: colors.textTertiary, values: [20.7, 21.8, 23.3, 26.5] },
];

export const bodyDevelopment = {
  before: { weightKg: 79.8, bodyFatPct: 21.2, muscleMassKg: 58.1 },
  after: { weightKg: 74.2, bodyFatPct: 16.8, muscleMassKg: 58.7 },
};

export const performanceOverview = [
  { label: 'Trainingsvolumen', value: '+28 %', sub: 'mehr Gewicht × Wiederholungen', icon: 'trending-up' as const, color: colors.blue },
  { label: 'Workouts', value: '+2', sub: 'pro Woche', icon: 'flame' as const, color: colors.orange },
  { label: 'Bestleistungen', value: '12', sub: 'neue PRs', icon: 'trophy' as const, color: colors.amber },
  { label: 'Trainingskonsistenz', value: '92 %', sub: 'aller geplanten Workouts', icon: 'check-circle' as const, color: colors.green },
];

export const comparison = {
  metric: 'Kraft',
  exercise: 'Kniebeuge (Squat)',
  before: { label: 'Früher (Jan 2026)', color: colors.blue, values: { '1RM': 60, '5RM': 50, '10RM': 40 } },
  after: { label: 'Aktuell (Sep 2026)', color: colors.purple, values: { '1RM': 80, '5RM': 70, '10RM': 60 } },
  caption: 'Du bist 33 % stärker geworden.\nWeiter so!',
};

export const goals: (Goal & { currentLabel: string; targetLabel: string })[] = [
  { id: 'weight', label: 'Gewicht', unit: 'kg', current: 74.2, target: 70.0, progressPct: 60, higherIsBetter: false, currentLabel: '74,2 kg', targetLabel: '70,0 kg' },
  { id: 'bodyfat', label: 'Körperfettanteil', unit: '%', current: 16.8, target: 12.0, progressPct: 40, higherIsBetter: false, currentLabel: '16,8 %', targetLabel: '12,0 %' },
  { id: 'squat', label: 'Kniebeuge', unit: 'kg', current: 80, target: 100, progressPct: 65, higherIsBetter: true, currentLabel: '80 kg', targetLabel: '100 kg' },
  { id: '5k', label: '5 km Laufzeit', unit: 'min', current: 24.38, target: 22.0, progressPct: 55, higherIsBetter: false, currentLabel: '24:38 min', targetLabel: '22:00 min' },
];

export const prognosis = 'Bei gleichbleibendem Fortschritt erreichst du dein Zielgewicht in ca. 8 Wochen.';

export const insights: Insight[] = [
  {
    id: 'strength',
    icon: 'trending-up',
    color: colors.blue,
    title: 'Starke Entwicklung',
    body: 'Deine Kraftleistung ist in den letzten 8 Wochen um 16 % gestiegen.',
  },
  {
    id: 'endurance',
    icon: 'medal',
    color: colors.teal,
    title: 'Ausdauer verbessert',
    body: 'Deine 5 km Zeit ist um 3:12 schneller geworden.',
  },
  {
    id: 'bodyfat',
    icon: 'heart',
    color: colors.pink,
    title: 'Körperfett sinkt',
    body: 'Du hast 4,4 % Körperfett verloren. Weiter so!',
  },
  {
    id: 'recommendation',
    icon: 'dumbbell',
    color: colors.amber,
    title: 'Trainingsempfehlung',
    body: 'Dein Oberkörper hat aufgeholt. Fokussiere dich diese Woche auf Beine für einen ausgeglichenen Fortschritt.',
  },
];

export const longTerm = {
  months: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep'],
  weight: [79.8, 79.0, 78.2, 77.5, 76.9, 76.4, 75.8, 74.9, 74.2],
  bodyFat: [21.2, 20.6, 19.9, 19.3, 18.7, 18.1, 17.6, 17.1, 16.8],
  strengthIndex: [100, 108, 115, 122, 131, 140, 150, 160, 168],
  caption: 'Du machst Fortschritte.\nBleib dran – die Richtung stimmt!',
};

export const timeRanges: { key: '4w' | '3m' | '1y' | 'all'; label: string }[] = [
  { key: '4w', label: '4 Wochen' },
  { key: '3m', label: '3 Monate' },
  { key: '1y', label: '1 Jahr' },
  { key: 'all', label: 'Alle' },
];
