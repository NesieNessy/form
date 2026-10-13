import { blockLabel, formatBlockHeadline, formatStep } from './format';
import type { Step, WorkoutContent } from './model';

/** Plain-text rendering of a workout for the system share sheet. */
export function formatWorkoutShareText(content: WorkoutContent): string {
  const lines: string[] = [content.title];
  const addSteps = (steps: Step[], indent: string) => {
    for (const step of steps) {
      const { title, detail } = formatStep(step);
      lines.push(`${indent}${detail ? `${title} — ${detail}` : title}`);
      if (step.kind === 'group') addSteps(step.steps, `${indent}  `);
    }
  };
  for (const block of content.blocks) {
    lines.push('', `${blockLabel(block)} — ${formatBlockHeadline(block)}`);
    if (block.notes) lines.push(block.notes);
    addSteps(block.steps, '');
  }
  if (content.description) lines.push('', content.description);
  return lines.join('\n');
}
