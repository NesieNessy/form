import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '../supabase';
import { getWorkoutData, useWorkoutsStore } from '../workoutsStore';
import type { DirtySets, RemoteSnapshot } from '../workout/state';
import {
  rowToScheduled,
  rowToSession,
  rowToVersion,
  rowToWorkout,
  scheduledToRow,
  sessionToPayload,
  versionToPayload,
  workoutFlagsToRow,
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
  return dirty.versions.length + dirty.workouts.length + dirty.scheduled.length + dirty.sessions.length;
}

async function push(userId: string): Promise<boolean> {
  const data = getWorkoutData();
  const done: DirtySets = { versions: [], workouts: [], scheduled: [], sessions: [] };
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

  useWorkoutsStore.getState().clearDirty(done);
  return ok;
}

async function pull(): Promise<boolean> {
  const [workouts, versions, scheduled, sessions] = await Promise.all([
    supabase.from('workouts').select('*'),
    supabase.from('workout_versions').select('*, blocks(*, steps(*))'),
    supabase.from('scheduled_workouts').select('*'),
    supabase.from('sessions').select('*, session_results(*)'),
  ]);
  if (workouts.error || versions.error || scheduled.error || sessions.error) return false;

  const snapshot: RemoteSnapshot = {
    versions: (versions.data as VersionRow[]).map(rowToVersion),
    workouts: (workouts.data as WorkoutRow[]).map(rowToWorkout).filter((w) => w !== undefined),
    scheduled: (scheduled.data as ScheduledRow[]).map(rowToScheduled),
    sessions: (sessions.data as SessionRow[]).map(rowToSession),
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
