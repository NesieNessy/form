import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Workout } from './types';

type WorkoutsState = {
  workouts: Workout[];
  addWorkout: (workout: Workout) => void;
  updateWorkout: (id: string, patch: Partial<Workout>) => void;
  removeWorkout: (id: string) => void;
};

export const useWorkoutsStore = create<WorkoutsState>()(
  persist(
    (set) => ({
      workouts: [],
      addWorkout: (workout) => set((s) => ({ workouts: [workout, ...s.workouts] })),
      updateWorkout: (id, patch) =>
        set((s) => ({
          workouts: s.workouts.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w)),
        })),
      removeWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),
    }),
    {
      name: 'form-workouts-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);
