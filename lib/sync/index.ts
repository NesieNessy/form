import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '../supabase';
import { getWorkoutData, useWorkoutsStore } from '../workoutsStore';
import { PROFILE_KEY, type DirtySets, type RemoteSnapshot } from '../workout/state';
import {
  recoveryToRow,
  rowToRecovery,
  type RecoveryRow,
  foodLogToRow,
  foodToRow,
  rowToFood,
  rowToFoodLog,
  rowToSavedMeal,
  savedMealToRow,
  type FoodLogRow,
  type FoodRow,
  type SavedMealRow,
  activityToRow,
  benchmarkToRow,
  observationToRow,
  rowToActivity,
  rowToObservation,
  profileToRow,
  rowToBenchmark,
  rowToProfile,
  rowToScheduled,
  rowToSession,
  rowToVersion,
  rowToWorkout,
  scheduledToRow,
  sessionToPayload,
  versionToPayload,
  workoutFlagsToRow,
  type ActivityRow,
  type BenchmarkRow,
  type ObservationRow,
  type ProfileRow,
  type ScheduledRow,
  type SessionRow,
  type VersionRow,
  type WorkoutRow,
} from './mappers';

/**
 * Background sync between the local store and Supabase. Local changes are
 * pushed first (every write is an idempotent upsert keyed by a device-made
 * id), then server state is pulled and merged. Anything that fails stays
 * queued and is retried on the next run.
 */

type SyncState = {
  status: 'idle' | 'syncing' | 'error';
  lastSyncedAt: number | null;
};

export const useSyncStore = create<SyncState>(() => ({ status: 'idle', lastSyncedAt: null }));

export function pendingChangeCount(dirty: DirtySets): number {
  return Object.values(dirty).reduce((n, ids) => n + ids.length, 0);
}

async function push(userId: string): Promise<boolean> {
  const data = getWorkoutData();
  const done: DirtySets = { versions: [], workouts: [], scheduled: [], sessions: [], benchmarks: [], activities: [], observations: [], foods: [], foodLog: [], savedMeals: [], recovery: [], profile: [] };
  let ok = true;

  const failedVersions = new Set<string>();
  const versions = data.dirty.versions
    .map((id) => data.versions[id])
    .filter(Boolean)
    .sort((a, b) => a.version - b.version);
  for (const version of versions) {
    const workout = data.workouts[version.workoutId];
    if (!workout) {
      done.versions.push(version.id);
      continue;
    }
    const { error } = await supabase.rpc('save_workout_version', { payload: versionToPayload(workout, version) });
    if (error) {
      ok = false;
      failedVersions.add(version.id);
    } else {
      done.versions.push(version.id);
    }
  }
  const workoutBlocked = (workoutId: string) =>
    Object.values(data.versions).some((v) => v.workoutId === workoutId && failedVersions.has(v.id));

  for (const id of data.dirty.workouts) {
    const workout = data.workouts[id];
    if (!workout) {
      done.workouts.push(id);
      continue;
    }
    if (workoutBlocked(id)) continue;
    const { error } = await supabase.from('workouts').update(workoutFlagsToRow(workout)).eq('id', id);
    if (error) ok = false;
    else done.workouts.push(id);
  }

  const entries = data.dirty.scheduled
    .map((id) => data.scheduled[id])
    .filter((e) => e && !workoutBlocked(e.workoutId));
  if (entries.length) {
    const { error } = await supabase.from('scheduled_workouts').upsert(entries.map((e) => scheduledToRow(e, userId)));
    if (error) ok = false;
    else done.scheduled.push(...entries.map((e) => e.id));
  }

  for (const id of data.dirty.sessions) {
    const session = data.sessions[id];
    if (!session) {
      done.sessions.push(id);
      continue;
    }
    if (session.status === 'in_progress' || workoutBlocked(session.workoutId)) continue;
    const { error } = await supabase.rpc('save_session', { payload: sessionToPayload(session) });
    if (error) ok = false;
    else done.sessions.push(id);
  }

  if (data.dirty.profile.length) {
    const { error } = await supabase.from('profiles').upsert(profileToRow(data.profile, userId));
    if (error) ok = false;
    else done.profile.push(PROFILE_KEY);
  }

  const benchmarks = data.dirty.benchmarks.map((id) => data.benchmarks[id]).filter(Boolean);
  if (benchmarks.length) {
    const { error } = await supabase.from('benchmarks').upsert(benchmarks.map((b) => benchmarkToRow(b, userId)));
    if (error) ok = false;
    else done.benchmarks.push(...benchmarks.map((b) => b.id));
  }

  const activities = data.dirty.activities.map((id) => data.activities[id]).filter(Boolean);
  if (activities.length) {
    const { error } = await supabase.from('external_activities').upsert(activities.map((a) => activityToRow(a, userId)));
    if (error) ok = false;
    else done.activities.push(...activities.map((a) => a.id));
  }

  const observations = data.dirty.observations.map((id) => data.observations[id]).filter(Boolean);
  if (observations.length) {
    const { error } = await supabase.from('health_observations').upsert(observations.map((o) => observationToRow(o, userId)));
    if (error) ok = false;
    else done.observations.push(...observations.map((o) => o.id));
  }

  const upsertAll = async <T extends { id: string }>(table: string, key: 'foods' | 'foodLog' | 'savedMeals' | 'recovery', rows: T[], toRow: (r: T) => object) => {
    if (!rows.length) return;
    const { error } = await supabase.from(table).upsert(rows.map(toRow));
    if (error) ok = false;
    else done[key].push(...rows.map((r) => r.id));
  };
  await upsertAll('foods', 'foods', data.dirty.foods.map((id) => data.foods[id]).filter(Boolean), (f) => foodToRow(f, userId));
  await upsertAll('food_log_entries', 'foodLog', data.dirty.foodLog.map((id) => data.foodLog[id]).filter(Boolean), (e) => foodLogToRow(e, userId));
  await upsertAll('saved_meals', 'savedMeals', data.dirty.savedMeals.map((id) => data.savedMeals[id]).filter(Boolean), (m) => savedMealToRow(m, userId));
  await upsertAll('daily_recovery', 'recovery', data.dirty.recovery.map((id) => data.recovery[id]).filter(Boolean), (d) => recoveryToRow(d, userId));

  useWorkoutsStore.getState().clearDirty(done);
  return ok;
}

