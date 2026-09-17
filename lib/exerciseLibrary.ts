import type { Exercise, ExercisePrimary } from './types';

export type ExerciseLibraryEntry = { name: string; defaultPrimary: ExercisePrimary };

export const EXERCISE_LIBRARY: ExerciseLibraryEntry[] = [
  { name: 'Thruster', defaultPrimary: { target: 'reps', reps: 10 } },
  { name: 'Pull Up', defaultPrimary: { target: 'reps', reps: 10 } },
  { name: 'Push Up', defaultPrimary: { target: 'reps', reps: 10 } },
  { name: 'Air Squat', defaultPrimary: { target: 'reps', reps: 15 } },
  { name: 'Box Jump', defaultPrimary: { target: 'reps', reps: 10 } },
  { name: 'Wall Ball', defaultPrimary: { target: 'reps', reps: 15 } },
  { name: 'Kettlebell Swing', defaultPrimary: { target: 'reps', reps: 15 } },
  { name: 'Burpee', defaultPrimary: { target: 'reps', reps: 10 } },
  { name: 'Double Under', defaultPrimary: { target: 'reps', reps: 50 } },
  { name: 'Sit Up', defaultPrimary: { target: 'reps', reps: 15 } },
  { name: 'Handstand Push Up', defaultPrimary: { target: 'reps', reps: 5 } },
  { name: 'Deadlift', defaultPrimary: { target: 'reps', reps: 5 } },
  { name: 'Back Squat', defaultPrimary: { target: 'reps', reps: 5 } },
  { name: 'Row', defaultPrimary: { target: 'distance', value: 500, unit: 'm' } },
  { name: 'Run', defaultPrimary: { target: 'distance', value: 400, unit: 'm' } },
  { name: 'Ski Erg', defaultPrimary: { target: 'distance', value: 400, unit: 'm' } },
  { name: 'Bike', defaultPrimary: { target: 'calories', calories: 20 } },
];

export function searchExerciseLibrary(query: string): ExerciseLibraryEntry[] {
  const q = query.trim().toLowerCase();
  return q ? EXERCISE_LIBRARY.filter((e) => e.name.toLowerCase().includes(q)) : EXERCISE_LIBRARY;
}

export function buildExerciseFromLibraryEntry(entry: ExerciseLibraryEntry, id: string): Exercise {
  return { id, name: entry.name, primary: entry.defaultPrimary };
}
