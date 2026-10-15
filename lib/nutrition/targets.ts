import { tr } from '../i18n/tr';
import type { HealthObservation } from '../health/model';
import type { Block, ScheduledWorkout, WorkoutContent, WorkoutVersion } from '../workout/model';
import { exerciseSteps } from '../workout/model';
import type { DayType, NutritionTargets, Range } from './model';

/**
 * Training-aware targets as ranges. These are FORM's fixed rules, taken from
 * published guidance for healthy exercising adults, not individual advice:
 *
 * - Carbohydrate by training load (Thomas, Erdman & Burke, ACSM/AND/DC joint
 *   position statement, 2016): light 3-5, moderate (about an hour a day)
 *   5-7, high (1-3 h a day) 6-10, very high (4 h and more) 8-12 g per kg
 *   body weight per day.
 * - Protein 1.2-2.0 g per kg per day (same statement).
 *
 * No energy, fat or fluid target is suggested: those depend on too much the
 * app does not know. The athlete can still set them by hand.
 */
export const TARGET_RULES = {
  version: 'targets_v1',
  reference: 'ACSM / Academy of Nutrition and Dietetics / Dietitians of Canada joint position statement on nutrition and athletic performance (2016)',
  proteinPerKg: { min: 1.2, max: 2.0 },
  carbohydratePerKg: {
    rest_or_light: { min: 3, max: 5 },
    moderate: { min: 5, max: 7 },
    high: { min: 6, max: 10 },
    very_high: { min: 8, max: 12 },
  } as Record<DayType, { min: number; max: number }>,
  /** A weight older than this is too stale to compute from. */
  maxWeightAgeDays: 60,
} as const;

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  rest_or_light: tr('Rest or light day', 'Ruhetag oder leichter Tag'),
  moderate: tr('Moderate training day', 'Mittlerer Trainingstag'),
  high: tr('Hard training day', 'Harter Trainingstag'),
  very_high: tr('Very long training day', 'Sehr langer Trainingstag'),
};

export function dayTypeFor(plannedMinutes: number): DayType {
  if (plannedMinutes >= 240) return 'very_high';
  if (plannedMinutes >= 90) return 'high';
  if (plannedMinutes >= 45) return 'moderate';
  return 'rest_or_light';
}

function blockSeconds(block: Block): number | undefined {
  const c = block.config;
  switch (c.format) {
    case 'continuous':
      return c.durationSeconds;
    case 'amrap':
      return c.durationSeconds;
    case 'repeating_interval':
      return c.intervalSeconds && c.rounds ? c.intervalSeconds * c.rounds : undefined;
    case 'for_time':
      return c.timeCapSeconds;
    default:
      return exerciseSteps(block.steps).length === 0 ? 0 : undefined;
  }
}

/**
 * A planned workout's duration from the blocks that state one. Blocks
 * without a stated length (sets and reps, uncapped for-time) are not guessed;
 * when none states a length the athlete's usual session length is used.
 */
export function plannedMinutes(content: WorkoutContent, usualMinutes?: number): { minutes: number; estimated: boolean } {
  const parts = content.blocks.map(blockSeconds);
  const known = parts.filter((p): p is number => p !== undefined);
  if (known.length === parts.length) return { minutes: Math.round(known.reduce((s, p) => s + p, 0) / 60), estimated: false };
  if (known.some((p) => p > 0)) return { minutes: Math.round(known.reduce((s, p) => s + p, 0) / 60), estimated: true };
  return { minutes: usualMinutes ?? 60, estimated: true };
}

/** The day's planned training load: every workout on that local day that was not skipped or removed. */
export function trainingDay(
  localDate: string,
  scheduled: ScheduledWorkout[],
  versions: Record<string, WorkoutVersion>,
  usualMinutes?: number
): { dayType: DayType; minutes: number; workouts: number; estimated: boolean } {
  const local = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const today = scheduled.filter((s) => !s.deletedAt && s.status !== 'skipped' && local(s.scheduledAt) === localDate && versions[s.versionId]);
  let minutes = 0;
  let estimated = false;
  for (const s of today) {
    const m = plannedMinutes(versions[s.versionId].content, usualMinutes);
    minutes += m.minutes;
    estimated ||= m.estimated;
  }
  return { dayType: dayTypeFor(minutes), minutes, workouts: today.length, estimated };
}

