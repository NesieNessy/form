import { getActivity } from './catalog';
import { BLOCK_FORMATS, BLOCK_TYPES, SPORTS, type Block, type Prescription, type Step, type WorkoutContent } from './model';

/**
 * Deterministic workout validation (docs/concepts/workout_ai_agents_concept.md §8).
 * Level 1 is schema shape, level 2 is format logic. An `error` blocks
 * publishing and execution; a `warning` is valid but worth a second look;
 * `info` is an observation. The publish check in
 * supabase/migrations/0002_workout_core.sql enforces the same errors on the
 * server, so a rule added here needs its counterpart there.
 */

export type Severity = 'error' | 'warning' | 'info';

export type ValidationIssue = {
  code: string;
  path: string;
  severity: Severity;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
};

const MAX_GROUP_DEPTH = 3;

const INTENSITY_TYPES = ['rpe', 'hr_zone', 'pace_sec_per_km', 'ftp_percent', 'power_w'];

function isPositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function isPositiveInt(n: unknown): n is number {
  return isPositive(n) && Number.isInteger(n);
}

export function validateWorkout(content: WorkoutContent): ValidationResult {
  const issues: ValidationIssue[] = [];
  const add = (severity: Severity, code: string, path: string, message: string) =>
    issues.push({ severity, code, path, message });

  if (!SPORTS.includes(content.sport)) add('error', 'INVALID_SPORT', 'sport', 'Unknown sport.');
  if (!content.title || !content.title.trim()) add('error', 'MISSING_TITLE', 'title', 'The workout needs a title.');

  if (!Array.isArray(content.blocks) || content.blocks.length === 0) {
    add('error', 'NO_BLOCKS', 'blocks', 'A workout needs at least one section with content.');
  }

  const seenIds = new Set<string>();
  const claimId = (id: string, path: string) => {
    if (!id) add('error', 'MISSING_ID', path, 'Missing identifier.');
    else if (seenIds.has(id)) add('error', 'DUPLICATE_ID', path, 'Identifier is used more than once.');
    else seenIds.add(id);
  };

  (content.blocks ?? []).forEach((block, bi) => {
    const path = `blocks[${bi}]`;
    claimId(block.id, `${path}.id`);
    validateBlock(block, path, add, claimId);
  });

  const errors = issues.filter((i) => i.severity === 'error');
  return {
    valid: errors.length === 0,
    errors,
    warnings: issues.filter((i) => i.severity === 'warning'),
    infos: issues.filter((i) => i.severity === 'info'),
  };
}

type Add = (severity: Severity, code: string, path: string, message: string) => void;

