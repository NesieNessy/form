import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Profile } from './athlete/model';
import type { ParsedActivity, Provider } from './health/model';
import * as health from './health/state';
import type { Food, FoodSnapshot, Nutrients, Quantity } from './nutrition/model';
import * as nutrition from './nutrition/state';
import type { CheckIn, Insight, OptionKind } from './recovery/model';
import * as recovery from './recovery/state';
import * as rehab from './rehab/state';
import { newUuid } from './id';
import { withFreshIds, type BlockResult, type Session, type WorkoutContent, type WorkoutSource } from './workout/model';
import * as state from './workout/state';
import { EMPTY_DATA, type BenchmarkInput, type DirtySets, type RemoteSnapshot, type WorkoutData } from './workout/state';

/**
 * The device's copy of the athlete's training data. It is the source of
 * truth for the UI and works with no network; lib/sync pushes the `dirty`
 * records to Supabase and folds server changes back in.
 */
type Actions = {
  createWorkout: (
    content: WorkoutContent,
    opts: { source: WorkoutSource; scheduledAt?: number; isTemplate?: boolean; workoutId?: string }
  ) => { workoutId: string; versionId: string; scheduledId?: string };
  applyAdaptation: (scheduledId: string, content: WorkoutContent) => void;
  /** Adds a workout a coach sent to the athlete's own calendar, as their own copy. */
  addFromCoach: (content: WorkoutContent, scheduledAt: number) => string;
  /** Adds one session of a physio's rehab plan to the calendar, as the athlete's own copy. */
  addFromRehabPlan: (content: WorkoutContent, scheduledAt: number) => string;
  scheduleWorkout: (workoutId: string, scheduledAt: number) => string;
  setTemplate: (workoutId: string, isTemplate: boolean) => void;
  removeScheduled: (scheduledId: string) => void;
  /** Moves a planned workout; used when the athlete approves a suggested move. */
  moveScheduled: (scheduledId: string, scheduledAt: number) => void;
  startSession: (scheduledId: string, entryMode: 'player' | 'manual') => { sessionId: string } | { error: 'not_found' | 'not_published' };
  patchSession: (sessionId: string, patch: Partial<Session>) => void;
  putBlockResult: (sessionId: string, result: BlockResult) => void;
  completeSession: (sessionId: string, extras: { rpe?: number; notes?: string }) => void;
  discardSession: (sessionId: string) => void;

  updateProfile: (patch: Partial<Omit<Profile, 'updatedAt'>>) => void;
  addBenchmark: (input: BenchmarkInput) => string;
  removeBenchmark: (benchmarkId: string) => void;

  importActivity: (parsed: ParsedActivity) => { activityId: string; alreadyImported: boolean };
  setActivityStatus: (activityId: string, status: 'new' | 'duplicate' | 'ignored', duplicateOfId?: string) => void;
  linkActivity: (activityId: string, scheduledId: string) => void;
  logActivityAsWorkout: (activityId: string) => void;
  removeActivity: (activityId: string) => void;
  addObservation: (input: health.ObservationInput) => string;
  removeObservation: (observationId: string) => void;
  /** Deletes all data from one source; recorded workout results stay. */
  removeSource: (provider: Provider) => void;

  // Nutrition. Writes that can be refused return the reasons instead of saving.
  addFood: (input: nutrition.FoodInput) => NutritionResult<{ foodId: string }>;
  removeFood: (foodId: string) => void;
  logFood: (food: Food | FoodSnapshot, quantity: Quantity, ctx: nutrition.LogContext) => NutritionResult<{ entryId: string }>;
  logQuickAdd: (input: { label?: string; nutrients: Nutrients; fluidMl?: number }, ctx: nutrition.LogContext) => NutritionResult<{ entryId: string }>;
  updateEntry: (entryId: string, patch: Parameters<typeof nutrition.updateEntry>[2]) => NutritionResult<object>;
  removeEntry: (entryId: string) => void;
  saveMeal: (name: string, entryIds: string[]) => NutritionResult<{ mealId: string }>;
  logSavedMeal: (mealId: string, ctx: nutrition.LogContext) => NutritionResult<{ entryIds: string[] }>;
  removeSavedMeal: (mealId: string) => void;

  saveCheckIn: (checkIn: CheckIn) => void;
  /** Records today's summary when it is viewed, so a shared coach summary is current. */
  recordRecoveryDay: (insight: Insight) => void;
  chooseRecoveryOption: (insight: Insight, option: OptionKind) => void;

  addEpisode: (input: rehab.EpisodeInput) => { ok: true; episodeId: string } | { ok: false; error: string };
  updateEpisode: (episodeId: string, patch: Parameters<typeof rehab.updateEpisode>[2]) => { ok: true } | { ok: false; error: string };
  removeEpisode: (episodeId: string) => void;
  addSymptomLog: (episodeId: string, input: rehab.SymptomInput) => { ok: true; logId: string } | { ok: false; error: string };
  removeSymptomLog: (logId: string) => void;
  /** Removes everything stored on this device. */
  wipe: () => void;

  // Used by lib/sync.
  attachToUser: (userId: string) => void;
  clearDirty: (done: Partial<DirtySets>) => void;
  mergeRemote: (remote: RemoteSnapshot) => void;
};

