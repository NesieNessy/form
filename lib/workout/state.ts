import { EMPTY_PROFILE, oneRepMaxByActivity, type Benchmark, type Profile } from '../athlete/model';
import type { ExternalActivity, HealthObservation } from '../health/model';
import { newUuid } from '../id';
import type { Food, FoodLogEntry, SavedMeal } from '../nutrition/model';
import type { RecoveryDay } from '../recovery/model';
import type { LegacyWorkout } from '../types';
import { wizardToContent } from './fromWizard';
import type {
  BlockResult,
  ScheduledWorkout,
  Session,
  Workout,
  WorkoutContent,
  WorkoutSource,
  WorkoutVersion,
} from './model';
import { emptyBlockResult } from './scoring';
import { IDLE_TIMER } from './timer';
import { validateWorkout } from './validate';

/**
 * Pure state transitions for the workout store. Kept free of storage and
 * React so the rules (versioning, planned vs. actual, sync bookkeeping) can
 * be tested directly.
 */

export type DirtySets = {
  versions: string[];
  workouts: string[];
  scheduled: string[];
  sessions: string[];
  benchmarks: string[];
  activities: string[];
  observations: string[];
  foods: string[];
  foodLog: string[];
  savedMeals: string[];
  recovery: string[];
  /** Holds PROFILE_KEY while the profile has unsent changes. */
  profile: string[];
};

export const PROFILE_KEY = 'profile';

/** The persisted store's version; raise it whenever WorkoutData gains a collection (see withCurrentShape). */
export const STORE_VERSION = 6;

const DIRTY_KEYS = ['versions', 'workouts', 'scheduled', 'sessions', 'benchmarks', 'activities', 'observations', 'foods', 'foodLog', 'savedMeals', 'recovery', 'profile'] as const;

const NO_DIRTY: DirtySets = { versions: [], workouts: [], scheduled: [], sessions: [], benchmarks: [], activities: [], observations: [], foods: [], foodLog: [], savedMeals: [], recovery: [], profile: [] };

export type WorkoutData = {
  /** The signed-in user this local data belongs to; null while it has never been attached to an account. */
  ownerUserId: string | null;
  workouts: Record<string, Workout>;
  versions: Record<string, WorkoutVersion>;
  scheduled: Record<string, ScheduledWorkout>;
  sessions: Record<string, Session>;
  profile: Profile;
  benchmarks: Record<string, Benchmark>;
  activities: Record<string, ExternalActivity>;
  observations: Record<string, HealthObservation>;
  /** The athlete's own foods; the catalog ships with the app. */
  foods: Record<string, Food>;
  foodLog: Record<string, FoodLogEntry>;
  savedMeals: Record<string, SavedMeal>;
  /** One summary per day: status, which signals, and what the athlete chose. */
  recovery: Record<string, RecoveryDay>;
  /** Ids changed locally and not yet confirmed by the server. */
  dirty: DirtySets;
};

export const EMPTY_DATA: WorkoutData = {
  ownerUserId: null,
  workouts: {},
  versions: {},
  scheduled: {},
  sessions: {},
  profile: EMPTY_PROFILE,
  benchmarks: {},
  activities: {},
  observations: {},
  foods: {},
  foodLog: {},
  savedMeals: {},
  recovery: {},
  dirty: NO_DIRTY,
};

