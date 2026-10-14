import { newUuid } from '../id';
import type { Session, WorkoutContent } from '../workout/model';
import { createWorkout, mark, type WorkoutData } from '../workout/state';
import { blockResultsFromActivity, workoutForActivity } from './logic';
import { localDateOf, type ActivityStatus, type ExternalActivity, type HealthObservation, type MetricKey, type ParsedActivity, type Provider } from './model';

/**
 * State transitions for activities and measurements, on the same local
 * store and sync bookkeeping as workouts. Pure, so the rules can be tested.
 */

/**
 * Adds a parsed activity. Importing the same file again finds the existing
 * record by its content-derived id and changes nothing, so a retry or a
 * double tap never creates a second copy.
 */
export function importActivity(data: WorkoutData, parsed: ParsedActivity, nowMs: number): { data: WorkoutData; activityId: string; alreadyImported: boolean } {
  const existing = Object.values(data.activities).find((a) => a.provider === parsed.provider && a.externalId === parsed.externalId);
  if (existing && !existing.deletedAt) return { data, activityId: existing.id, alreadyImported: true };

  const activityId = existing?.id ?? newUuid();
  const activity: ExternalActivity = { ...parsed, id: activityId, status: 'new', ingestedAt: nowMs, updatedAt: nowMs };
  return {
    activityId,
    alreadyImported: false,
    data: { ...data, activities: { ...data.activities, [activityId]: activity }, dirty: mark(data.dirty, { activities: [activityId] }) },
  };
}

function patchActivity(data: WorkoutData, activityId: string, patch: Partial<ExternalActivity>, nowMs: number): WorkoutData {
  const activity = data.activities[activityId];
  if (!activity) return data;
  return {
    ...data,
    activities: { ...data.activities, [activityId]: { ...activity, ...patch, updatedAt: nowMs } },
    dirty: mark(data.dirty, { activities: [activityId] }),
  };
}

/** Marks an activity as the same effort as another (kept, not counted), or ignored, or back to undecided. */
export function setActivityStatus(data: WorkoutData, activityId: string, status: Extract<ActivityStatus, 'new' | 'duplicate' | 'ignored'>, nowMs: number, duplicateOfId?: string): WorkoutData {
  const activity = data.activities[activityId];
  if (!activity || activity.status === 'linked' || activity.status === 'standalone') return data;
  return patchActivity(data, activityId, { status, duplicateOfId: status === 'duplicate' ? duplicateOfId : undefined }, nowMs);
}

function sessionFromActivity(entry: { id: string; workoutId: string; versionId: string }, content: WorkoutContent, activity: ExternalActivity, nowMs: number): Session {
  return {
    id: newUuid(),
    workoutId: entry.workoutId,
    versionId: entry.versionId,
    scheduledWorkoutId: entry.id,
    prescribed: JSON.parse(JSON.stringify(content)) as WorkoutContent,
    status: 'completed',
    entryMode: 'import',
    startedAt: activity.startedAt,
    endedAt: activity.endedAt,
    blockResults: blockResultsFromActivity(content, activity),
    updatedAt: nowMs,
  };
}

/** Records an activity as the result of a planned workout, completing it. */
export function linkActivity(data: WorkoutData, activityId: string, scheduledId: string, nowMs: number): WorkoutData {
  const activity = data.activities[activityId];
  const entry = data.scheduled[scheduledId];
  const version = entry ? data.versions[entry.versionId] : undefined;
  if (!activity || activity.deletedAt || activity.sessionId || !entry || entry.deletedAt || entry.status !== 'planned' || version?.status !== 'published') return data;

  const session = sessionFromActivity(entry, version.content, activity, nowMs);
  return {
    ...data,
    sessions: { ...data.sessions, [session.id]: session },
    scheduled: { ...data.scheduled, [scheduledId]: { ...entry, status: 'completed', sessionId: session.id, updatedAt: nowMs } },
    activities: { ...data.activities, [activityId]: { ...activity, status: 'linked', sessionId: session.id, updatedAt: nowMs } },
    dirty: mark(data.dirty, { sessions: [session.id], scheduled: [scheduledId], activities: [activityId] }),
  };
}

/** Logs an unplanned activity as a workout of its own, so it counts in the calendar and trends. */
export function logActivityAsWorkout(data: WorkoutData, activityId: string, nowMs: number): WorkoutData {
  const activity = data.activities[activityId];
  if (!activity || activity.deletedAt || activity.sessionId) return data;
  const content = workoutForActivity(activity, newUuid);
  const created = createWorkout(data, content, { source: 'import', scheduledAt: activity.startedAt, nowMs });
  const entry = created.data.scheduled[created.scheduledId as string];
  const session = sessionFromActivity(entry, content, activity, nowMs);
  return {
    ...created.data,
    sessions: { ...created.data.sessions, [session.id]: session },
    scheduled: { ...created.data.scheduled, [entry.id]: { ...entry, status: 'completed', sessionId: session.id, updatedAt: nowMs } },
    activities: { ...created.data.activities, [activityId]: { ...activity, status: 'standalone', sessionId: session.id, updatedAt: nowMs } },
    dirty: mark(created.data.dirty, { sessions: [session.id], scheduled: [entry.id], activities: [activityId] }),
  };
}

/** Removes an activity. A workout result it produced stays, since the athlete saw and kept it; only the link goes. */
export function removeActivity(data: WorkoutData, activityId: string, nowMs: number): WorkoutData {
  return patchActivity(data, activityId, { deletedAt: nowMs, series: undefined }, nowMs);
}

export type ObservationInput = { metric: MetricKey; value: number; unit: string; observedAt: number; method?: string };

export function addObservation(data: WorkoutData, input: ObservationInput, nowMs: number): { data: WorkoutData; observationId: string } {
  const observationId = newUuid();
  const observation: HealthObservation = {
    id: observationId,
    metric: input.metric,
    value: input.value,
    unit: input.unit,
    observedAt: input.observedAt,
    localDate: localDateOf(input.observedAt),
    ingestedAt: nowMs,
    provider: 'manual',
    origin: 'user_entered',
    ...(input.method ? { method: input.method } : {}),
    updatedAt: nowMs,
  };
  return {
    observationId,
    data: { ...data, observations: { ...data.observations, [observationId]: observation }, dirty: mark(data.dirty, { observations: [observationId] }) },
  };
}

export function removeObservation(data: WorkoutData, observationId: string, nowMs: number): WorkoutData {
  const o = data.observations[observationId];
  if (!o) return data;
  return { ...data, observations: { ...data.observations, [observationId]: { ...o, deletedAt: nowMs, updatedAt: nowMs } }, dirty: mark(data.dirty, { observations: [observationId] }) };
}

/**
 * Deletes everything that came from one source, for example all imported
 * files or all manual entries. Workout results already recorded from those
 * activities are kept; only the source data goes.
 */
export function removeSource(data: WorkoutData, provider: Provider, nowMs: number): WorkoutData {
  const activityIds = Object.values(data.activities).filter((a) => a.provider === provider && !a.deletedAt).map((a) => a.id);
  const observationIds = Object.values(data.observations).filter((o) => o.provider === provider && !o.deletedAt).map((o) => o.id);
  const activities = { ...data.activities };
  for (const id of activityIds) activities[id] = { ...activities[id], deletedAt: nowMs, series: undefined, updatedAt: nowMs };
  const observations = { ...data.observations };
  for (const id of observationIds) observations[id] = { ...observations[id], deletedAt: nowMs, updatedAt: nowMs };
  return { ...data, activities, observations, dirty: mark(data.dirty, { activities: activityIds, observations: observationIds }) };
}
