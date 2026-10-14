import type { Benchmark, Profile } from '../athlete/model';
import type { ExternalActivity, HealthObservation } from '../health/model';
import type { Food, FoodLogEntry, NutritionTargets, SavedMeal } from '../nutrition/model';
import type { Goal } from '../goals/model';
import type { RecoveryDay } from '../recovery/model';
import type { ActivityTag, CaseNote, ClinicalRecords, InjuryEpisode, Issuer, RehabPlan, Restriction, RtsDecision, SymptomLog } from '../rehab/model';
import type {
  Block,
  BlockConfig,
  BlockResult,
  ScheduledWorkout,
  Score,
  Session,
  Step,
  StepResult,
  Workout,
  WorkoutContent,
  WorkoutVersion,
} from '../workout/model';

/**
 * Translation between the app's model and the database rows defined in
 * supabase/migrations/0002_workout_core.sql. Pure, so the contract with the
 * SQL functions can be tested without a Supabase project.
 */

const iso = (ms: number) => new Date(ms).toISOString();
const isoOrNull = (ms: number | undefined) => (ms === undefined ? null : iso(ms));
const ms = (value: string) => new Date(value).getTime();
const msOrUndefined = (value: string | null | undefined) => (value ? ms(value) : undefined);
const numOrUndefined = (value: number | string | null | undefined) =>
  value === null || value === undefined ? undefined : Number(value);

// ------------------------------------------------------------ outgoing

export function versionToPayload(workout: Workout, version: WorkoutVersion) {
  return {
    workout: {
      id: workout.id,
      isTemplate: workout.isTemplate,
      source: workout.source,
      createdAt: iso(workout.createdAt),
      updatedAt: iso(workout.updatedAt),
    },
    version: {
      id: version.id,
      version: version.version,
      status: version.status,
      createdAt: iso(version.createdAt),
      content: version.content,
    },
  };
}

export function workoutFlagsToRow(workout: Workout) {
  return {
    is_template: workout.isTemplate,
    updated_at: iso(workout.updatedAt),
    deleted_at: isoOrNull(workout.deletedAt),
  };
}

export function scheduledToRow(entry: ScheduledWorkout, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    workout_id: entry.workoutId,
    version_id: entry.versionId,
    scheduled_at: iso(entry.scheduledAt),
    status: entry.status,
    session_id: entry.sessionId ?? null,
    created_at: iso(entry.createdAt),
    updated_at: iso(entry.updatedAt),
    deleted_at: isoOrNull(entry.deletedAt),
  };
}

export function sessionToPayload(session: Session) {
  return {
    id: session.id,
    workoutId: session.workoutId,
    versionId: session.versionId,
    scheduledWorkoutId: session.scheduledWorkoutId ?? null,
    prescribed: session.prescribed,
    status: session.status,
    entryMode: session.entryMode,
    startedAt: iso(session.startedAt),
    endedAt: isoOrNull(session.endedAt),
    rpe: session.rpe ?? null,
    notes: session.notes ?? null,
    updatedAt: iso(session.updatedAt),
    deletedAt: isoOrNull(session.deletedAt),
    blockResults: session.blockResults,
  };
}

// ------------------------------------------------------------ incoming