export function mark(dirty: DirtySets, patch: Partial<DirtySets>): DirtySets {
  const next = { ...dirty };
  for (const key of DIRTY_KEYS) {
    const add = patch[key];
    if (add && add.length) next[key] = [...new Set([...dirty[key], ...add])];
  }
  return next;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createWorkout(
  data: WorkoutData,
  content: WorkoutContent,
  opts: { source: WorkoutSource; scheduledAt?: number; isTemplate?: boolean; nowMs: number; workoutId?: string }
): { data: WorkoutData; workoutId: string; versionId: string; scheduledId?: string } {
  const workoutId = opts.workoutId ?? newUuid();
  const versionId = newUuid();
  const version: WorkoutVersion = {
    id: versionId,
    workoutId,
    version: 1,
    status: validateWorkout(content).valid ? 'published' : 'draft',
    content,
    createdAt: opts.nowMs,
  };
  const workout: Workout = {
    id: workoutId,
    currentVersionId: versionId,
    isTemplate: opts.isTemplate ?? false,
    source: opts.source,
    createdAt: opts.nowMs,
    updatedAt: opts.nowMs,
  };

  let next: WorkoutData = {
    ...data,
    workouts: { ...data.workouts, [workoutId]: workout },
    versions: { ...data.versions, [versionId]: version },
    dirty: mark(data.dirty, { versions: [versionId], workouts: [workoutId] }),
  };

  let scheduledId: string | undefined;
  if (opts.scheduledAt !== undefined) {
    const res = scheduleWorkout(next, workoutId, opts.scheduledAt, opts.nowMs);
    next = res.data;
    scheduledId = res.scheduledId;
  }
  return { data: next, workoutId, versionId, scheduledId };
}

/** Editing never mutates a version: it adds the next one and repoints the workout. Existing schedule entries keep their pinned version. */
export function reviseWorkout(data: WorkoutData, workoutId: string, content: WorkoutContent, nowMs: number): { data: WorkoutData; versionId: string } {
  const workout = data.workouts[workoutId];
  if (!workout) throw new Error(`Unknown workout ${workoutId}`);
  const previous = Object.values(data.versions).filter((v) => v.workoutId === workoutId);
  const versionId = newUuid();
  const version: WorkoutVersion = {
    id: versionId,
    workoutId,
    version: Math.max(0, ...previous.map((v) => v.version)) + 1,
    status: validateWorkout(content).valid ? 'published' : 'draft',
    content,
    createdAt: nowMs,
  };
  return {
    versionId,
    data: {
      ...data,
      versions: { ...data.versions, [versionId]: version },
      workouts: { ...data.workouts, [workoutId]: { ...workout, currentVersionId: versionId, updatedAt: nowMs } },
      dirty: mark(data.dirty, { versions: [versionId], workouts: [workoutId] }),
    },
  };
}

export function scheduleWorkout(data: WorkoutData, workoutId: string, scheduledAt: number, nowMs: number): { data: WorkoutData; scheduledId: string } {
  const workout = data.workouts[workoutId];
  if (!workout) throw new Error(`Unknown workout ${workoutId}`);
  const scheduledId = newUuid();
  const entry: ScheduledWorkout = {
    id: scheduledId,
    workoutId,
    versionId: workout.currentVersionId,
    scheduledAt,
    status: 'planned',
    createdAt: nowMs,
    updatedAt: nowMs,
  };
  return {
    scheduledId,
    data: { ...data, scheduled: { ...data.scheduled, [scheduledId]: entry }, dirty: mark(data.dirty, { scheduled: [scheduledId] }) },
  };
}

/** Marks a planned workout as not done, e.g. a rest day the athlete chose. The plan itself stays as it was. */
export function skipScheduled(data: WorkoutData, scheduledId: string, nowMs: number): WorkoutData {
  const entry = data.scheduled[scheduledId];
  if (!entry || entry.deletedAt || entry.status !== 'planned') return data;
  return { ...data, scheduled: { ...data.scheduled, [scheduledId]: { ...entry, status: 'skipped', updatedAt: nowMs } }, dirty: mark(data.dirty, { scheduled: [scheduledId] }) };
}

/** Moves a planned workout to another time, keeping its pinned version. */
export function moveScheduled(data: WorkoutData, scheduledId: string, scheduledAt: number, nowMs: number): WorkoutData {
  const entry = data.scheduled[scheduledId];
  if (!entry || entry.deletedAt || entry.status !== 'planned') return data;
  return { ...data, scheduled: { ...data.scheduled, [scheduledId]: { ...entry, scheduledAt, updatedAt: nowMs } }, dirty: mark(data.dirty, { scheduled: [scheduledId] }) };
}

/**
 * Applies an approved adaptation to one schedule entry: the workout gets a
 * new version and this entry is moved onto it. The version it was on stays
 * in the history, and other entries of the same workout keep theirs.
 */
export function applyAdaptation(data: WorkoutData, scheduledId: string, content: WorkoutContent, nowMs: number): WorkoutData {
  const entry = data.scheduled[scheduledId];
  if (!entry || entry.deletedAt || entry.status !== 'planned') return data;
  const revised = reviseWorkout(data, entry.workoutId, content, nowMs);
  return {
    ...revised.data,
    scheduled: { ...revised.data.scheduled, [scheduledId]: { ...entry, versionId: revised.versionId, updatedAt: nowMs } },
    dirty: mark(revised.data.dirty, { scheduled: [scheduledId] }),
  };
}

export function setTemplate(data: WorkoutData, workoutId: string, isTemplate: boolean, nowMs: number): WorkoutData {
  const workout = data.workouts[workoutId];
  if (!workout) return data;
  return {
    ...data,
    workouts: { ...data.workouts, [workoutId]: { ...workout, isTemplate, updatedAt: nowMs } },
    dirty: mark(data.dirty, { workouts: [workoutId] }),
  };
}

/**
 * Removes a schedule entry and its logged session. The workout itself goes
 * too unless it is a template or is still scheduled elsewhere. Records are
 * tombstoned, not dropped, so the deletion reaches other devices.
 */
export function removeScheduled(data: WorkoutData, scheduledId: string, nowMs: number): WorkoutData {
  const entry = data.scheduled[scheduledId];
  if (!entry) return data;

  const scheduled = { ...data.scheduled, [scheduledId]: { ...entry, deletedAt: nowMs, updatedAt: nowMs } };
  const patch: Partial<DirtySets> = { scheduled: [scheduledId] };

  const sessions = { ...data.sessions };
  const sessionIds = Object.values(data.sessions)
    .filter((s) => s.scheduledWorkoutId === scheduledId && !s.deletedAt)
    .map((s) => s.id);
  for (const id of sessionIds) sessions[id] = { ...sessions[id], deletedAt: nowMs, updatedAt: nowMs, progress: undefined };
  if (sessionIds.length) patch.sessions = sessionIds;

  const workouts = { ...data.workouts };
  const workout = workouts[entry.workoutId];
  const stillScheduled = Object.values(scheduled).some((s) => s.workoutId === entry.workoutId && !s.deletedAt);
  if (workout && !workout.isTemplate && !stillScheduled) {
    workouts[workout.id] = { ...workout, deletedAt: nowMs, updatedAt: nowMs };
    patch.workouts = [workout.id];
  }

  return { ...data, scheduled, sessions, workouts, dirty: mark(data.dirty, patch) };
}

export function findOpenSession(data: WorkoutData, scheduledId: string): Session | undefined {
  return Object.values(data.sessions).find((s) => s.scheduledWorkoutId === scheduledId && s.status === 'in_progress' && !s.deletedAt);
}

/**
 * Starts (or resumes) a session for a schedule entry. The prescription is
 * copied into the session so later edits to the workout cannot change what
 * this session was measured against.
 */
export function startSession(
  data: WorkoutData,
  scheduledId: string,
  entryMode: 'player' | 'manual',
  nowMs: number
): { data: WorkoutData; sessionId: string } | { error: 'not_found' | 'not_published' } {
  const entry = data.scheduled[scheduledId];
  const version = entry ? data.versions[entry.versionId] : undefined;
  if (!entry || entry.deletedAt || !version) return { error: 'not_found' };
  if (version.status !== 'published') return { error: 'not_published' };

  const open = findOpenSession(data, scheduledId);
  if (open) return { data, sessionId: open.id };

  const prescribed = clone(version.content);
  const sessionId = newUuid();
  const session: Session = {
    id: sessionId,
    workoutId: entry.workoutId,
    versionId: entry.versionId,
    scheduledWorkoutId: scheduledId,
    prescribed,
    status: 'in_progress',
    entryMode,
    startedAt: entryMode === 'manual' ? entry.scheduledAt : nowMs,
    blockResults: entryMode === 'manual' ? prescribed.blocks.map((b) => emptyBlockResult(b, oneRepMaxByActivity(Object.values(data.benchmarks)))) : [],
    progress: entryMode === 'player' ? { blockIndex: 0, timer: IDLE_TIMER, roundsCompleted: 0, awaitingResult: false } : undefined,
    updatedAt: nowMs,
  };
  // An in-progress session stays on the device; it is uploaded once finished.
  return { sessionId, data: { ...data, sessions: { ...data.sessions, [sessionId]: session } } };
}

export function patchSession(data: WorkoutData, sessionId: string, patch: Partial<Session>, nowMs: number): WorkoutData {
  const session = data.sessions[sessionId];
  if (!session) return data;
  return { ...data, sessions: { ...data.sessions, [sessionId]: { ...session, ...patch, updatedAt: nowMs } } };
}

export function putBlockResult(data: WorkoutData, sessionId: string, result: BlockResult, nowMs: number): WorkoutData {
  const session = data.sessions[sessionId];
  if (!session) return data;
  const exists = session.blockResults.some((r) => r.blockId === result.blockId);
  const blockResults = exists
    ? session.blockResults.map((r) => (r.blockId === result.blockId ? result : r))
    : [...session.blockResults, result];
  return patchSession(data, sessionId, { blockResults }, nowMs);
}

export function completeSession(
  data: WorkoutData,
  sessionId: string,
  extras: { rpe?: number; notes?: string },
  nowMs: number
): WorkoutData {
  const session = data.sessions[sessionId];
  if (!session) return data;

  const finished: Session = {
    ...session,
    status: 'completed',
    endedAt: session.entryMode === 'player' ? nowMs : session.endedAt,
    rpe: extras.rpe,
    notes: extras.notes?.trim() || undefined,
    progress: undefined,
    updatedAt: nowMs,
  };

  const scheduled = { ...data.scheduled };
  const patch: Partial<DirtySets> = { sessions: [sessionId] };
  const entry = session.scheduledWorkoutId ? scheduled[session.scheduledWorkoutId] : undefined;
  if (entry) {
    scheduled[entry.id] = { ...entry, status: 'completed', sessionId, updatedAt: nowMs };
    patch.scheduled = [entry.id];
  }

  return { ...data, sessions: { ...data.sessions, [sessionId]: finished }, scheduled, dirty: mark(data.dirty, patch) };
}

/** A session given up before finishing is discarded locally; it was never uploaded. */
export function discardSession(data: WorkoutData, sessionId: string): WorkoutData {
  const session = data.sessions[sessionId];
  if (!session || session.status !== 'in_progress') return data;
  const sessions = { ...data.sessions };
  delete sessions[sessionId];
  return { ...data, sessions };
}

export function clearDirty(data: WorkoutData, done: Partial<DirtySets>): WorkoutData {
  const dirty = { ...data.dirty };
  for (const key of DIRTY_KEYS) {
    const sent = done[key];
    if (sent && sent.length) dirty[key] = data.dirty[key].filter((id) => !sent.includes(id));
  }
  return { ...data, dirty };
}

// ------------------------------------------------ profile and benchmarks

export function updateProfile(data: WorkoutData, patch: Partial<Omit<Profile, 'updatedAt'>>, nowMs: number): WorkoutData {
  return {
    ...data,
    profile: { ...data.profile, ...patch, updatedAt: nowMs },
    dirty: mark(data.dirty, { profile: [PROFILE_KEY] }),
  };
}

export type BenchmarkInput = Pick<Benchmark, 'kind' | 'activityId' | 'value' | 'unit' | 'measuredOn' | 'source' | 'notes'>;

/** Adds one dated measurement. Earlier measurements stay as history. */
export function addBenchmark(data: WorkoutData, input: BenchmarkInput, nowMs: number): { data: WorkoutData; benchmarkId: string } {
  const benchmarkId = newUuid();
  const benchmark: Benchmark = { ...input, id: benchmarkId, notes: input.notes?.trim() || undefined, createdAt: nowMs, updatedAt: nowMs };
  return {
    benchmarkId,
    data: {
      ...data,
      benchmarks: { ...data.benchmarks, [benchmarkId]: benchmark },
      dirty: mark(data.dirty, { benchmarks: [benchmarkId] }),
    },
  };
}

export function removeBenchmark(data: WorkoutData, benchmarkId: string, nowMs: number): WorkoutData {
  const benchmark = data.benchmarks[benchmarkId];
  if (!benchmark) return data;
  return {
    ...data,
    benchmarks: { ...data.benchmarks, [benchmarkId]: { ...benchmark, deletedAt: nowMs, updatedAt: nowMs } },
    dirty: mark(data.dirty, { benchmarks: [benchmarkId] }),
  };
}

export type RemoteSnapshot = {
  workouts: Workout[];
  versions: WorkoutVersion[];
  scheduled: ScheduledWorkout[];
  sessions: Session[];
  benchmarks: Benchmark[];
  activities: ExternalActivity[];
  observations: HealthObservation[];
  foods: Food[];
  foodLog: FoodLogEntry[];
  savedMeals: SavedMeal[];
  recovery: RecoveryDay[];
  /** Absent when the account has no profile row yet. */
  profile?: Profile;
};

/**
 * Folds server state into local state. A local record with unsent changes
 * is never overwritten; otherwise the newer `updatedAt` wins. Versions are
 * immutable, so a version already held locally is left alone.
 */
export function mergeRemote(data: WorkoutData, remote: RemoteSnapshot): WorkoutData {
  const versions = { ...data.versions };
  for (const v of remote.versions) if (!versions[v.id]) versions[v.id] = v;

  const mergeByUpdatedAt = <T extends { id: string; updatedAt: number }>(local: Record<string, T>, incoming: T[], dirty: string[]) => {
    const out = { ...local };
    for (const row of incoming) {
      const mine = out[row.id];
      if (!mine || (!dirty.includes(row.id) && row.updatedAt > mine.updatedAt)) out[row.id] = row;
    }
    return out;
  };

  const sessions = { ...data.sessions };
  for (const row of remote.sessions) {
    const mine = sessions[row.id];
    if (!mine || (!data.dirty.sessions.includes(row.id) && mine.status !== 'in_progress' && row.updatedAt > mine.updatedAt)) {
      sessions[row.id] = row;
    }
  }

  const takeRemoteProfile = remote.profile && data.dirty.profile.length === 0 && remote.profile.updatedAt > data.profile.updatedAt;

  return {
    ...data,
    versions,
    workouts: mergeByUpdatedAt(data.workouts, remote.workouts, data.dirty.workouts),
    scheduled: mergeByUpdatedAt(data.scheduled, remote.scheduled, data.dirty.scheduled),
    sessions,
    benchmarks: mergeByUpdatedAt(data.benchmarks, remote.benchmarks, data.dirty.benchmarks),
    activities: mergeByUpdatedAt(data.activities, remote.activities, data.dirty.activities),
    observations: mergeByUpdatedAt(data.observations, remote.observations, data.dirty.observations),
    foods: mergeByUpdatedAt(data.foods, remote.foods, data.dirty.foods),
    foodLog: mergeByUpdatedAt(data.foodLog, remote.foodLog, data.dirty.foodLog),
    savedMeals: mergeByUpdatedAt(data.savedMeals, remote.savedMeals, data.dirty.savedMeals),
    recovery: mergeByUpdatedAt(data.recovery, remote.recovery, data.dirty.recovery),
    profile: takeRemoteProfile && remote.profile ? remote.profile : data.profile,
  };
}

/**
 * Decides what happens to local data when a user signs in: data that never
 * belonged to an account is adopted and queued for upload; data belonging to
 * a different account is dropped so it cannot leak into this one.
 */
export function attachToUser(data: WorkoutData, userId: string): WorkoutData {
  if (data.ownerUserId === userId) return data;
  if (data.ownerUserId !== null) return { ...EMPTY_DATA, ownerUserId: userId };

  return {
    ...data,
    ownerUserId: userId,
    dirty: {
      versions: Object.values(data.versions).filter((v) => v.status === 'published').map((v) => v.id),
      workouts: Object.keys(data.workouts),
      scheduled: Object.keys(data.scheduled),
      sessions: Object.values(data.sessions).filter((s) => s.status !== 'in_progress').map((s) => s.id),
      benchmarks: Object.keys(data.benchmarks),
      activities: Object.keys(data.activities),
      observations: Object.keys(data.observations),
      foods: Object.keys(data.foods),
      foodLog: Object.keys(data.foodLog),
      savedMeals: Object.keys(data.savedMeals),
      recovery: Object.keys(data.recovery),
      // A profile that was never edited has nothing worth overwriting the account's copy with.
      profile: data.profile.updatedAt > 0 ? [PROFILE_KEY] : [],
    },
  };
}

/** Fills in collections and sync keys added after the stored copy was written (v3 had no health data, v4 no nutrition). */
export function withCurrentShape(old: Partial<WorkoutData>): WorkoutData {
  return { ...EMPTY_DATA, ...old, dirty: { ...NO_DIRTY, ...old.dirty } } as WorkoutData;
}

/** Everything on the device is dropped, e.g. after the account was deleted. */
export function wipe(): WorkoutData {
  return EMPTY_DATA;
}

// ------------------------------------------------- store v2 -> v3

type V2State = Omit<WorkoutData, 'profile' | 'benchmarks' | 'activities' | 'observations' | 'foods' | 'foodLog' | 'savedMeals' | 'recovery' | 'dirty'> & {
  settings?: { weeklySessionTarget?: number };
  dirty?: Partial<DirtySets>;
};

/** Store v2 had no profile or benchmarks, and kept the weekly target under `settings`. */
export function upgradeV2(old: V2State): WorkoutData {
  const { settings, ...rest } = old;
  return {
    ...EMPTY_DATA,
    ...rest,
    profile: { ...EMPTY_PROFILE, weeklySessionTarget: settings?.weeklySessionTarget ?? EMPTY_PROFILE.weeklySessionTarget },
    benchmarks: {},
    dirty: { ...NO_DIRTY, ...old.dirty },
  };
}

// ------------------------------------------------- legacy (store v1)

type LegacyState = { workouts?: LegacyWorkout[] };

/**
 * Store v1 held one flat record per logged workout. Each becomes a workout
 * with one version and one schedule entry on its original date. Whether it
 * was actually done was never recorded, so it stays `planned`.
 */
export function migrateLegacy(old: LegacyState, nowMs: number): WorkoutData {
  let data: WorkoutData = EMPTY_DATA;
  for (const w of old.workouts ?? []) {
    const extras = [
      w.durationLabel ? `Duration: ${w.durationLabel}` : undefined,
      w.totalVolumeLabel ? `Total volume: ${w.totalVolumeLabel}` : undefined,
    ].filter(Boolean);
    const notes = [w.notes, ...extras].filter(Boolean).join('\n') || undefined;
    const content = wizardToContent({ title: w.title, category: w.category, notes, sections: w.sections ?? [] });
    data = createWorkout(data, content, { source: 'manual', scheduledAt: w.dateTimeMs, nowMs: w.createdAt ?? nowMs }).data;
  }
  return data;
}
