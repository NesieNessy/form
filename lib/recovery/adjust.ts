import { withFreshIds, type Block, type Prescription, type Step, type WorkoutContent } from '../workout/model';
import type { OptionKind } from './model';

/**
 * The two workout changes recovery can propose, done by fixed rules so the
 * athlete sees exactly what changes before approving:
 * - shorter: about a third less volume (sets, rounds, duration, distance)
 * - lighter: about 15 % less load, one step lower RPE or heart-rate zone,
 *   about 10 % slower pace, 15 % less power
 * The result has fresh block and step ids, since it becomes a new version.
 */

const twoThirds = (n: number) => Math.max(1, Math.ceil((n * 2) / 3));
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

function shortenBlock(block: Block): Block {
  const c = { ...block.config } as Block['config'];
  switch (c.format) {
    case 'sets_reps':
      if (c.sets && c.sets > 1) c.sets = twoThirds(c.sets);
      break;
    case 'amrap':
      if (c.durationSeconds) c.durationSeconds = Math.max(60, roundTo((c.durationSeconds * 2) / 3, 60));
      break;
    case 'continuous':
      if (c.durationSeconds) c.durationSeconds = Math.max(60, roundTo((c.durationSeconds * 2) / 3, 60));
      if (c.distanceMeters) c.distanceMeters = Math.max(100, roundTo((c.distanceMeters * 2) / 3, 100));
      break;
    case 'repeating_interval':
    case 'for_time':
    case 'sequence':
      if (c.rounds && c.rounds > 1) c.rounds = twoThirds(c.rounds);
      break;
  }
  return { ...block, config: c };
}

function lightenPrescription(rx: Prescription): Prescription {
  const out: Prescription = { ...rx };
  if (rx.load) out.load = { ...rx.load, value: rx.load.unit === 'kg' ? Math.max(0.5, roundTo(rx.load.value * 0.85, 0.5)) : Math.max(1, Math.round(rx.load.value * 0.85)) };
  if (rx.intensity) {
    const { type, value } = rx.intensity;
    const next =
      type === 'rpe' || type === 'hr_zone' ? Math.max(1, value - 1) : type === 'pace_sec_per_km' ? Math.round(value * 1.1) : Math.round(value * 0.85);
    out.intensity = { type, value: next };
  }
  return out;
}

function lightenSteps(steps: Step[]): Step[] {
  return steps.map((s) => (s.kind === 'exercise' ? { ...s, prescription: lightenPrescription(s.prescription) } : s.kind === 'group' ? { ...s, steps: lightenSteps(s.steps) } : s));
}

export function shortened(content: WorkoutContent, newId: () => string): WorkoutContent {
  return withFreshIds({ ...content, blocks: content.blocks.map(shortenBlock) }, newId);
}

export function lighter(content: WorkoutContent, newId: () => string): WorkoutContent {
  return withFreshIds({ ...content, blocks: content.blocks.map((b) => ({ ...b, steps: lightenSteps(b.steps) })) }, newId);
}

const stripIds = (c: WorkoutContent) => JSON.stringify(c, (k, v) => (k === 'id' ? undefined : v));

/** Whether an option would change anything for this workout. */
export function changes(kind: 'shorten' | 'lighter', content: WorkoutContent, newId: () => string): boolean {
  return stripIds(kind === 'shorten' ? shortened(content, newId) : lighter(content, newId)) !== stripIds(content);
}

/**
 * The options as offered for one workout: a change that would do nothing is
 * replaced (lighter by shorter, shorter by moving it), duplicates removed.
 */
export function optionsFor(options: OptionKind[], content: WorkoutContent | undefined, newId: () => string): OptionKind[] {
  if (!content) return [];
  const out: OptionKind[] = [];
  for (const o of options) {
    let pick: OptionKind = o;
    if (pick === 'lighter' && !changes('lighter', content, newId)) pick = 'shorten';
    if (pick === 'shorten' && !changes('shorten', content, newId)) pick = 'reschedule';
    if (!out.includes(pick)) out.push(pick);
  }
  return out;
}
