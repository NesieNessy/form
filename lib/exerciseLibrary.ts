import type { Exercise, ExercisePrimary } from './types';
import { searchActivities, type Activity, type DefaultTarget } from './workout/catalog';

/** The wizard's view of the activity catalog (lib/workout/catalog.ts). */
export type ExerciseLibraryEntry = { activityId: string; name: string; defaultPrimary: ExercisePrimary };

function toPrimary(target: DefaultTarget): ExercisePrimary {
  switch (target.kind) {
    case 'reps':
      return { target: 'reps', reps: target.reps };
    case 'calories':
      return { target: 'calories', calories: target.calories };
    case 'distance':
      return target.meters >= 1000 && target.meters % 1000 === 0
        ? { target: 'distance', value: target.meters / 1000, unit: 'km' }
        : { target: 'distance', value: target.meters, unit: 'm' };
    case 'duration':
      return { target: 'time', minutes: Math.floor(target.seconds / 60), seconds: target.seconds % 60 };
  }
}

const toEntry = (activity: Activity): ExerciseLibraryEntry => ({
  activityId: activity.id,
  name: activity.name,
  defaultPrimary: toPrimary(activity.defaultTarget),
});

export function searchExerciseLibrary(query: string): ExerciseLibraryEntry[] {
  return searchActivities(query).map(toEntry);
}

export function buildExerciseFromLibraryEntry(entry: ExerciseLibraryEntry, id: string): Exercise {
  return { id, name: entry.name, primary: entry.defaultPrimary };
}