export type WorkoutRow = {
  id: string;
  current_version_id: string | null;
  is_template: boolean;
  source: Workout['source'];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type StepRow = {
  id: string;
  parent_step_id: string | null;
  position: number;
  kind: Step['kind'];
  name: string | null;
  activity_id: string | null;
  prescription: Record<string, unknown> | null;
  rounds: number | null;
  duration_seconds: number | string | null;
  notes: string | null;
};

export type BlockRow = {
  id: string;
  position: number;
  type: Block['type'];
  format: BlockConfig['format'];
  label: string | null;
  config: Record<string, unknown> | null;
  notes: string | null;
  tags: string[] | null;
  steps: StepRow[];
};

export type VersionRow = {
  id: string;
  workout_id: string;
  version: number;
  status: WorkoutVersion['status'];
  title: string;
  sport: WorkoutContent['sport'];
  description: string | null;
  tags: string[] | null;
  equipment: string[] | null;
  created_at: string;
  blocks: BlockRow[];
};

export type ScheduledRow = {
  id: string;
  workout_id: string;
  version_id: string;
  scheduled_at: string;
  status: ScheduledWorkout['status'];
  session_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SessionResultRow = {
  block_id: string;
  step_id: string | null;
  set_index: number | null;
  status: BlockResult['status'] | null;
  elapsed_seconds: number | string | null;
  score: Score | null;
  reps: number | null;
  load_kg: number | string | null;
  duration_seconds: number | string | null;
  distance_m: number | string | null;
  calories: number | string | null;
  completed: boolean | null;
};

export type SessionRow = {
  id: string;
  workout_id: string;
  version_id: string;
  scheduled_workout_id: string | null;
  prescribed: WorkoutContent;
  status: Session['status'];
  entry_mode: Session['entryMode'];
  started_at: string;
  ended_at: string | null;
  rpe: number | string | null;
  notes: string | null;
  updated_at: string;
  deleted_at: string | null;
  session_results: SessionResultRow[];
};

export function rowToWorkout(row: WorkoutRow): Workout | undefined {
  // A workout with no version yet is mid-upload from another device; skip it until it is whole.
  if (!row.current_version_id) return undefined;
  return {
    id: row.id,
    currentVersionId: row.current_version_id,
    isTemplate: row.is_template,
    source: row.source,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    deletedAt: msOrUndefined(row.deleted_at),
  };
}

function prune<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) if (obj[key] === undefined || obj[key] === null) delete obj[key];
  return obj;
}

function buildSteps(rows: StepRow[], parentId: string | null): Step[] {
  return rows
    .filter((r) => r.parent_step_id === parentId)
    .sort((a, b) => a.position - b.position)
    .map((r): Step => {
      switch (r.kind) {
        case 'exercise':
          return prune({
            kind: 'exercise',
            id: r.id,
            name: r.name ?? '',
            activityId: r.activity_id,
            prescription: (r.prescription ?? {}) as Extract<Step, { kind: 'exercise' }>['prescription'],
            notes: r.notes ?? undefined,
          }) as Step;
        case 'rest':
          return prune({ kind: 'rest', id: r.id, durationSeconds: numOrUndefined(r.duration_seconds) }) as Step;
        case 'transition':
          return prune({
            kind: 'transition',
            id: r.id,
            name: r.name ?? undefined,
            durationSeconds: numOrUndefined(r.duration_seconds),
          }) as Step;
        case 'group':
          return prune({
            kind: 'group',
            id: r.id,
            label: r.name ?? undefined,
            rounds: r.rounds ?? undefined,
            steps: buildSteps(rows, r.id),
          }) as Step;
      }
    });
}

export function rowToVersion(row: VersionRow): WorkoutVersion {
  const blocks: Block[] = [...row.blocks]
    .sort((a, b) => a.position - b.position)
    .map((b) => {
      const block: Block = {
        id: b.id,
        type: b.type,
        config: { ...(b.config ?? {}), format: b.format } as BlockConfig,
        steps: buildSteps(b.steps, null).map((s) => restoreActivityNull(s)),
      };
      if (b.label) block.label = b.label;
      if (b.notes) block.notes = b.notes;
      if (b.tags && b.tags.length) block.tags = b.tags;
      return block;
    });

  const content: WorkoutContent = { title: row.title, sport: row.sport, blocks };
  if (row.description) content.description = row.description;
  if (row.tags && row.tags.length) content.tags = row.tags;
  if (row.equipment && row.equipment.length) content.equipment = row.equipment;

  return {
    id: row.id,
    workoutId: row.workout_id,
    version: row.version,
    status: row.status,
    content,
    createdAt: ms(row.created_at),
  };
}

