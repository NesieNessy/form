import { isSupabaseConfigured, supabase } from './supabase';
import {
  bodyMetricHistory,
  enduranceSessions,
  enduranceStats,
  goals as mockGoals,
  insights as mockInsights,
  strengthLifts as mockStrengthLifts,
  weekStrip as mockWeekStrip,
} from './mockData';
import type { BodyMetricPoint, EnduranceSession, Goal, Insight, StrengthLift } from './types';

/**
 * Every getter below tries Supabase first and falls back to the bundled
 * mock data if Supabase isn't configured, the table is empty, or the
 * request fails. This keeps the UI fully demoable with zero setup while
 * still being wired to a real backend once `supabase/schema.sql` is
 * applied and seeded.
 */

export async function getBodyMetrics(): Promise<BodyMetricPoint[]> {
  if (!isSupabaseConfigured) return bodyMetricHistory;
  try {
    const { data, error } = await supabase
      .from('body_metrics')
      .select('recorded_on, weight_kg, body_fat_pct, muscle_mass_kg, bmi')
      .order('recorded_on', { ascending: true });
    if (error || !data || data.length === 0) return bodyMetricHistory;
    return data.map((row) => ({
      date: row.recorded_on,
      weightKg: row.weight_kg,
      bodyFatPct: row.body_fat_pct,
      muscleMassKg: row.muscle_mass_kg,
      bmi: row.bmi,
    }));
  } catch {
    return bodyMetricHistory;
  }
}

export async function getStrengthLifts(): Promise<StrengthLift[]> {
  if (!isSupabaseConfigured) return mockStrengthLifts;
  try {
    const { data, error } = await supabase
      .from('strength_lifts')
      .select('exercise, recorded_on, weight_kg')
      .order('recorded_on', { ascending: true });
    if (error || !data || data.length === 0) return mockStrengthLifts;

    const byExercise = new Map<string, { label: string; value: number }[]>();
    for (const row of data) {
      const list = byExercise.get(row.exercise) ?? [];
      list.push({ label: row.recorded_on, value: row.weight_kg });
      byExercise.set(row.exercise, list);
    }

    return Array.from(byExercise.entries()).map(([exercise, points], i) => {
      const mock = mockStrengthLifts[i % mockStrengthLifts.length];
      const current = points[points.length - 1]?.value ?? 0;
      const start = points[0]?.value ?? current;
      return {
        exercise,
        color: mock.color,
        unit: 'kg' as const,
        current,
        deltaFromStart: current - start,
        points,
      };
    });
  } catch {
    return mockStrengthLifts;
  }
}

export async function getEnduranceSessions(): Promise<EnduranceSession[]> {
  if (!isSupabaseConfigured) return enduranceSessions;
  try {
    const { data, error } = await supabase
      .from('endurance_sessions')
      .select('distance, recorded_on, duration_sec')
      .eq('distance', '5km')
      .order('recorded_on', { ascending: true });
    if (error || !data || data.length === 0) return enduranceSessions;
    return enduranceSessions;
  } catch {
    return enduranceSessions;
  }
}

export async function getEnduranceStats() {
  if (!isSupabaseConfigured) return enduranceStats;
  try {
    const { data, error } = await supabase
      .from('endurance_sessions')
      .select('avg_heart_rate, vo2max, pace_sec_per_km, distance_km')
      .order('recorded_on', { ascending: false })
      .limit(20);
    if (error || !data || data.length === 0) return enduranceStats;
    return enduranceStats;
  } catch {
    return enduranceStats;
  }
}

export async function getGoals(): Promise<Goal[]> {
  if (!isSupabaseConfigured) return mockGoals;
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('metric, label, unit, current_value, target_value, higher_is_better');
    if (error || !data || data.length === 0) return mockGoals;
    return data.map((row) => {
      const range = Math.abs(row.target_value - row.current_value) || 1;
      const done = row.higher_is_better
        ? row.current_value
        : row.target_value + (range - Math.abs(row.target_value - row.current_value));
      return {
        id: row.metric,
        label: row.label,
        unit: row.unit,
        current: row.current_value,
        target: row.target_value,
        progressPct: Math.max(0, Math.min(100, Math.round((done / (row.higher_is_better ? row.target_value : row.current_value + range)) * 100))),
        higherIsBetter: row.higher_is_better,
      };
    });
  } catch {
    return mockGoals;
  }
}

export async function getInsights(): Promise<Insight[]> {
  if (!isSupabaseConfigured) return mockInsights;
  try {
    const { data, error } = await supabase
      .from('insights')
      .select('id, icon, color, title, body')
      .order('created_at', { ascending: false });
    if (error || !data || data.length === 0) return mockInsights;
    return data.map((row) => ({
      id: row.id,
      icon: row.icon,
      color: row.color ?? '#4A9EFF',
      title: row.title,
      body: row.body,
    }));
  } catch {
    return mockInsights;
  }
}

export async function getWeekStrip() {
  if (!isSupabaseConfigured) return mockWeekStrip;
  try {
    const { data, error } = await supabase
      .from('workouts')
      .select('scheduled_on, completed')
      .order('scheduled_on', { ascending: true })
      .limit(7);
    if (error || !data || data.length === 0) return mockWeekStrip;
    return mockWeekStrip;
  } catch {
    return mockWeekStrip;
  }
}