function validateBlock(block: Block, path: string, add: Add, claimId: (id: string, path: string) => void) {
  if (!BLOCK_TYPES.includes(block.type)) add('error', 'INVALID_BLOCK_TYPE', `${path}.type`, 'Unknown section type.');

  const config = block.config;
  if (!config || !BLOCK_FORMATS.includes(config.format)) {
    add('error', 'INVALID_FORMAT', `${path}.config.format`, 'Unknown workout format.');
    return;
  }

  if (!Array.isArray(block.steps) || block.steps.length === 0) {
    add('error', 'EMPTY_BLOCK', `${path}.steps`, 'This section has no exercises.');
  }

  switch (config.format) {
    case 'for_time': {
      if (config.rounds !== undefined && !isPositiveInt(config.rounds)) {
        add('error', 'INVALID_ROUNDS', `${path}.config.rounds`, 'Rounds must be a whole number above zero.');
      }
      if (config.repScheme !== undefined) {
        if (!Array.isArray(config.repScheme) || config.repScheme.length === 0 || !config.repScheme.every(isPositiveInt)) {
          add('error', 'INVALID_REP_SCHEME', `${path}.config.repScheme`, 'A rep scheme is whole numbers above zero, like 21-15-9.');
        }
        if (config.rounds !== undefined) {
          add('error', 'CONFLICTING_STRUCTURE', `${path}.config`, 'Use either a number of rounds or a rep scheme, not both.');
        }
      }
      if (config.timeCapSeconds !== undefined && !isPositive(config.timeCapSeconds)) {
        add('error', 'INVALID_TIME_CAP', `${path}.config.timeCapSeconds`, 'The time cap must be above zero.');
      }
      break;
    }
    case 'amrap': {
      if (!isPositive(config.durationSeconds)) {
        add('error', 'MISSING_DURATION', `${path}.config.durationSeconds`, 'AMRAP requires a duration.');
      }
      break;
    }
    case 'repeating_interval': {
      if (!isPositive(config.intervalSeconds)) {
        add('error', 'MISSING_INTERVAL', `${path}.config.intervalSeconds`, 'Interval work requires an interval length.');
      }
      if (!isPositiveInt(config.rounds)) {
        add('error', 'MISSING_ROUNDS', `${path}.config.rounds`, 'Interval work requires a number of intervals.');
      }
      if (config.workSeconds !== undefined) {
        if (!isPositive(config.workSeconds)) {
          add('error', 'INVALID_WORK', `${path}.config.workSeconds`, 'Work time must be above zero.');
        } else if (isPositive(config.intervalSeconds) && config.workSeconds > config.intervalSeconds) {
          add('error', 'WORK_EXCEEDS_INTERVAL', `${path}.config.workSeconds`, 'Work time cannot be longer than the interval.');
        }
      }
      break;
    }
    case 'sets_reps': {
      if (!isPositiveInt(config.sets)) {
        add('error', 'MISSING_SETS', `${path}.config.sets`, 'Sets and reps work requires a number of sets.');
      }
      if (config.restSeconds !== undefined && !(typeof config.restSeconds === 'number' && config.restSeconds >= 0)) {
        add('error', 'INVALID_REST', `${path}.config.restSeconds`, 'Rest cannot be negative.');
      }
      break;
    }
    case 'continuous': {
      if (config.durationSeconds !== undefined && !isPositive(config.durationSeconds)) {
        add('error', 'INVALID_DURATION', `${path}.config.durationSeconds`, 'Duration must be above zero.');
      }
      if (config.distanceMeters !== undefined && !isPositive(config.distanceMeters)) {
        add('error', 'INVALID_DISTANCE', `${path}.config.distanceMeters`, 'Distance must be above zero.');
      }
      break;
    }
    case 'sequence': {
      if (config.rounds !== undefined && !isPositiveInt(config.rounds)) {
        add('error', 'INVALID_ROUNDS', `${path}.config.rounds`, 'Rounds must be a whole number above zero.');
      }
      break;
    }
  }

  validateSteps(block.steps ?? [], `${path}.steps`, 1, config.format, add, claimId);
}

function validateSteps(
  steps: Step[],
  path: string,
  depth: number,
  format: string,
  add: Add,
  claimId: (id: string, path: string) => void
) {
  steps.forEach((step, si) => {
    const p = `${path}[${si}]`;
    claimId(step.id, `${p}.id`);
    switch (step.kind) {
      case 'exercise': {
        if (!step.name || !step.name.trim()) add('error', 'MISSING_EXERCISE_NAME', `${p}.name`, 'An exercise needs a name.');
        if (step.activityId === null || step.activityId === undefined) {
          add('info', 'UNRESOLVED_EXERCISE', `${p}.activityId`, `"${step.name}" is not in the exercise catalog, so it is not tracked in trends.`);
        } else if (!getActivity(step.activityId)) {
          add('error', 'UNKNOWN_ACTIVITY', `${p}.activityId`, 'This exercise points to a catalog entry that does not exist.');
        }
        validatePrescription(step.prescription ?? {}, `${p}.prescription`, add);
        if (format === 'sets_reps') {
          const rx = step.prescription ?? {};
          if (rx.reps === undefined && rx.durationSeconds === undefined && rx.distanceMeters === undefined) {
            add('warning', 'MISSING_TARGET', `${p}.prescription`, `"${step.name}" has no reps or time per set.`);
          }
        }
        break;
      }
      case 'rest': {
        if (!isPositive(step.durationSeconds)) {
          add('error', 'MISSING_DURATION', `${p}.durationSeconds`, 'A rest needs a duration.');
        }
        break;
      }
      case 'transition': {
        if (step.durationSeconds !== undefined && !isPositive(step.durationSeconds)) {
          add('error', 'INVALID_DURATION', `${p}.durationSeconds`, 'Duration must be above zero.');
        }
        break;
      }
      case 'group': {
        if (depth >= MAX_GROUP_DEPTH) {
          add('error', 'NESTING_TOO_DEEP', p, `Groups can be nested at most ${MAX_GROUP_DEPTH - 1} levels deep.`);
        }
        if (!isPositiveInt(step.rounds)) {
          add('error', 'MISSING_ROUNDS', `${p}.rounds`, 'A repeated group needs a number of rounds.');
        }
        if (!Array.isArray(step.steps) || step.steps.length === 0) {
          add('error', 'EMPTY_GROUP', `${p}.steps`, 'A repeated group needs at least one exercise.');
        } else if (depth < MAX_GROUP_DEPTH) {
          validateSteps(step.steps, `${p}.steps`, depth + 1, format, add, claimId);
        }
        break;
      }
      default:
        add('error', 'INVALID_STEP_KIND', `${p}.kind`, 'Unknown step kind.');
    }
  });
}

