import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BlockResult, Session, WorkoutContent, WorkoutSource } from './workout/model';
import * as state from './workout/state';
import { EMPTY_DATA, type DirtySets, type RemoteSnapshot, type WorkoutData } from './workout/state';

/**
 * The device's copy of the athlete's training data. It is the source of
 * truth for the UI and works with no network; lib/sync pushes the `dirty`
 * records to Supabase and folds server changes back in.
 */
type Actions = {
  createWorkout: (
    content: WorkoutContent,
    opts: { source: WorkoutSource; scheduledAt?: number; isTemplate?: boolean }
  ) => { workoutId: string; versionId: string; scheduledId?: string };
  scheduleWorkout: (workoutId: string, scheduledAt: number) => string;
  setTemplate: (workoutId: string, isTemplate: boolean) => void;
  removeScheduled: (scheduledId: string) => void;
  startSession: (scheduledId: string, entryMode: 'player' | 'manual') => { sessionId: string } | { error: 'not_found' | 'not_published' };
  patchSession: (sessionId: string, patch: Partial<Session>) => void;
  putBlockResult: (sessionId: string, result: BlockResult) => void;
  completeSession: (sessionId: string, extras: { rpe?: number; notes?: string }) => void;
  discardSession: (sessionId: string) => void;

  // Used by lib/sync.
  attachToUser: (userId: string) => void;
  clearDirty: (done: Partial<DirtySets>) => void;
  mergeRemote: (remote: RemoteSnapshot) => void;
};

export type WorkoutsState = WorkoutData & Actions;

export const useWorkoutsStore = create<WorkoutsState>()(
  persist(
    (set, get) => ({
      ...EMPTY_DATA,

      createWorkout: (content, opts) => {
        const { data, ...ids } = state.createWorkout(get(), content, { ...opts, nowMs: Date.now() });
        set(data);
        return ids;
      },
      scheduleWorkout: (workoutId, scheduledAt) => {
        const { data, scheduledId } = state.scheduleWorkout(get(), workoutId, scheduledAt, Date.now());
        set(data);
        return scheduledId;
      },
      setTemplate: (workoutId, isTemplate) => set(state.setTemplate(get(), workoutId, isTemplate, Date.now())),
      removeScheduled: (scheduledId) => set(state.removeScheduled(get(), scheduledId, Date.now())),
      startSession: (scheduledId, entryMode) => {
        const res = state.startSession(get(), scheduledId, entryMode, Date.now());
        if ('error' in res) return res;
        set(res.data);
        return { sessionId: res.sessionId };
      },
      patchSession: (sessionId, patch) => set(state.patchSession(get(), sessionId, patch, Date.now())),
      putBlockResult: (sessionId, result) => set(state.putBlockResult(get(), sessionId, result, Date.now())),
      completeSession: (sessionId, extras) => set(state.completeSession(get(), sessionId, extras, Date.now())),
      discardSession: (sessionId) => set(state.discardSession(get(), sessionId)),

      attachToUser: (userId) => set(state.attachToUser(get(), userId)),
      clearDirty: (done) => set(state.clearDirty(get(), done)),
      mergeRemote: (remote) => set(state.mergeRemote(get(), remote)),
    }),
    {
      name: 'form-workouts-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2) return state.migrateLegacy(persisted as Parameters<typeof state.migrateLegacy>[0], Date.now());
        return persisted as WorkoutData;
      },
      partialize: ({ ownerUserId, workouts, versions, scheduled, sessions, dirty, settings }): WorkoutData => ({
        ownerUserId,
        workouts,
        versions,
        scheduled,
        sessions,
        dirty,
        settings,
      }),
    }
  )
);

/** The plain data slice, for code outside React (sync, tests). */
export function getWorkoutData(): WorkoutData {
  const { ownerUserId, workouts, versions, scheduled, sessions, dirty, settings } = useWorkoutsStore.getState();
  return { ownerUserId, workouts, versions, scheduled, sessions, dirty, settings };
}
