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
