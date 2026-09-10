import { create } from 'zustand';
import type { Workout } from './types';

type WorkoutsState = {
  workouts: Workout[];
  addWorkout: (workout: Workout) => void;
  removeWorkout: (id: string) => void;
};

export const useWorkoutsStore = create<WorkoutsState>((set) => ({
  workouts: [],
  addWorkout: (workout) => set((s) => ({ workouts: [workout, ...s.workouts] })),
  removeWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),
}));
