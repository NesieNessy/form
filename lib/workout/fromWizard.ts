import { newUuid } from '../id';
import { strings } from '../strings';
import type {
  Exercise,
  SectionKey,
  SectionWorkoutType,
  WorkoutCategory,
  WorkoutSection,
  WorkoutStructure,
} from '../types';
import { resolveActivity } from './catalog';
import type { Block, BlockConfig, BlockType, Prescription, Sport, Step, WorkoutContent } from './model';

/**
 * Converts the creation wizard's form state into the canonical workout
 * model. Anything the wizard captured as free text that has no typed home
 * is kept as a note; nothing is guessed. Missing required values are left
 * missing for validate.ts to report.
 */

const SECTION_BLOCK_TYPE: Record<SectionKey, BlockType> = {
  warmup: 'warmup',
  skill: 'skill',
  strength: 'strength',
  accessory: 'accessory',
  wod: 'conditioning',
  cooldown: 'cooldown',
};

const SECTION_LABEL: Record<SectionKey, string> = {
  warmup: strings.warmup,
  skill: strings.skill,
  strength: strings.strength,
  accessory: strings.accessory,
  wod: strings.workoutOfTheDay,
  cooldown: strings.coolDown,
};

const CATEGORY_SPORT: Record<WorkoutCategory, Sport> = {
  crossfit: 'crossfit',
  strength: 'strength',
  endurance: 'endurance',
  other: 'other',
};

export function defaultWorkoutTypeForSection(key: SectionKey): SectionWorkoutType {
  if (key === 'strength' || key === 'accessory') return 'strength';
  if (key === 'wod') return 'forTime';
  return 'custom';
}

/** The structure the wizard pre-selects for a workout type, so what the user sees is what gets saved. */
export function defaultStructureForType(workoutType: SectionWorkoutType): WorkoutStructure {
  switch (workoutType) {
    case 'amrap':
    case 'emom':
      return { kind: 'timeBased', minutes: 10, seconds: 0 };
    case 'tabata':
    case 'custom':
      return { kind: 'custom', text: '' };
    case 'forTime':
    case 'partnerWod':
    case 'strength':
      return { kind: 'fixedRounds', rounds: 3 };
  }
}

function structureSeconds(structure: Extract<WorkoutStructure, { kind: 'timeBased' }>): number {
  return structure.minutes * 60 + structure.seconds;
}

function structureText(structure: WorkoutStructure | undefined): string | undefined {
  if (!structure) return undefined;
  switch (structure.kind) {
    case 'fixedRounds':
      return `${structure.rounds} rounds`;
    case 'repScheme':
      return structure.scheme.trim() || undefined;
    case 'timeBased':
      return `${structure.minutes}:${String(structure.seconds).padStart(2, '0')}`;
    case 'custom':
      return structure.text.trim() || undefined;
  }
}