function validatePrescription(rx: Prescription, path: string, add: Add) {
  if (rx.reps !== undefined && rx.reps !== 'max') {
    if (!isPositiveInt(rx.reps)) add('error', 'INVALID_REPS', `${path}.reps`, 'Reps must be a whole number above zero.');
    else if (rx.reps > 1000) add('warning', 'IMPLAUSIBLE_REPS', `${path}.reps`, 'That is an unusually high rep count.');
  }
  if (rx.durationSeconds !== undefined) {
    if (!isPositive(rx.durationSeconds)) add('error', 'INVALID_DURATION', `${path}.durationSeconds`, 'Duration must be above zero.');
    else if (rx.durationSeconds > 6 * 3600) add('warning', 'IMPLAUSIBLE_DURATION', `${path}.durationSeconds`, 'That is longer than six hours.');
  }
  if (rx.distanceMeters !== undefined) {
    if (!isPositive(rx.distanceMeters)) add('error', 'INVALID_DISTANCE', `${path}.distanceMeters`, 'Distance must be above zero.');
    else if (rx.distanceMeters > 300_000) add('warning', 'IMPLAUSIBLE_DISTANCE', `${path}.distanceMeters`, 'That is further than 300 km.');
  }
  if (rx.calories !== undefined && !isPositive(rx.calories)) {
    add('error', 'INVALID_CALORIES', `${path}.calories`, 'Calories must be above zero.');
  }
  if (rx.breaths !== undefined && !isPositiveInt(rx.breaths)) {
    add('error', 'INVALID_BREATHS', `${path}.breaths`, 'Breaths must be a whole number above zero.');
  }
  if (rx.restSeconds !== undefined && !(typeof rx.restSeconds === 'number' && rx.restSeconds >= 0)) {
    add('error', 'INVALID_REST', `${path}.restSeconds`, 'Rest cannot be negative.');
  }
  if (rx.side !== undefined && !['left', 'right', 'both'].includes(rx.side)) {
    add('error', 'INVALID_SIDE', `${path}.side`, 'Side must be left, right or both.');
  }
  if (rx.load !== undefined) {
    if (rx.load.unit !== 'kg' && rx.load.unit !== 'percent_1rm') {
      add('error', 'INVALID_UNIT', `${path}.load.unit`, 'Load must be in kg or percent of 1RM.');
    } else if (!isPositive(rx.load.value)) {
      add('error', 'INVALID_LOAD', `${path}.load.value`, 'Load must be above zero.');
    } else if (rx.load.unit === 'percent_1rm') {
      if (rx.load.value > 200) add('error', 'INVALID_LOAD', `${path}.load.value`, 'Percent of 1RM cannot exceed 200.');
      else if (rx.load.value > 100) add('warning', 'HIGH_INTENSITY', `${path}.load.value`, 'This is above 100% of 1RM. Review the proposed intensity.');
    } else if (rx.load.value > 500) {
      add('warning', 'IMPLAUSIBLE_LOAD', `${path}.load.value`, 'That is heavier than 500 kg.');
    }
  }
  if (rx.intensity !== undefined) {
    if (!INTENSITY_TYPES.includes(rx.intensity.type)) {
      add('error', 'INVALID_UNIT', `${path}.intensity.type`, 'Unknown intensity type.');
    } else if (!isPositive(rx.intensity.value)) {
      add('error', 'INVALID_INTENSITY', `${path}.intensity.value`, 'Intensity must be above zero.');
    } else if (rx.intensity.type === 'rpe' && rx.intensity.value > 10) {
      add('error', 'INVALID_INTENSITY', `${path}.intensity.value`, 'RPE runs from 1 to 10.');
    } else if (rx.intensity.type === 'hr_zone' && (rx.intensity.value > 5 || !Number.isInteger(rx.intensity.value))) {
      add('error', 'INVALID_INTENSITY', `${path}.intensity.value`, 'Heart-rate zones run from 1 to 5.');
    } else if (rx.intensity.type === 'ftp_percent' && rx.intensity.value > 150) {
      add('warning', 'HIGH_INTENSITY', `${path}.intensity.value`, 'This is above 150% of FTP. Review the proposed intensity.');
    }
  }
}