async function pull(): Promise<boolean> {
  const [workouts, versions, scheduled, sessions, benchmarks, profile, activities, observations, foods, foodLog, savedMeals, recoveryDays] = await Promise.all([
    supabase.from('workouts').select('*'),
    supabase.from('workout_versions').select('*, blocks(*, steps(*))'),
    supabase.from('scheduled_workouts').select('*'),
    supabase.from('sessions').select('*, session_results(*)'),
    supabase.from('benchmarks').select('*'),
    supabase.from('profiles').select('*').maybeSingle(),
    supabase.from('external_activities').select('*'),
    supabase.from('health_observations').select('*'),
    supabase.from('foods').select('*'),
    supabase.from('food_log_entries').select('*'),
    supabase.from('saved_meals').select('*'),
    supabase.from('daily_recovery').select('*'),
  ]);
  if (workouts.error || versions.error || scheduled.error || sessions.error || benchmarks.error || profile.error || activities.error || observations.error || foods.error || foodLog.error || savedMeals.error || recoveryDays.error) return false;

  const snapshot: RemoteSnapshot = {
    versions: (versions.data as VersionRow[]).map(rowToVersion),
    workouts: (workouts.data as WorkoutRow[]).map(rowToWorkout).filter((w) => w !== undefined),
    scheduled: (scheduled.data as ScheduledRow[]).map(rowToScheduled),
    sessions: (sessions.data as SessionRow[]).map(rowToSession),
    benchmarks: (benchmarks.data as BenchmarkRow[]).map(rowToBenchmark),
    activities: (activities.data as ActivityRow[]).map(rowToActivity),
    observations: (observations.data as ObservationRow[]).map(rowToObservation),
    foods: (foods.data as FoodRow[]).map(rowToFood),
    foodLog: (foodLog.data as FoodLogRow[]).map(rowToFoodLog),
    savedMeals: (savedMeals.data as SavedMealRow[]).map(rowToSavedMeal),
    recovery: (recoveryDays.data as RecoveryRow[]).map(rowToRecovery),
    profile: profile.data ? rowToProfile(profile.data as ProfileRow) : undefined,
  };
  // Only keep rows whose version arrived too, so the UI never meets a dangling reference.
  const known = new Set([...snapshot.versions.map((v) => v.id), ...Object.keys(getWorkoutData().versions)]);
  snapshot.workouts = snapshot.workouts.filter((w) => known.has(w.currentVersionId));
  snapshot.scheduled = snapshot.scheduled.filter((s) => known.has(s.versionId));

  useWorkoutsStore.getState().mergeRemote(snapshot);
  return true;
}

let running: Promise<void> | null = null;
let rerun = false;

/** Pushes then pulls. Calls made while a run is in flight are folded into one follow-up run. */
export function syncNow(): Promise<void> {
  if (!isSupabaseConfigured) return Promise.resolve();
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    do {
      rerun = false;
      const userId = getWorkoutData().ownerUserId;
      if (!userId) break;
      useSyncStore.setState({ status: 'syncing' });
      try {
        const pushed = await push(userId);
        const pulled = await pull();
        useSyncStore.setState(pushed && pulled ? { status: 'idle', lastSyncedAt: Date.now() } : { status: 'error' });
      } catch {
        useSyncStore.setState({ status: 'error' });
      }
    } while (rerun);
  })().finally(() => {
    running = null;
  });
  return running;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let watching = false;

/** Syncs shortly after any local change, so a burst of edits becomes one upload. */
export function watchLocalChanges(): void {
  if (watching || !isSupabaseConfigured) return;
  watching = true;
  let lastCount = pendingChangeCount(useWorkoutsStore.getState().dirty);
  useWorkoutsStore.subscribe((s) => {
    const count = pendingChangeCount(s.dirty);
    const grew = count > lastCount;
    lastCount = count;
    if (!grew || !s.ownerUserId) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void syncNow();
    }, 1500);
  });
}