/** The most recent weight within the allowed age, or undefined. */
export function recentWeight(observations: HealthObservation[], nowMs: number): HealthObservation | undefined {
  const cutoff = nowMs - TARGET_RULES.maxWeightAgeDays * 86_400_000;
  return observations
    .filter((o) => !o.deletedAt && o.metric === 'weight_kg' && o.observedAt >= cutoff)
    .reduce<HealthObservation | undefined>((a, o) => (!a || o.observedAt > a.observedAt ? o : a), undefined);
}

const round5 = (n: number) => Math.round(n / 5) * 5;
const scale = (r: { min: number; max: number }, kg: number): Range => ({ min: round5(r.min * kg), max: round5(r.max * kg) });

export type TargetSuggestion =
  | { ok: true; targets: NutritionTargets; weight: HealthObservation }
  | { ok: false; reason: 'no_recent_weight' };

/** A proposal only: nothing is saved until the athlete approves it. */
export function suggestTargets(observations: HealthObservation[], nowMs: number): TargetSuggestion {
  const weight = recentWeight(observations, nowMs);
  if (!weight) return { ok: false, reason: 'no_recent_weight' };
  const kg = weight.value;
  const carbohydrateByDayType = Object.fromEntries(
    (Object.keys(TARGET_RULES.carbohydratePerKg) as DayType[]).map((t) => [t, scale(TARGET_RULES.carbohydratePerKg[t], kg)])
  ) as Record<DayType, Range>;
  return {
    ok: true,
    weight,
    targets: {
      protein_g: scale(TARGET_RULES.proteinPerKg, kg),
      carbohydrateByDayType,
      source: 'suggested',
      ruleVersion: TARGET_RULES.version,
      weightKg: kg,
      approvedAt: 0,
    },
  };
}

/** The ranges that apply on a day of the given type. */
export function targetsForDay(targets: NutritionTargets | undefined, dayType: DayType): Partial<Record<'energy_kcal' | 'protein_g' | 'carbohydrate_g' | 'fat_g' | 'fluid_ml', Range>> {
  if (!targets) return {};
  const { energy_kcal, protein_g, carbohydrate_g, fat_g, fluid_ml, carbohydrateByDayType } = targets;
  return { energy_kcal, protein_g, carbohydrate_g: carbohydrateByDayType ? carbohydrateByDayType[dayType] : carbohydrate_g, fat_g, fluid_ml };
}

export type TargetIssue = { field: string; message: string; severity: 'error' | 'warning' };

/**
 * Checks targets the athlete types in. Inverted ranges are errors. A very low
 * energy target is not refused, since the athlete may have a professional's
 * plan, but it is called out: sustained low energy availability harms health
 * and performance.
 */
export function checkTargets(t: Omit<NutritionTargets, 'source' | 'approvedAt'>): TargetIssue[] {
  const issues: TargetIssue[] = [];
  for (const key of ['energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fluid_ml'] as const) {
    const r = t[key];
    if (!r) continue;
    if ((r.min !== undefined && r.min < 0) || (r.max !== undefined && r.max < 0)) issues.push({ field: key, message: tr('Targets cannot be negative.', 'Ziele können nicht negativ sein.'), severity: 'error' });
    if (r.min !== undefined && r.max !== undefined && r.min > r.max) issues.push({ field: key, message: tr('The lower end is above the upper end.', 'Der untere Wert liegt über dem oberen.'), severity: 'error' });
  }
  const energy = t.energy_kcal;
  const lowest = energy?.max ?? energy?.min;
  if (lowest !== undefined && lowest < 1500) {
    issues.push({
      field: 'energy_kcal',
      message:
        tr('This is a very low energy target for someone who trains. Eating too little for your training can harm your health and performance. If you want to lose weight or have a medical reason, please work out targets with a doctor or registered dietitian.', 'Das ist ein sehr niedriges Energieziel für jemanden, der trainiert. Zu wenig zu essen kann deiner Gesundheit und Leistung schaden. Wenn du abnehmen möchtest oder einen medizinischen Grund hast, lege Ziele bitte mit einer Ärztin, einem Arzt oder einer Ernährungsfachkraft fest.'),
      severity: 'warning',
    });
  }
  return issues;
}