/** `activityId: null` means "not in the catalog" and must survive the round trip, unlike other nulls. */
function restoreActivityNull(step: Step): Step {
  if (step.kind === 'exercise' && step.activityId === undefined) return { ...step, activityId: null };
  if (step.kind === 'group') return { ...step, steps: step.steps.map(restoreActivityNull) };
  return step;
}

export function rowToScheduled(row: ScheduledRow): ScheduledWorkout {
  return prune({
    id: row.id,
    workoutId: row.workout_id,
    versionId: row.version_id,
    scheduledAt: ms(row.scheduled_at),
    status: row.status,
    sessionId: row.session_id ?? undefined,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    deletedAt: msOrUndefined(row.deleted_at),
  }) as ScheduledWorkout;
}

export function rowToSession(row: SessionRow): Session {
  const blockOrder = row.prescribed.blocks.map((b) => b.id);
  const byBlock = new Map<string, BlockResult>();

  for (const r of row.session_results.filter((x) => x.step_id === null)) {
    byBlock.set(
      r.block_id,
      prune({
        blockId: r.block_id,
        status: r.status ?? 'completed',
        elapsedSeconds: numOrUndefined(r.elapsed_seconds),
        score: r.score ?? undefined,
        stepResults: [] as StepResult[],
      }) as BlockResult
    );
  }
  for (const r of row.session_results.filter((x) => x.step_id !== null)) {
    const block = byBlock.get(r.block_id);
    if (!block) continue;
    block.stepResults.push(
      prune({
        stepId: r.step_id as string,
        setIndex: r.set_index ?? undefined,
        reps: r.reps ?? undefined,
        loadKg: numOrUndefined(r.load_kg),
        durationSeconds: numOrUndefined(r.duration_seconds),
        distanceMeters: numOrUndefined(r.distance_m),
        calories: numOrUndefined(r.calories),
        completed: r.completed ?? false,
      }) as StepResult
    );
  }

  const stepOrder = new Map<string, number>();
  let n = 0;
  const index = (steps: Step[]) => {
    for (const s of steps) {
      stepOrder.set(s.id, n++);
      if (s.kind === 'group') index(s.steps);
    }
  };
  row.prescribed.blocks.forEach((b) => index(b.steps));
  for (const block of byBlock.values()) {
    block.stepResults.sort(
      (a, b) => (stepOrder.get(a.stepId) ?? 0) - (stepOrder.get(b.stepId) ?? 0) || (a.setIndex ?? 0) - (b.setIndex ?? 0)
    );
  }

  return prune({
    id: row.id,
    workoutId: row.workout_id,
    versionId: row.version_id,
    scheduledWorkoutId: row.scheduled_workout_id ?? undefined,
    prescribed: row.prescribed,
    status: row.status,
    entryMode: row.entry_mode,
    startedAt: ms(row.started_at),
    endedAt: msOrUndefined(row.ended_at),
    blockResults: [...byBlock.values()].sort((a, b) => blockOrder.indexOf(a.blockId) - blockOrder.indexOf(b.blockId)),
    rpe: numOrUndefined(row.rpe),
    notes: row.notes ?? undefined,
    updatedAt: ms(row.updated_at),
    deletedAt: msOrUndefined(row.deleted_at),
  }) as Session;
}

// ------------------------------------------------ profile and benchmarks

export type ProfileRow = {
  user_id: string;
  display_name: string | null;
  sports: Profile['sports'] | null;
  equipment: string[] | null;
  available_days: number[] | null;
  minutes_per_session: number | null;
  weekly_session_target: number;
  hide_energy?: boolean;
  nutrition_targets?: NutritionTargets | null;
  updated_at: string;
};

