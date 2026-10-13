import { blockLabel, formatBlockHeadline, formatStep } from '../workout/format';
import type { Block, Step, WorkoutContent } from '../workout/model';

/**
 * A deterministic list of what differs between two workouts, in words an
 * athlete can check. This, not the model's own account of its changes, is
 * what the approval screen presents as "what will change".
 */

export type Change = {
  kind: 'title' | 'block_added' | 'block_removed' | 'block_changed' | 'step_added' | 'step_removed' | 'step_changed';
  /** Which section the change is in. */
  where: string;
  before?: string;
  after?: string;
};

const line = (step: Step): string => {
  const { title, detail } = formatStep(step);
  const own = detail ? `${title} — ${detail}` : title;
  return step.kind === 'group' ? `${own}: ${step.steps.map(line).join('; ')}` : own;
};

const key = (step: Step): string => (step.kind === 'exercise' ? `e:${step.activityId ?? step.name.trim().toLowerCase()}` : step.kind);

/** Pairs up steps that are the same movement in the same order; everything else is an addition or removal. */
function diffSteps(before: Step[], after: Step[], where: string): Change[] {
  const m = before.length;
  const n = after.length;
  // Longest common subsequence on the movement key.
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = key(before[i]) === key(after[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const removed: Step[] = [];
  const added: Step[] = [];
  const changes: Change[] = [];
  const flush = () => {
    // A removal next to an addition reads best as one replacement.
    while (removed.length && added.length) {
      changes.push({ kind: 'step_changed', where, before: line(removed.shift() as Step), after: line(added.shift() as Step) });
    }
    for (const s of removed.splice(0)) changes.push({ kind: 'step_removed', where, before: line(s) });
    for (const s of added.splice(0)) changes.push({ kind: 'step_added', where, after: line(s) });
  };

  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && key(before[i]) === key(after[j])) {
      flush();
      const [a, b] = [line(before[i]), line(after[j])];
      if (a !== b) changes.push({ kind: 'step_changed', where, before: a, after: b });
      i++;
      j++;
    } else if (j < n && (i === m || lcs[i][j + 1] >= lcs[i + 1][j])) {
      added.push(after[j++]);
    } else {
      removed.push(before[i++]);
    }
  }
  flush();
  return changes;
}

const describeBlock = (block: Block): string => [formatBlockHeadline(block), block.notes].filter(Boolean).join(' · ');

export function diffWorkouts(before: WorkoutContent, after: WorkoutContent): Change[] {
  const changes: Change[] = [];
  if (before.title !== after.title) changes.push({ kind: 'title', where: 'Title', before: before.title, after: after.title });

  const count = Math.max(before.blocks.length, after.blocks.length);
  for (let i = 0; i < count; i++) {
    const a = before.blocks[i];
    const b = after.blocks[i];
    if (a && !b) {
      changes.push({ kind: 'block_removed', where: blockLabel(a), before: `${describeBlock(a)}: ${a.steps.map(line).join('; ')}` });
    } else if (!a && b) {
      changes.push({ kind: 'block_added', where: blockLabel(b), after: `${describeBlock(b)}: ${b.steps.map(line).join('; ')}` });
    } else if (a && b) {
      const where = blockLabel(b);
      if (describeBlock(a) !== describeBlock(b) || blockLabel(a) !== blockLabel(b)) {
        changes.push({ kind: 'block_changed', where, before: `${blockLabel(a)}: ${describeBlock(a)}`, after: `${blockLabel(b)}: ${describeBlock(b)}` });
      }
      changes.push(...diffSteps(a.steps, b.steps, where));
    }
  }
  return changes;
}
