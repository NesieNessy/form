import { useMemo } from 'react';
import type { ScheduledWorkout, Session, Workout, WorkoutVersion } from './workout/model';
import { useWorkoutsStore } from './workoutsStore';

export type ScheduleItem = {
  entry: ScheduledWorkout;
  workout: Workout;
  version: WorkoutVersion;
  /** The finished session, once the workout has been done or logged. */
  session?: Session;
  /** A session that was started in the player and not yet finished. */
  openSession?: Session;
};

function buildItem(
  entry: ScheduledWorkout | undefined,
  workouts: Record<string, Workout>,
  versions: Record<string, WorkoutVersion>,
  sessions: Record<string, Session>
): ScheduleItem | undefined {
  if (!entry || entry.deletedAt) return undefined;
  const workout = workouts[entry.workoutId];
  const version = versions[entry.versionId];
  if (!workout || !version) return undefined;
  const mine = Object.values(sessions).filter((s) => s.scheduledWorkoutId === entry.id && !s.deletedAt);
  return {
    entry,
    workout,
    version,
    session: mine.find((s) => s.status === 'completed'),
    openSession: mine.find((s) => s.status === 'in_progress'),
  };
}

/** Every schedule entry, newest first. */
export function useScheduleItems(): ScheduleItem[] {
  const scheduled = useWorkoutsStore((s) => s.scheduled);
  const workouts = useWorkoutsStore((s) => s.workouts);
  const versions = useWorkoutsStore((s) => s.versions);
  const sessions = useWorkoutsStore((s) => s.sessions);
  return useMemo(
    () =>
      Object.values(scheduled)
        .map((entry) => buildItem(entry, workouts, versions, sessions))
        .filter((item): item is ScheduleItem => item !== undefined)
        .sort((a, b) => b.entry.scheduledAt - a.entry.scheduledAt),
    [scheduled, workouts, versions, sessions]
  );
}

export function useScheduleItem(scheduledId: string | undefined): ScheduleItem | undefined {
  const entry = useWorkoutsStore((s) => (scheduledId ? s.scheduled[scheduledId] : undefined));
  const workouts = useWorkoutsStore((s) => s.workouts);
  const versions = useWorkoutsStore((s) => s.versions);
  const sessions = useWorkoutsStore((s) => s.sessions);
  return useMemo(() => buildItem(entry, workouts, versions, sessions), [entry, workouts, versions, sessions]);
}

export type TemplateItem = { workout: Workout; version: WorkoutVersion };

export function useTemplates(): TemplateItem[] {
  const workouts = useWorkoutsStore((s) => s.workouts);
  const versions = useWorkoutsStore((s) => s.versions);
  return useMemo(
    () =>
      Object.values(workouts)
        .filter((w) => w.isTemplate && !w.deletedAt && versions[w.currentVersionId])
        .map((workout) => ({ workout, version: versions[workout.currentVersionId] }))
        .sort((a, b) => a.version.content.title.localeCompare(b.version.content.title)),
    [workouts, versions]
  );
}

/** Sessions and schedule as arrays, for the analytics functions. */
export function useTrainingLog(): { sessions: Session[]; scheduled: ScheduledWorkout[] } {
  const sessions = useWorkoutsStore((s) => s.sessions);
  const scheduled = useWorkoutsStore((s) => s.scheduled);
  return useMemo(() => ({ sessions: Object.values(sessions), scheduled: Object.values(scheduled) }), [sessions, scheduled]);
}
