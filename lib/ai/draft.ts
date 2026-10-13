import { newUuid } from '../id';
import { resolveActivity } from '../workout/catalog';
import {
  BLOCK_FORMATS,
  BLOCK_TYPES,
  SPORTS,
  type Block,
  type BlockConfig,
  type BlockFormat,
  type BlockType,
  type Prescription,
  type Sport,
  type Step,
  type WorkoutContent,
} from '../workout/model';

/**
 * The shape the model is asked to return, and its conversion into the
 * canonical workout model.
 *
 * The model's draft is deliberately simpler than the canonical model: flat
 * fields, one level of grouping, and no identifiers. Everything that must be
 * exact is decided here in code, not by the model: ids are minted, exercise
 * names are matched against the catalog, and anything malformed is dropped
 * for the validator to report rather than repaired by guessing.
 */

export type AiStep = {
  kind: 'exercise' | 'rest' | 'transition';
  name?: string | null;
  reps?: number | null;
  max_reps?: boolean | null;
  duration_seconds?: number | null;
  distance_meters?: number | null;
  calories?: number | null;
  breaths?: number | null;
  load_kg?: number | null;
  load_percent_1rm?: number | null;
  load_per?: 'each' | 'total' | 'unspecified' | null;
  rpe?: number | null;
  side?: 'left' | 'right' | 'both' | 'unspecified' | null;
  note?: string | null;
};

export type AiGroup = { kind: 'group'; name?: string | null; group_rounds?: number | null; steps: AiStep[] };

export type AiBlock = {
  type: BlockType;
  format: BlockFormat;
  label?: string | null;
  rounds?: number | null;
  rep_scheme?: number[] | null;
  time_cap_seconds?: number | null;
  duration_seconds?: number | null;
  interval_seconds?: number | null;
  work_seconds?: number | null;
  alternating?: boolean | null;
  sets?: number | null;
  rest_seconds?: number | null;
  distance_meters?: number | null;
  notes?: string | null;
  steps: (AiStep | AiGroup)[];
};

export type AiDraft = {
  title: string;
  sport: Sport;
  description?: string | null;
  blocks: AiBlock[];
  /** Things the source left unclear, phrased as questions for the athlete. */
  open_questions: string[];
  /** For an adaptation: what was changed and why, in the model's words. */
  changes?: { from: string; to: string; reason: string }[] | null;
  /** Set when the request should go to a qualified professional instead of being answered with a workout. */
  needs_professional_review?: string | null;
};

// The structured-output API caps optional and nullable fields, so every
// field is required and "not stated" has an explicit empty value: 0 for a
// number, '' for text, false, [] or 'unspecified'. draftToContent() reads
// those back as absent, so an empty value never becomes a prescribed zero.
const num = { type: 'number' } as const;
const str = { type: 'string' } as const;

const LEAF_PROPERTIES = {
  name: str,
  reps: num,
  max_reps: { type: 'boolean' },
  duration_seconds: num,
  distance_meters: num,
  calories: num,
  breaths: num,
  load_kg: num,
  load_percent_1rm: num,
  load_per: { type: 'string', enum: ['each', 'total', 'unspecified'] },
  rpe: num,
  side: { type: 'string', enum: ['left', 'right', 'both', 'unspecified'] },
  note: str,
} as const;

const LEAF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', ...Object.keys(LEAF_PROPERTIES)],
  properties: { kind: { type: 'string', enum: ['exercise', 'rest', 'transition'] }, ...LEAF_PROPERTIES },
} as const;

/** JSON Schema for the model's structured output. No recursion: a group holds plain steps only. */
export const AI_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'sport', 'description', 'open_questions', 'needs_professional_review', 'changes', 'blocks'],
  properties: {
    title: str,
    sport: { type: 'string', enum: [...SPORTS] },
    description: str,
    open_questions: { type: 'array', items: str },
    needs_professional_review: str,
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['from', 'to', 'reason'],
        properties: { from: str, to: str, reason: str },
      },
    },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'format', 'label', 'rounds', 'rep_scheme', 'time_cap_seconds', 'duration_seconds', 'interval_seconds', 'work_seconds', 'alternating', 'sets', 'rest_seconds', 'distance_meters', 'notes', 'steps'],
        properties: {
          type: { type: 'string', enum: [...BLOCK_TYPES] },
          format: { type: 'string', enum: [...BLOCK_FORMATS] },
          label: str,
          rounds: num,
          rep_scheme: { type: 'array', items: num },
          time_cap_seconds: num,
          duration_seconds: num,
          interval_seconds: num,
          work_seconds: num,
          alternating: { type: 'boolean' },
          sets: num,
          rest_seconds: num,
          distance_meters: num,
          notes: str,
          // A step of kind `group` repeats its own `steps` for `group_rounds`; every other kind leaves both empty.
          steps: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['kind', ...Object.keys(LEAF_PROPERTIES), 'group_rounds', 'steps'],
              properties: {
                kind: { type: 'string', enum: ['exercise', 'rest', 'transition', 'group'] },
                ...LEAF_PROPERTIES,
                group_rounds: num,
                steps: { type: 'array', items: LEAF_SCHEMA },
              },
            },
          },
        },
      },
    },
  },
} as const;