export type WorkoutsState = WorkoutData & Actions;

type NutritionResult<T> = ({ ok: true } & T) | { ok: false; issues: { field: string; message: string }[] };

/** Applies a nutrition transition and returns its outcome without the data. */
function applying<T extends object>(set: (data: WorkoutData) => void, res: ({ ok: true; data: WorkoutData } & T) | { ok: false; issues: { field: string; message: string; severity: string }[] }): NutritionResult<T> {
  if (!res.ok) return res;
  const { data, ...rest } = res;
  set(data);
  return rest as { ok: true } & T;
}

function pickData(s: WorkoutData): WorkoutData {
  const { ownerUserId, workouts, versions, scheduled, sessions, profile, benchmarks, activities, observations, foods, foodLog, savedMeals, recovery, episodes, symptomLogs, clinical, dirty } = s;
  return { ownerUserId, workouts, versions, scheduled, sessions, profile, benchmarks, activities, observations, foods, foodLog, savedMeals, recovery, episodes, symptomLogs, clinical, dirty };
}

export const useWorkoutsStore = create<WorkoutsState>()(
  persist(
    (set, get) => ({
      ...EMPTY_DATA,

      createWorkout: (content, opts) => {
        const { data, ...ids } = state.createWorkout(pickData(get()), content, { ...opts, nowMs: Date.now() });
        set(data);
        return ids;
      },
      scheduleWorkout: (workoutId, scheduledAt) => {
        const { data, scheduledId } = state.scheduleWorkout(pickData(get()), workoutId, scheduledAt, Date.now());
        set(data);
        return scheduledId;
      },
      addFromCoach: (content, scheduledAt) => {
        const res = state.createWorkout(pickData(get()), withFreshIds(content, newUuid), { source: 'coach', scheduledAt, nowMs: Date.now() });
        set(res.data);
        return res.scheduledId as string;
      },
      addFromRehabPlan: (content, scheduledAt) => {
        const res = state.createWorkout(pickData(get()), withFreshIds(content, newUuid), { source: 'rehab', scheduledAt, nowMs: Date.now() });
        set(res.data);
        return res.scheduledId as string;
      },
      applyAdaptation: (scheduledId, content) => set(state.applyAdaptation(pickData(get()), scheduledId, content, Date.now())),
      setTemplate: (workoutId, isTemplate) => set(state.setTemplate(pickData(get()), workoutId, isTemplate, Date.now())),
      removeScheduled: (scheduledId) => set(state.removeScheduled(pickData(get()), scheduledId, Date.now())),
      moveScheduled: (scheduledId, scheduledAt) => set(state.moveScheduled(pickData(get()), scheduledId, scheduledAt, Date.now())),
      startSession: (scheduledId, entryMode) => {
        const res = state.startSession(pickData(get()), scheduledId, entryMode, Date.now());
        if ('error' in res) return res;
        set(res.data);
        return { sessionId: res.sessionId };
      },
      patchSession: (sessionId, patch) => set(state.patchSession(pickData(get()), sessionId, patch, Date.now())),
      putBlockResult: (sessionId, result) => set(state.putBlockResult(pickData(get()), sessionId, result, Date.now())),
      completeSession: (sessionId, extras) => set(state.completeSession(pickData(get()), sessionId, extras, Date.now())),
      discardSession: (sessionId) => set(state.discardSession(pickData(get()), sessionId)),

      updateProfile: (patch) => set(state.updateProfile(pickData(get()), patch, Date.now())),
      addBenchmark: (input) => {
        const { data, benchmarkId } = state.addBenchmark(pickData(get()), input, Date.now());
        set(data);
        return benchmarkId;
      },
      removeBenchmark: (benchmarkId) => set(state.removeBenchmark(pickData(get()), benchmarkId, Date.now())),
      importActivity: (parsed) => {
        const { data, ...res } = health.importActivity(pickData(get()), parsed, Date.now());
        set(data);
        return res;
      },
      setActivityStatus: (activityId, status, duplicateOfId) => set(health.setActivityStatus(pickData(get()), activityId, status, Date.now(), duplicateOfId)),
      linkActivity: (activityId, scheduledId) => set(health.linkActivity(pickData(get()), activityId, scheduledId, Date.now())),
      logActivityAsWorkout: (activityId) => set(health.logActivityAsWorkout(pickData(get()), activityId, Date.now())),
      removeActivity: (activityId) => set(health.removeActivity(pickData(get()), activityId, Date.now())),
      addObservation: (input) => {
        const { data, observationId } = health.addObservation(pickData(get()), input, Date.now());
        set(data);
        return observationId;
      },
      removeObservation: (observationId) => set(health.removeObservation(pickData(get()), observationId, Date.now())),
      removeSource: (provider) => set(health.removeSource(pickData(get()), provider, Date.now())),
      addFood: (input) => applying(set, nutrition.addFood(pickData(get()), input, Date.now())),
      removeFood: (foodId) => set(nutrition.removeFood(pickData(get()), foodId, Date.now())),
      logFood: (food, quantity, ctx) => applying(set, nutrition.logFood(pickData(get()), food, quantity, ctx, Date.now())),
      logQuickAdd: (input, ctx) => applying(set, nutrition.logQuickAdd(pickData(get()), input, ctx, Date.now())),
      updateEntry: (entryId, patch) => applying(set, nutrition.updateEntry(pickData(get()), entryId, patch, Date.now())),
      removeEntry: (entryId) => set(nutrition.removeEntry(pickData(get()), entryId, Date.now())),
      saveMeal: (name, entryIds) => applying(set, nutrition.saveMeal(pickData(get()), name, entryIds, Date.now())),
      logSavedMeal: (mealId, ctx) => applying(set, nutrition.logSavedMeal(pickData(get()), mealId, ctx, Date.now())),
      removeSavedMeal: (mealId) => set(nutrition.removeSavedMeal(pickData(get()), mealId, Date.now())),
      saveCheckIn: (checkIn) => set(recovery.saveCheckIn(pickData(get()), checkIn, Date.now())),
      recordRecoveryDay: (insight) => set(recovery.recordDay(pickData(get()), insight, Date.now())),
      chooseRecoveryOption: (insight, option) => set(recovery.chooseOption(pickData(get()), insight, option, Date.now())),
      addEpisode: (input) => {
        const res = rehab.addEpisode(pickData(get()), input, Date.now());
        if (!res.ok) return res;
        set(res.data);
        return { ok: true, episodeId: res.episodeId };
      },
      updateEpisode: (episodeId, patch) => {
        const res = rehab.updateEpisode(pickData(get()), episodeId, patch, Date.now());
        if (!res.ok) return res;
        set(res.data);
        return { ok: true };
      },
      removeEpisode: (episodeId) => set(rehab.removeEpisode(pickData(get()), episodeId, Date.now())),
      addSymptomLog: (episodeId, input) => {
        const res = rehab.addSymptomLog(pickData(get()), episodeId, input, Date.now());
        if (!res.ok) return res;
        set(res.data);
        return { ok: true, logId: res.logId };
      },
      removeSymptomLog: (logId) => set(rehab.removeSymptomLog(pickData(get()), logId, Date.now())),
      wipe: () => set(state.wipe()),

      attachToUser: (userId) => set(state.attachToUser(pickData(get()), userId)),
      clearDirty: (done) => set(state.clearDirty(pickData(get()), done)),
      mergeRemote: (remote) => set(state.mergeRemote(pickData(get()), remote)),
    }),
    {
      name: 'form-workouts-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: state.STORE_VERSION,
      migrate: (persisted, version) => {
        let data = persisted as unknown;
        if (version < 2) data = state.migrateLegacy(data as Parameters<typeof state.migrateLegacy>[0], Date.now());
        // migrateLegacy already produces the current shape; only a genuine v2 payload needs upgrading.
        else if (version < 3) data = state.upgradeV2(data as Parameters<typeof state.upgradeV2>[0]);
        // v4 added activities and measurements, v5 nutrition, v6 recovery; every older payload gets the missing collections.
        return state.withCurrentShape(data as Partial<WorkoutData>);
      },
      partialize: (s): WorkoutData => pickData(s),
    }
  )
);

/** The plain data slice, for code outside React (sync, export). */
export function getWorkoutData(): WorkoutData {
  return pickData(useWorkoutsStore.getState());
}
