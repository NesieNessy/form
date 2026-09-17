import { generateId } from './id';
import { formatSectionHeadline } from './workoutFormat';
import { SECTION_META } from './workoutSections';
import type { Exercise, ExercisePrimary, WorkoutSection } from './types';

export type WorkoutPreset = {
  id: string;
  focus: string;
  title: string;
  section: WorkoutSection;
  note?: string;
};

function ex(id: string, name: string, primary: ExercisePrimary, weight?: Exercise['weight']): Exercise {
  return { id, name, primary, weight };
}

const reps = (n: number): ExercisePrimary => ({ target: 'reps', reps: n });
const time = (minutes: number, seconds: number): ExercisePrimary => ({ target: 'time', minutes, seconds });
const custom = (text = ''): ExercisePrimary => ({ target: 'custom', text });

export const WORKOUT_PRESETS: WorkoutPreset[] = [
  {
    id: 'preset-1',
    focus: 'AbMat Sit-Up',
    title: 'Snatch Sit-Up Chipper',
    section: {
      key: 'wod',
      workoutType: 'forTime',
      structure: { kind: 'repScheme', scheme: '22-18-14-10' },
      exercises: [
        ex('preset-1-ex-1', 'Dumbbell Snatches, 50/35 lbs', reps(22), { value: 50, mode: 'total' }),
        ex('preset-1-ex-2', 'Sit-Ups', reps(22)),
        ex('preset-1-ex-3', 'Burpees', reps(22)),
        ex('preset-1-ex-4', 'Sit-Ups', reps(22)),
      ],
    },
  },
  {
    id: 'preset-2',
    focus: 'AbMat Sit-Up',
    title: '50s Chipper',
    section: {
      key: 'wod',
      workoutType: 'forTime',
      structure: { kind: 'custom', text: '' },
      exercises: [
        ex('preset-2-ex-1', '50 Sit-Ups', reps(50)),
        ex('preset-2-ex-2', '50 Double Unders', reps(50)),
        ex('preset-2-ex-3', '50 Sit-Ups', reps(50)),
        ex('preset-2-ex-4', '50 Walking Lunges', reps(50)),
        ex('preset-2-ex-5', '50 Sit-Ups', reps(50)),
        ex('preset-2-ex-6', '50 Burpees', reps(50)),
        ex('preset-2-ex-7', '50 Sit-Ups', reps(50)),
      ],
    },
  },
  {
    id: 'preset-3',
    focus: 'AbMat Sit-Up',
    title: 'AMRAP 10 – Sit-Up Combo',
    section: {
      key: 'wod',
      workoutType: 'amrap',
      structure: { kind: 'timeBased', minutes: 10, seconds: 0 },
      exercises: [
        ex('preset-3-ex-1', '10 Sit-Ups', reps(10)),
        ex('preset-3-ex-2', '15 Push-ups', reps(15)),
        ex('preset-3-ex-3', '10 Sit-Ups', reps(10)),
        ex('preset-3-ex-4', '30 Air Squats', reps(30)),
      ],
    },
  },
  {
    id: 'preset-4',
    focus: 'AbMat Sit-Up',
    title: 'Hang Clean 3RFT',
    section: {
      key: 'wod',
      workoutType: 'forTime',
      structure: { kind: 'fixedRounds', rounds: 3 },
      exercises: [
        ex('preset-4-ex-1', 'DB Hang Squat Cleans, 50/35 lbs', reps(25), { value: 50, mode: 'total' }),
        ex('preset-4-ex-2', 'Push-ups', reps(30)),
        ex('preset-4-ex-3', 'AbMat Sit-Ups', reps(50)),
      ],
    },
  },
  {
    id: 'preset-5',
    focus: 'AbMat Sit-Up',
    title: 'Tabata Trio – Abs',
    section: {
      key: 'wod',
      workoutType: 'tabata',
      structure: { kind: 'custom', text: '3 Sets: 8 x 20/10 sec' },
      exercises: [
        ex('preset-5-ex-1', 'Tabata V-Ups', custom()),
        ex('preset-5-ex-2', '1 min Pause', time(1, 0)),
        ex('preset-5-ex-3', 'Tabata Sit-Ups', custom()),
        ex('preset-5-ex-4', '1 min Pause', time(1, 0)),
        ex('preset-5-ex-5', 'Tabata Tuck Crunches', custom()),
      ],
    },
  },
  {
    id: 'preset-6',
    focus: 'AbMat Sit-Up',
    title: 'Partner Sit-Up/Burpee Chipper',
    section: {
      key: 'wod',
      workoutType: 'partnerWod',
      structure: { kind: 'custom', text: '' },
      exercises: [
        ex('preset-6-ex-1', '60 Sit-Ups (A) / Plank Hold (B)', reps(60)),
        ex('preset-6-ex-2', '90 Burpees (A) / Plank Hold (B)', reps(90)),
        ex('preset-6-ex-3', '60 Sit-Ups (A) / Plank Hold (B)', reps(60)),
      ],
    },
    note: 'While Partner A works, partner B does the "hold" movement. Switch as needed until you have completed all the reps.',
  },
  {
    id: 'preset-7',
    focus: 'AbMat Sit-Up',
    title: 'Side Plank 4RFT',
    section: {
      key: 'wod',
      workoutType: 'forTime',
      structure: { kind: 'fixedRounds', rounds: 4 },
      exercises: [
        ex('preset-7-ex-1', 'Side Plank Lifts (L)', reps(14)),
        ex('preset-7-ex-2', 'Side Plank Lifts (R)', reps(14)),
        ex('preset-7-ex-3', 'Hollow Hold, 30 Seconds', time(0, 30)),
        ex('preset-7-ex-4', 'Push-ups', reps(8)),
        ex('preset-7-ex-5', 'Sit-Ups', reps(14)),
      ],
    },
  },
  {
    id: 'preset-8',
    focus: 'AbMat Sit-Up',
    title: 'EMOM 16 – Bodyweight',
    section: {
      key: 'wod',
      workoutType: 'emom',
      structure: { kind: 'custom', text: 'Every 1 min for 16 min, alternating' },
      exercises: [
        ex('preset-8-ex-1', 'Min 1: 20 Push-ups', reps(20)),
        ex('preset-8-ex-2', 'Min 2: 20 Sit-Ups', reps(20)),
        ex('preset-8-ex-3', 'Min 3: 20 Air Squats', reps(20)),
        ex('preset-8-ex-4', 'Min 4: 20 Lunges', reps(20)),
      ],
    },
  },
  {
    id: 'preset-9',
    focus: 'AbMat Sit-Up',
    title: 'Tabata Trio – Full Body',
    section: {
      key: 'wod',
      workoutType: 'tabata',
      structure: { kind: 'custom', text: '3 Sets: 8 x 20/10 sec' },
      exercises: [
        ex('preset-9-ex-1', 'Tabata Air Squats', custom()),
        ex('preset-9-ex-2', '1 min Pause', time(1, 0)),
        ex('preset-9-ex-3', 'Tabata Push-ups', custom()),
        ex('preset-9-ex-4', '1 min Pause', time(1, 0)),
        ex('preset-9-ex-5', 'Tabata Sit-Ups', custom()),
      ],
    },
  },
  {
    id: 'preset-10',
    focus: 'AbMat Sit-Up',
    title: 'EMOM 12 – Max Effort',
    section: {
      key: 'wod',
      workoutType: 'emom',
      structure: { kind: 'custom', text: 'Every 3 min for 12 min, alternating' },
      exercises: [
        ex('preset-10-ex-1', 'Max Pull-ups', custom('Max')),
        ex('preset-10-ex-2', 'Max Ring Rows', custom('Max')),
        ex('preset-10-ex-3', 'Max Sit-Ups', custom('Max')),
        ex('preset-10-ex-4', 'Max Air Squats', custom('Max')),
      ],
    },
  },
];

export function instantiatePreset(preset: WorkoutPreset): { title: string; sections: WorkoutSection[] } {
  return {
    title: preset.title,
    sections: [
      {
        ...preset.section,
        exercises: preset.section.exercises.map((e) => ({ ...e, id: generateId('ex') })),
      },
    ],
  };
}

export function formatPresetShareText(preset: WorkoutPreset): string {
  const headline = formatSectionHeadline(preset.section);
  const lines = [
    preset.title,
    [SECTION_META.wod.label, headline].filter(Boolean).join(' — '),
    '',
    ...preset.section.exercises.map((e) => e.name),
  ];
  if (preset.note) lines.push('', preset.note);
  return lines.join('\n');
}