/** A number the source actually stated. Zero and below are the schema's "not stated". */
const has = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const text = (s: unknown): string | undefined => (typeof s === 'string' && s.trim() ? s.trim() : undefined);

function toConfig(b: AiBlock): BlockConfig {
  switch (b.format) {
    case 'for_time': {
      const config: BlockConfig = { format: 'for_time' };
      if (Array.isArray(b.rep_scheme) && b.rep_scheme.length) config.repScheme = b.rep_scheme;
      else if (has(b.rounds)) config.rounds = b.rounds;
      if (has(b.time_cap_seconds)) config.timeCapSeconds = b.time_cap_seconds;
      return config;
    }
    case 'amrap':
      return has(b.duration_seconds) ? { format: 'amrap', durationSeconds: b.duration_seconds } : { format: 'amrap' };
    case 'repeating_interval': {
      const config: BlockConfig = { format: 'repeating_interval' };
      if (has(b.interval_seconds)) config.intervalSeconds = b.interval_seconds;
      if (has(b.rounds)) config.rounds = b.rounds;
      if (has(b.work_seconds)) config.workSeconds = b.work_seconds;
      if (b.alternating) config.alternating = true;
      return config;
    }
    case 'sets_reps': {
      const config: BlockConfig = { format: 'sets_reps' };
      if (has(b.sets)) config.sets = b.sets;
      if (has(b.rest_seconds)) config.restSeconds = b.rest_seconds;
      return config;
    }
    case 'continuous': {
      const config: BlockConfig = { format: 'continuous' };
      if (has(b.duration_seconds)) config.durationSeconds = b.duration_seconds;
      if (has(b.distance_meters)) config.distanceMeters = b.distance_meters;
      return config;
    }
    case 'sequence':
      return has(b.rounds) ? { format: 'sequence', rounds: b.rounds } : { format: 'sequence' };
    default:
      // An unknown format is passed through so the validator names it, instead of being silently replaced.
      return { format: b.format } as BlockConfig;
  }
}

function toStep(s: AiStep): Step {
  if (s.kind === 'rest') return has(s.duration_seconds) ? { kind: 'rest', id: newUuid(), durationSeconds: s.duration_seconds } : { kind: 'rest', id: newUuid() };
  if (s.kind === 'transition') {
    const step: Step = { kind: 'transition', id: newUuid() };
    if (text(s.name)) step.name = text(s.name);
    if (has(s.duration_seconds)) step.durationSeconds = s.duration_seconds;
    return step;
  }

  const rx: Prescription = {};
  if (s.max_reps) rx.reps = 'max';
  else if (has(s.reps)) rx.reps = s.reps;
  if (has(s.duration_seconds)) rx.durationSeconds = s.duration_seconds;
  if (has(s.distance_meters)) rx.distanceMeters = s.distance_meters;
  if (has(s.calories)) rx.calories = s.calories;
  if (has(s.breaths)) rx.breaths = s.breaths;
  if (has(s.load_kg)) rx.load = { value: s.load_kg, unit: 'kg', ...(s.load_per === 'each' || s.load_per === 'total' ? { per: s.load_per } : {}) };
  else if (has(s.load_percent_1rm)) rx.load = { value: s.load_percent_1rm, unit: 'percent_1rm' };
  if (has(s.rpe)) rx.intensity = { type: 'rpe', value: s.rpe };
  if (s.side === 'left' || s.side === 'right' || s.side === 'both') rx.side = s.side;
  if (text(s.note)) rx.note = text(s.note);

  const name = text(s.name) ?? '';
  // The catalog id comes from a deterministic match on the name, never from the model.
  return { kind: 'exercise', id: newUuid(), name, activityId: resolveActivity(name)?.id ?? null, prescription: rx };
}

