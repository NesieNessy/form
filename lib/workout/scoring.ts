import { exerciseSteps, type Block, type BlockResult, type ExerciseStep, type Score, type Session, type StepResult } from './model';

export type ScoreKind = Score['type'];

/** How a block is scored follows from its format, not from the sport. */
export function scoreKindFor(block: Block): ScoreKind {
  switch (block.config.format) {
    case 'for_time':
      return 'time';
    case 'amrap':
      return 'rounds_reps';
    case 'sets_reps':
      return 'load';
    case 'continuous':
      // A block that is only a timed pause has nothing to measure.
      return exerciseSteps(block.steps).length > 0 ? 'distance' : 'completed';
    case 'repeating_interval':
    case 'sequence':
      return 'completed';
  }
}

/** One row per set for every exercise in a sets-and-reps block, pre-filled with the prescribed numbers. */
export function initialSetResults(block: Block, oneRepMaxKg: Record<string, number> = {}): StepResult[] {
  if (block.config.format !== 'sets_reps') return [];
  const sets = block.config.sets ?? 0;
  const rows: StepResult[] = [];
  for (const step of exerciseSteps(block.steps)) {
    const rx = step.prescription;
    const loadKg = prescribedLoadKg(step, oneRepMaxKg);
    for (let setIndex = 0; setIndex < sets; setIndex++) {
      rows.push({
        stepId: step.id,
        setIndex,
        reps: typeof rx.reps === 'number' ? rx.reps : undefined,
        loadKg,
        completed: false,
      });
    }
  }
  return rows;
}

/**
 * The load a step prescribes in kilograms. A percentage of 1RM resolves only
 * when the athlete has a recorded one-rep max for that lift; otherwise it
 * stays unknown rather than being estimated. Rounded to the nearest 0.5 kg.
 */
export function prescribedLoadKg(step: ExerciseStep, oneRepMaxKg: Record<string, number> = {}): number | undefined {
  const load = step.prescription.load;
  if (!load) return undefined;
  if (load.unit === 'kg') return load.value;
  const max = step.activityId ? oneRepMaxKg[step.activityId] : undefined;
  return max ? Math.round(((max * load.value) / 100) * 2) / 2 : undefined;
}

export function bestLoadKg(stepResults: StepResult[]): number | undefined {
  const loads = stepResults.filter((r) => r.completed && typeof r.loadKg === 'number' && r.loadKg > 0).map((r) => r.loadKg as number);
  return loads.length ? Math.max(...loads) : undefined;
}

/** Load x reps over completed sets. Sets missing either number contribute nothing rather than a guess. */
export function volumeKg(stepResults: StepResult[]): number {
  return stepResults.reduce(
    (sum, r) => (r.completed && typeof r.loadKg === 'number' && typeof r.reps === 'number' ? sum + r.loadKg * r.reps : sum),
    0
  );
}

export function sessionVolumeKg(session: Session): number {
  return session.blockResults.reduce((sum, br) => sum + volumeKg(br.stepResults), 0);
}

/** The score a block gets from what the player observed, before the athlete edits it. */
export function deriveScore(
  block: Block,
  observed: { elapsedSeconds: number; roundsCompleted: number; stepResults: StepResult[] }
): Score {
  switch (scoreKindFor(block)) {
    case 'time':
      return { type: 'time', seconds: Math.floor(observed.elapsedSeconds) };
    case 'rounds_reps':
      return { type: 'rounds_reps', rounds: observed.roundsCompleted, reps: 0 };
    case 'load': {
      const kg = bestLoadKg(observed.stepResults);
      return kg !== undefined ? { type: 'load', kg } : { type: 'completed' };
    }
    case 'distance': {
      const meters = block.config.format === 'continuous' ? block.config.distanceMeters : undefined;
      return meters ? { type: 'distance', meters } : { type: 'completed' };
    }
    default:
      return { type: 'completed' };
  }
}

export function emptyBlockResult(block: Block, oneRepMaxKg: Record<string, number> = {}): BlockResult {
  return { blockId: block.id, status: 'completed', stepResults: initialSetResults(block, oneRepMaxKg) };
}

export function sessionDurationSeconds(session: Session): number | undefined {
  const fromBlocks = session.blockResults.reduce((sum, br) => sum + (br.elapsedSeconds ?? 0), 0);
  if (fromBlocks > 0) return fromBlocks;
  if (session.entryMode !== 'manual' && session.endedAt) return Math.round((session.endedAt - session.startedAt) / 1000);
  return undefined;
}