export function parseRepScheme(scheme: string): number[] | undefined {
  const parts = scheme
    .split(/[-–,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0 || !parts.every((p) => /^\d+$/.test(p))) return undefined;
  const nums = parts.map(Number);
  return nums.every((n) => n > 0) ? nums : undefined;
}

/** "Every 3 min for 12 min, alternating" -> interval 180 s, 4 rounds, alternating. */
export function parseEveryText(text: string): { intervalSeconds: number; rounds?: number; alternating: boolean } | undefined {
  const m = /every\s+(\d+(?:\.\d+)?)\s*(min|sec|s|m)\w*(?:\s+(?:for|x)\s+(\d+(?:\.\d+)?)\s*(min|sec|s|m|rounds?)\w*)?/i.exec(text);
  if (!m) return undefined;
  const toSeconds = (value: string, unit: string) => Number(value) * (unit.toLowerCase().startsWith('m') ? 60 : 1);
  const intervalSeconds = toSeconds(m[1], m[2]);
  if (!(intervalSeconds > 0)) return undefined;
  let rounds: number | undefined;
  if (m[3] && m[4]) {
    rounds = m[4].toLowerCase().startsWith('round') ? Number(m[3]) : toSeconds(m[3], m[4]) / intervalSeconds;
    if (!Number.isInteger(rounds) || rounds <= 0) rounds = undefined;
  }
  return { intervalSeconds, rounds, alternating: /alternat/i.test(text) };
}

/** "8 x 20/10 sec" -> 8 rounds of 20 s work / 10 s rest. */
export function parseWorkRestText(text: string): { rounds: number; workSeconds: number; restSeconds: number } | undefined {
  const m = /(\d+)\s*x\s*(\d+)\s*\/\s*(\d+)/i.exec(text);
  if (!m) return undefined;
  const [rounds, workSeconds, restSeconds] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return rounds > 0 && workSeconds > 0 && restSeconds >= 0 ? { rounds, workSeconds, restSeconds } : undefined;
}

function buildConfig(
  workoutType: SectionWorkoutType,
  structure: WorkoutStructure | undefined
): { config: BlockConfig; note?: string; tags?: string[] } {
  const text = structureText(structure);

  switch (workoutType) {
    case 'forTime':
    case 'partnerWod': {
      const tags = workoutType === 'partnerWod' ? ['partner'] : undefined;
      if (structure?.kind === 'fixedRounds') return { config: { format: 'for_time', rounds: structure.rounds }, tags };
      if (structure?.kind === 'repScheme') {
        const repScheme = parseRepScheme(structure.scheme);
        return repScheme ? { config: { format: 'for_time', repScheme }, tags } : { config: { format: 'for_time' }, note: text, tags };
      }
      if (structure?.kind === 'timeBased') {
        const cap = structureSeconds(structure);
        return { config: cap > 0 ? { format: 'for_time', timeCapSeconds: cap } : { format: 'for_time' }, tags };
      }
      return { config: { format: 'for_time' }, note: text, tags };
    }

    case 'amrap': {
      if (structure?.kind === 'timeBased') {
        const durationSeconds = structureSeconds(structure);
        return { config: durationSeconds > 0 ? { format: 'amrap', durationSeconds } : { format: 'amrap' } };
      }
      return { config: { format: 'amrap' }, note: text };
    }

    case 'emom': {
      if (structure?.kind === 'fixedRounds') {
        return { config: { format: 'repeating_interval', intervalSeconds: 60, rounds: structure.rounds } };
      }
      if (structure?.kind === 'timeBased') {
        const rounds = Math.floor(structureSeconds(structure) / 60);
        return { config: { format: 'repeating_interval', intervalSeconds: 60, rounds: rounds > 0 ? rounds : undefined } };
      }
      if (structure?.kind === 'custom') {
        const parsed = parseEveryText(structure.text);
        if (parsed) {
          return {
            config: {
              format: 'repeating_interval',
              intervalSeconds: parsed.intervalSeconds,
              rounds: parsed.rounds,
              alternating: parsed.alternating || undefined,
            },
            note: text,
          };
        }
      }
      return { config: { format: 'repeating_interval', intervalSeconds: 60 }, note: text };
    }

    case 'tabata': {
      // The Tabata protocol itself is fixed: 8 rounds of 20 s on / 10 s off.
      const base = { format: 'repeating_interval' as const, intervalSeconds: 30, workSeconds: 20, rounds: 8 };
      if (structure?.kind === 'fixedRounds') return { config: { ...base, rounds: structure.rounds } };
      if (structure?.kind === 'timeBased') {
        const rounds = Math.floor(structureSeconds(structure) / 30);
        return { config: { ...base, rounds: rounds > 0 ? rounds : undefined } };
      }
      if (structure?.kind === 'custom') {
        const parsed = parseWorkRestText(structure.text);
        if (parsed) {
          return {
            config: {
              format: 'repeating_interval',
              intervalSeconds: parsed.workSeconds + parsed.restSeconds,
              workSeconds: parsed.workSeconds,
              rounds: parsed.rounds,
            },
            note: text,
          };
        }
      }
      return { config: base, note: text };
    }

    case 'strength': {
      if (structure?.kind === 'fixedRounds') return { config: { format: 'sets_reps', sets: structure.rounds } };
      if (structure?.kind === 'repScheme') {
        const scheme = parseRepScheme(structure.scheme);
        return { config: { format: 'sets_reps', sets: scheme?.length }, note: text };
      }
      if (structure?.kind === 'custom') {
        const m = /(\d+)\s*x\s*\d+/i.exec(structure.text);
        return { config: { format: 'sets_reps', sets: m ? Number(m[1]) : undefined }, note: text };
      }
      return { config: { format: 'sets_reps' }, note: text };
    }

    case 'custom': {
      if (structure?.kind === 'fixedRounds') return { config: { format: 'sequence', rounds: structure.rounds } };
      return { config: { format: 'sequence' }, note: text };
    }
  }
}

const REST_NAME = /^(?:\d+\s*(?:min|sec)\w*\s+)?(?:pause|rest)$/i;

function exerciseToStep(ex: Exercise): Step {
  const p = ex.primary;
  const durationSeconds = p.target === 'time' ? p.minutes * 60 + p.seconds : undefined;

  if (durationSeconds && REST_NAME.test(ex.name.trim())) {
    return { kind: 'rest', id: newUuid(), durationSeconds };
  }

  const rx: Prescription = {};
  switch (p.target) {
    case 'reps':
      rx.reps = p.reps;
      break;
    case 'rounds':
      rx.note = `${p.rounds} rounds`;
      break;
    case 'calories':
      if (p.calories > 0) rx.calories = p.calories;
      break;
    case 'time':
      if (durationSeconds) rx.durationSeconds = durationSeconds;
      break;
    case 'distance':
      if (p.value > 0) rx.distanceMeters = p.unit === 'km' ? p.value * 1000 : p.value;
      break;
    case 'weight':
      if (p.value > 0) rx.load = { value: p.value, unit: 'kg', per: 'total' };
      break;
    case 'custom': {
      const text = p.text.trim();
      if (/^max(?:\s+(?:reps?|effort))?$/i.test(text)) rx.reps = 'max';
      else if (text) rx.note = text;
      break;
    }
  }
  if (ex.weight && ex.weight.value > 0 && p.target !== 'weight') {
    rx.load = { value: ex.weight.value, unit: 'kg', per: ex.weight.mode };
  }

  return {
    kind: 'exercise',
    id: newUuid(),
    name: ex.name.trim(),
    activityId: resolveActivity(ex.name)?.id ?? null,
    prescription: rx,
    notes: ex.notes?.trim() || undefined,
  };
}

export function sectionToBlocks(section: WorkoutSection): Block[] {
  const exercises = section.exercises.filter((ex) => ex.name.trim().length > 0);
  const workoutType = section.workoutType ?? defaultWorkoutTypeForSection(section.key);
  const { config, note, tags } = buildConfig(workoutType, section.structure);
  // A section left untouched is dropped; one that only has a free-text
  // structure is kept so the text is not lost, and validation reports it.
  if (exercises.length === 0 && !note) return [];

  const steps = exercises.map(exerciseToStep);
  const base = { type: SECTION_BLOCK_TYPE[section.key], label: SECTION_LABEL[section.key], tags };

  // In a Tabata every movement gets its own full set of intervals, so several
  // movements are several interval blocks, with any pauses between them as
  // their own timed blocks. One shared block would run a single set for all.
  if (workoutType === 'tabata' && steps.filter((s) => s.kind === 'exercise').length > 1) {
    return steps.map((step, i): Block => {
      if (step.kind === 'rest') {
        return {
          id: newUuid(),
          type: 'recovery',
          label: strings.rest,
          config: { format: 'continuous', durationSeconds: step.durationSeconds },
          steps: [step],
        };
      }
      return { id: newUuid(), ...base, config, steps: [step], notes: i === 0 ? note : undefined };
    });
  }

  return [{ id: newUuid(), ...base, config, steps, notes: note }];
}

export function wizardToContent(input: {
  title: string;
  category: WorkoutCategory;
  notes?: string;
  sections: WorkoutSection[];
}): WorkoutContent {
  return {
    title: input.title.trim() || strings.untitledWorkout,
    sport: CATEGORY_SPORT[input.category],
    description: input.notes?.trim() || undefined,
    blocks: input.sections.flatMap(sectionToBlocks),
  };
}