export function draftToContent(draft: AiDraft): WorkoutContent {
  const blocks: Block[] = (Array.isArray(draft.blocks) ? draft.blocks : []).map((b) => {
    const block: Block = {
      id: newUuid(),
      type: b.type,
      config: toConfig(b),
      steps: (Array.isArray(b.steps) ? b.steps : []).map((s): Step => {
        if (s.kind !== 'group') return toStep(s);
        const group: Step = { kind: 'group', id: newUuid(), steps: (Array.isArray(s.steps) ? s.steps : []).map(toStep) };
        if (text(s.name)) group.label = text(s.name);
        if (has(s.group_rounds)) group.rounds = s.group_rounds;
        return group;
      }),
    };
    if (text(b.label)) block.label = text(b.label);
    if (text(b.notes)) block.notes = text(b.notes);
    return block;
  });

  const content: WorkoutContent = { title: text(draft.title) ?? '', sport: draft.sport, blocks };
  if (text(draft.description)) content.description = text(draft.description);
  return content;
}

/** The reverse direction, used to show the model a workout it is asked to adapt. */
export function contentToDraft(content: WorkoutContent): Omit<AiDraft, 'open_questions'> {
  const step = (s: Step): AiStep | AiGroup => {
    switch (s.kind) {
      case 'rest':
        return { kind: 'rest', duration_seconds: s.durationSeconds ?? null };
      case 'transition':
        return { kind: 'transition', name: s.name ?? null, duration_seconds: s.durationSeconds ?? null };
      case 'group':
        return { kind: 'group', name: s.label ?? null, group_rounds: s.rounds ?? null, steps: s.steps.filter((c) => c.kind !== 'group').map((c) => step(c) as AiStep) };
      case 'exercise': {
        const rx = s.prescription;
        const out: AiStep = { kind: 'exercise', name: s.name };
        if (rx.reps === 'max') out.max_reps = true;
        else if (rx.reps !== undefined) out.reps = rx.reps;
        if (rx.durationSeconds !== undefined) out.duration_seconds = rx.durationSeconds;
        if (rx.distanceMeters !== undefined) out.distance_meters = rx.distanceMeters;
        if (rx.calories !== undefined) out.calories = rx.calories;
        if (rx.breaths !== undefined) out.breaths = rx.breaths;
        if (rx.load?.unit === 'kg') {
          out.load_kg = rx.load.value;
          if (rx.load.per) out.load_per = rx.load.per;
        } else if (rx.load?.unit === 'percent_1rm') out.load_percent_1rm = rx.load.value;
        if (rx.intensity?.type === 'rpe') out.rpe = rx.intensity.value;
        if (rx.side) out.side = rx.side;
        if (rx.note) out.note = rx.note;
        return out;
      }
    }
  };

  return {
    title: content.title,
    sport: content.sport,
    description: content.description ?? null,
    blocks: content.blocks.map((b): AiBlock => {
      const c = b.config;
      const out: AiBlock = { type: b.type, format: c.format, label: b.label ?? null, notes: b.notes ?? null, steps: b.steps.map(step) };
      if ('rounds' in c && c.rounds !== undefined) out.rounds = c.rounds;
      if (c.format === 'for_time') {
        if (c.repScheme) out.rep_scheme = c.repScheme;
        if (c.timeCapSeconds !== undefined) out.time_cap_seconds = c.timeCapSeconds;
      }
      if ((c.format === 'amrap' || c.format === 'continuous') && c.durationSeconds !== undefined) out.duration_seconds = c.durationSeconds;
      if (c.format === 'continuous' && c.distanceMeters !== undefined) out.distance_meters = c.distanceMeters;
      if (c.format === 'repeating_interval') {
        if (c.intervalSeconds !== undefined) out.interval_seconds = c.intervalSeconds;
        if (c.workSeconds !== undefined) out.work_seconds = c.workSeconds;
        if (c.alternating) out.alternating = true;
      }
      if (c.format === 'sets_reps') {
        if (c.sets !== undefined) out.sets = c.sets;
        if (c.restSeconds !== undefined) out.rest_seconds = c.restSeconds;
      }
      return out;
    }),
  };
}