export function profileToRow(profile: Profile, userId: string): ProfileRow {
  return {
    user_id: userId,
    display_name: profile.displayName?.trim() || null,
    sports: profile.sports,
    equipment: profile.equipment,
    available_days: profile.availableDays,
    minutes_per_session: profile.minutesPerSession ?? null,
    weekly_session_target: profile.weeklySessionTarget,
    hide_energy: profile.hideEnergy ?? false,
    nutrition_targets: profile.nutritionTargets ?? null,
    updated_at: iso(profile.updatedAt),
  };
}

export function rowToProfile(row: Omit<ProfileRow, 'user_id'>): Profile {
  return prune({
    displayName: row.display_name ?? undefined,
    sports: row.sports ?? [],
    equipment: row.equipment ?? [],
    availableDays: row.available_days ?? [],
    minutesPerSession: row.minutes_per_session ?? undefined,
    weeklySessionTarget: row.weekly_session_target,
    hideEnergy: row.hide_energy || undefined,
    nutritionTargets: row.nutrition_targets ?? undefined,
    updatedAt: ms(row.updated_at),
  }) as Profile;
}

export type BenchmarkRow = {
  id: string;
  user_id?: string;
  kind: Benchmark['kind'];
  activity_id: string | null;
  value: number | string;
  unit: Benchmark['unit'];
  measured_on: string;
  source: Benchmark['source'];
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function benchmarkToRow(b: Benchmark, userId: string): BenchmarkRow {
  return {
    id: b.id,
    user_id: userId,
    kind: b.kind,
    activity_id: b.activityId ?? null,
    value: b.value,
    unit: b.unit,
    measured_on: b.measuredOn,
    source: b.source,
    notes: b.notes ?? null,
    created_at: iso(b.createdAt),
    updated_at: iso(b.updatedAt),
    deleted_at: isoOrNull(b.deletedAt),
  };
}

export function rowToBenchmark(row: BenchmarkRow): Benchmark {
  return prune({
    id: row.id,
    kind: row.kind,
    activityId: row.activity_id ?? undefined,
    value: Number(row.value),
    unit: row.unit,
    // A date column can come back as a full timestamp; only the calendar day is meant.
    measuredOn: String(row.measured_on).slice(0, 10),
    source: row.source,
    notes: row.notes ?? undefined,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    deletedAt: msOrUndefined(row.deleted_at),
  }) as Benchmark;
}

// ----------------------------------------------- activities and measurements

export type ActivityRow = {
  id: string;
  user_id?: string;
  provider: ExternalActivity['provider'];
  external_id: string;
  source: Partial<ExternalActivity['source']>;
  sport: ExternalActivity['sport'];
  name: string | null;
  started_at: string;
  ended_at: string;
  elapsed_seconds: number | string;
  moving_seconds: number | string | null;
  distance_m: number | string | null;
  elevation_gain_m: number | string | null;
  avg_heart_rate: number | string | null;
  max_heart_rate: number | string | null;
  avg_power_w: number | string | null;
  avg_cadence: number | string | null;
  calories_estimate: number | string | null;
  quality: ExternalActivity['quality'] | null;
  series: ExternalActivity['series'] | null;
  status: ExternalActivity['status'];
  session_id: string | null;
  duplicate_of_id: string | null;
  ingested_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function activityToRow(a: ExternalActivity, userId: string): ActivityRow {
  return {
    id: a.id,
    user_id: userId,
    provider: a.provider,
    external_id: a.externalId,
    source: a.source,
    sport: a.sport,
    name: a.name ?? null,
    started_at: iso(a.startedAt),
    ended_at: iso(a.endedAt),
    elapsed_seconds: a.elapsedSeconds,
    moving_seconds: a.movingSeconds ?? null,
    distance_m: a.distanceMeters ?? null,
    elevation_gain_m: a.elevationGainMeters ?? null,
    avg_heart_rate: a.avgHeartRate ?? null,
    max_heart_rate: a.maxHeartRate ?? null,
    avg_power_w: a.avgPowerWatts ?? null,
    avg_cadence: a.avgCadence ?? null,
    calories_estimate: a.caloriesEstimate ?? null,
    quality: a.quality,
    series: a.series ?? null,
    status: a.status,
    session_id: a.sessionId ?? null,
    duplicate_of_id: a.duplicateOfId ?? null,
    ingested_at: iso(a.ingestedAt),
    updated_at: iso(a.updatedAt),
    deleted_at: isoOrNull(a.deletedAt),
  };
}

export function rowToActivity(row: ActivityRow): ExternalActivity {
  return prune({
    id: row.id,
    provider: row.provider,
    externalId: row.external_id,
    source: row.source as ExternalActivity['source'],
    sport: row.sport,
    name: row.name ?? undefined,
    startedAt: ms(row.started_at),
    endedAt: ms(row.ended_at),
    elapsedSeconds: Number(row.elapsed_seconds),
    movingSeconds: numOrUndefined(row.moving_seconds),
    distanceMeters: numOrUndefined(row.distance_m),
    elevationGainMeters: numOrUndefined(row.elevation_gain_m),
    avgHeartRate: numOrUndefined(row.avg_heart_rate),
    maxHeartRate: numOrUndefined(row.max_heart_rate),
    avgPowerWatts: numOrUndefined(row.avg_power_w),
    avgCadence: numOrUndefined(row.avg_cadence),
    caloriesEstimate: numOrUndefined(row.calories_estimate),
    quality: row.quality ?? [],
    series: row.series ?? undefined,
    status: row.status,
    sessionId: row.session_id ?? undefined,
    duplicateOfId: row.duplicate_of_id ?? undefined,
    ingestedAt: ms(row.ingested_at),
    updatedAt: ms(row.updated_at),
    deletedAt: msOrUndefined(row.deleted_at),
  }) as ExternalActivity;
}

export type ObservationRow = {
  id: string;
  user_id?: string;
  metric: HealthObservation['metric'];
  value: number | string | null;
  unit: string;
  observed_at: string;
  local_date: string;
  ingested_at: string;
  provider: HealthObservation['provider'];
  external_id: string | null;
  device: string | null;
  origin: HealthObservation['origin'];
  method: string | null;
  updated_at: string;
  deleted_at: string | null;
};

export function observationToRow(o: HealthObservation, userId: string): ObservationRow {
  return {
    id: o.id,
    user_id: userId,
    metric: o.metric,
    value: o.value,
    unit: o.unit,
    observed_at: iso(o.observedAt),
    local_date: o.localDate,
    ingested_at: iso(o.ingestedAt),
    provider: o.provider,
    external_id: o.externalId ?? null,
    device: o.device ?? null,
    origin: o.origin,
    method: o.method ?? null,
    updated_at: iso(o.updatedAt),
    deleted_at: isoOrNull(o.deletedAt),
  };
}

export function rowToObservation(row: ObservationRow): HealthObservation {
  return prune({
    id: row.id,
    metric: row.metric,
    // A deleted row has had its value erased on the server.
    value: Number(row.value ?? 0),
    unit: row.unit,
    observedAt: ms(row.observed_at),
    localDate: String(row.local_date).slice(0, 10),
    ingestedAt: ms(row.ingested_at),
    provider: row.provider,
    externalId: row.external_id ?? undefined,
    device: row.device ?? undefined,
    origin: row.origin,
    method: row.method ?? undefined,
    updatedAt: ms(row.updated_at),
    deletedAt: msOrUndefined(row.deleted_at),
  }) as HealthObservation;
}

// ------------------------------------------------------------- nutrition

export type FoodRow = {
  id: string;
  user_id?: string;
  name: string;
  brand: string | null;
  basis: Food['basis'];
  nutrients: Food['nutrients'];
  servings: Food['servings'];
  density_g_per_ml: number | string | null;
  is_fluid: boolean;
  source_note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function foodToRow(f: Food, userId: string): FoodRow {
  return {
    id: f.id,
    user_id: userId,
    name: f.name,
    brand: f.brand ?? null,
    basis: f.basis,
    nutrients: f.nutrients,
    servings: f.servings,
    density_g_per_ml: f.densityGPerMl ?? null,
    is_fluid: f.isFluid ?? false,
    source_note: f.sourceNote ?? null,
    created_at: iso(f.createdAt),
    updated_at: iso(f.updatedAt),
    deleted_at: isoOrNull(f.deletedAt),
  };
}

export function rowToFood(row: FoodRow): Food {
  return prune({
    id: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    basis: row.basis,
    nutrients: row.nutrients ?? {},
    servings: row.servings ?? [],
    densityGPerMl: numOrUndefined(row.density_g_per_ml),
    isFluid: row.is_fluid || undefined,
    source: 'user',
    sourceNote: row.source_note ?? undefined,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    deletedAt: msOrUndefined(row.deleted_at),
  }) as Food;
}

export type FoodLogRow = {
  id: string;
  user_id?: string;
  consumed_at: string;
  local_date: string;
  meal_type: FoodLogEntry['mealType'];
  food: FoodLogEntry['food'] | null;
  quantity: FoodLogEntry['quantity'] | null;
  label: string | null;
  nutrients: FoodLogEntry['nutrients'];
  fluid_ml: number | string | null;
  session_id: string | null;
  entry_method: FoodLogEntry['entryMethod'];
  estimated: boolean;
  note: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function foodLogToRow(e: FoodLogEntry, userId: string): FoodLogRow {
  return {
    id: e.id,
    user_id: userId,
    consumed_at: iso(e.consumedAt),
    local_date: e.localDate,
    meal_type: e.mealType,
    food: e.food ?? null,
    quantity: e.quantity ?? null,
    label: e.label ?? null,
    nutrients: e.nutrients,
    fluid_ml: e.fluidMl ?? null,
    session_id: e.sessionId ?? null,
    entry_method: e.entryMethod,
    estimated: e.estimated,
    note: e.note ?? null,
    revision: e.revision,
    created_at: iso(e.createdAt),
    updated_at: iso(e.updatedAt),
    deleted_at: isoOrNull(e.deletedAt),
  };
}

export function rowToFoodLog(row: FoodLogRow): FoodLogEntry {
  return prune({
    id: row.id,
    consumedAt: ms(row.consumed_at),
    localDate: String(row.local_date).slice(0, 10),
    mealType: row.meal_type,
    food: row.food ?? undefined,
    quantity: row.quantity ?? undefined,
    label: row.label ?? undefined,
    nutrients: row.nutrients ?? {},
    fluidMl: numOrUndefined(row.fluid_ml),
    sessionId: row.session_id ?? undefined,
    entryMethod: row.entry_method,
    estimated: row.estimated,
    note: row.note ?? undefined,
    revision: row.revision,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    deletedAt: msOrUndefined(row.deleted_at),
  }) as FoodLogEntry;
}

export type SavedMealRow = {
  id: string;
  user_id?: string;
  name: string;
  items: SavedMeal['items'];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function savedMealToRow(m: SavedMeal, userId: string): SavedMealRow {
  return { id: m.id, user_id: userId, name: m.name, items: m.items, created_at: iso(m.createdAt), updated_at: iso(m.updatedAt), deleted_at: isoOrNull(m.deletedAt) };
}

export function rowToSavedMeal(row: SavedMealRow): SavedMeal {
  return prune({ id: row.id, name: row.name, items: row.items ?? [], createdAt: ms(row.created_at), updatedAt: ms(row.updated_at), deletedAt: msOrUndefined(row.deleted_at) }) as SavedMeal;
}

// --------------------------------------------------------------- recovery

export type RecoveryRow = {
  id: string;
  user_id?: string;
  local_date: string;
  status: RecoveryDay['status'];
  signals: RecoveryDay['signals'];
  rule_version: string;
  decision: RecoveryDay['decision'] | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function recoveryToRow(d: RecoveryDay, userId: string): RecoveryRow {
  return {
    id: d.id,
    user_id: userId,
    local_date: d.localDate,
    status: d.status,
    signals: d.signals,
    rule_version: d.ruleVersion,
    decision: d.decision ?? null,
    created_at: iso(d.createdAt),
    updated_at: iso(d.updatedAt),
    deleted_at: isoOrNull(d.deletedAt),
  };
}

export function rowToRecovery(row: RecoveryRow): RecoveryDay {
  return prune({
    id: row.id,
    localDate: String(row.local_date).slice(0, 10),
    status: row.status,
    signals: row.signals ?? [],
    ruleVersion: row.rule_version,
    decision: row.decision ?? undefined,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    deletedAt: msOrUndefined(row.deleted_at),
  }) as RecoveryDay;
}

// ------------------------------------------------------------------ rehab

export type EpisodeRow = {
  id: string;
  user_id?: string;
  body_region: InjuryEpisode['bodyRegion'];
  laterality: InjuryEpisode['laterality'];
  onset_date: string | null;
  onset_type: InjuryEpisode['onsetType'];
  reported_problem: string;
  affected_activities: ActivityTag[] | null;
  status: InjuryEpisode['status'];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function episodeToRow(e: InjuryEpisode, userId: string): EpisodeRow {
  return {
    id: e.id,
    user_id: userId,
    body_region: e.bodyRegion,
    laterality: e.laterality,
    onset_date: e.onsetDate ?? null,
    onset_type: e.onsetType,
    reported_problem: e.reportedProblem,
    affected_activities: e.affectedActivities,
    status: e.status,
    created_at: iso(e.createdAt),
    updated_at: iso(e.updatedAt),
    deleted_at: isoOrNull(e.deletedAt),
  };
}

export function rowToEpisode(row: EpisodeRow): InjuryEpisode {
  return prune({
    id: row.id,
    bodyRegion: row.body_region,
    laterality: row.laterality,
    onsetDate: row.onset_date ? String(row.onset_date).slice(0, 10) : undefined,
    onsetType: row.onset_type,
    reportedProblem: row.reported_problem,
    affectedActivities: row.affected_activities ?? [],
    status: row.status,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    deletedAt: msOrUndefined(row.deleted_at),
  }) as InjuryEpisode;
}

export type SymptomRow = {
  id: string;
  user_id?: string;
  episode_id: string;
  logged_at: string;
  local_date: string;
  intensity: number;
  function_score: number | null;
  context: string | null;
  red_flags: SymptomLog['redFlags'] | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function symptomToRow(s: SymptomLog, userId: string): SymptomRow {
  return {
    id: s.id,
    user_id: userId,
    episode_id: s.episodeId,
    logged_at: iso(s.loggedAt),
    local_date: s.localDate,
    intensity: s.intensity,
    function_score: s.function ?? null,
    context: s.context ?? null,
    red_flags: s.redFlags,
    note: s.note ?? null,
    created_at: iso(s.createdAt),
    updated_at: iso(s.updatedAt),
    deleted_at: isoOrNull(s.deletedAt),
  };
}

export function rowToSymptom(row: SymptomRow): SymptomLog {
  return prune({
    id: row.id,
    episodeId: row.episode_id,
    loggedAt: ms(row.logged_at),
    localDate: String(row.local_date).slice(0, 10),
    intensity: row.intensity,
    function: row.function_score ?? undefined,
    context: row.context ?? undefined,
    redFlags: row.red_flags ?? [],
    note: row.note ?? undefined,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    deletedAt: msOrUndefined(row.deleted_at),
  }) as SymptomLog;
}

type IssuerRow = { id: string; name: string | null; role: string; verified: boolean };
const issuer = (i: IssuerRow): Issuer => ({ id: i.id, name: i.name, role: i.role, verified: !!i.verified });

export type ClinicalJson = {
  restrictions: { id: string; episode_id: string; tags: ActivityTag[]; rule: Restriction['rule']; note: string | null; issuer: IssuerRow; effective_from: string; expires_on: string | null; status: Restriction['status']; lifted_at: string | null; created_at: string }[];
  plans: { id: string; episode_id: string; version: number; status: RehabPlan['status']; content: RehabPlan['content']; sessions_per_week: number | null; notes: string | null; author: IssuerRow; created_at: string }[];
  decisions: { id: string; episode_id: string; stage: RtsDecision['stage']; criteria: string; clinician: IssuerRow; decided_at: string }[];
  notes: { id: string; episode_id: string; body: string; author: IssuerRow; created_at: string }[];
};

/** The clinician records a case returns, in the app's shape. */
export function parseClinical(json: ClinicalJson, fetchedAt: number): ClinicalRecords {
  return {
    restrictions: (json.restrictions ?? []).map((r) =>
      prune({
        id: r.id,
        episodeId: r.episode_id,
        tags: r.tags ?? [],
        rule: r.rule,
        note: r.note ?? undefined,
        issuer: issuer(r.issuer),
        effectiveFrom: String(r.effective_from).slice(0, 10),
        expiresOn: r.expires_on ? String(r.expires_on).slice(0, 10) : undefined,
        status: r.status,
        liftedAt: msOrUndefined(r.lifted_at),
        createdAt: ms(r.created_at),
      }) as Restriction
    ),
    plans: (json.plans ?? []).map((p) =>
      prune({
        id: p.id,
        episodeId: p.episode_id,
        version: p.version,
        status: p.status,
        content: p.content,
        sessionsPerWeek: p.sessions_per_week ?? undefined,
        notes: p.notes ?? undefined,
        author: issuer(p.author),
        createdAt: ms(p.created_at),
      }) as RehabPlan
    ),
    decisions: (json.decisions ?? []).map((d) => ({ id: d.id, episodeId: d.episode_id, stage: d.stage, criteria: d.criteria, clinician: issuer(d.clinician), decidedAt: ms(d.decided_at) })),
    notes: (json.notes ?? []).map((n): CaseNote => ({ id: n.id, episodeId: n.episode_id, body: n.body, author: issuer(n.author), createdAt: ms(n.created_at) })),
    fetchedAt,
  };
}

// ------------------------------------------------------------------ goals

export type GoalRow = {
  id: string;
  user_id?: string;
  title: string;
  metric: Goal['metric'];
  target: number | string | null;
  target_date: string;
  baseline: Goal['baseline'] | null;
  milestones: Goal['milestones'];
  visibility: Goal['visibility'];
  status: Goal['status'];
  completed_on: string | null;
  revisions: Goal['revisions'];
  progress: Goal['progress'] | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function goalToRow(g: Goal, userId: string): GoalRow {
  return {
    id: g.id,
    user_id: userId,
    title: g.title,
    metric: g.metric,
    target: g.target ?? null,
    target_date: g.targetDate,
    baseline: g.baseline ?? null,
    milestones: g.milestones,
    visibility: g.visibility,
    status: g.status,
    completed_on: g.completedOn ?? null,
    revisions: g.revisions,
    progress: g.progress ?? null,
    created_at: iso(g.createdAt),
    updated_at: iso(g.updatedAt),
    deleted_at: isoOrNull(g.deletedAt),
  };
}

export function rowToGoal(row: GoalRow): Goal {
  return prune({
    id: row.id,
    title: row.title,
    metric: row.metric,
    target: numOrUndefined(row.target),
    targetDate: String(row.target_date).slice(0, 10),
    baseline: row.baseline ?? undefined,
    milestones: row.milestones ?? [],
    visibility: row.visibility,
    status: row.status,
    completedOn: row.completed_on ? String(row.completed_on).slice(0, 10) : undefined,
    revisions: row.revisions ?? [],
    progress: row.progress ?? undefined,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    deletedAt: msOrUndefined(row.deleted_at),
  }) as Goal;
}