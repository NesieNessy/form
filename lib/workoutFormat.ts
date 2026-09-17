import { strings } from './strings';
import type { Exercise, SectionWorkoutType, WorkoutSection, WorkoutStructure } from './types';

export function formatExerciseTarget(ex: Exercise): string {
  const p = ex.primary;
  let base: string;
  switch (p.target) {
    case 'reps':
      base = `${p.reps} reps`;
      break;
    case 'rounds':
      base = `${p.rounds} rounds`;
      break;
    case 'calories':
      base = `${p.calories} cal`;
      break;
    case 'time':
      base = `${p.minutes}:${String(p.seconds).padStart(2, '0')}`;
      break;
    case 'distance':
      base = `${p.value} ${p.unit}`;
      break;
    case 'weight':
      base = `${p.value} kg`;
      break;
    case 'custom':
      base = p.text;
      break;
  }
  if (ex.weight && p.target !== 'weight') {
    return `${base} · ${ex.weight.value} kg${ex.weight.mode === 'each' ? ' each' : ''}`;
  }
  return base;
}

const SECTION_TYPE_LABEL: Record<SectionWorkoutType, string> = {
  forTime: strings.workoutTypeForTime,
  amrap: strings.workoutTypeAmrap,
  emom: strings.workoutTypeEmom,
  tabata: strings.workoutTypeTabata,
  strength: strings.strength,
  partnerWod: strings.workoutTypePartnerWod,
  custom: strings.workoutTypeCustom,
};

function formatStructure(structure?: WorkoutStructure): string | undefined {
  if (!structure) return undefined;
  switch (structure.kind) {
    case 'fixedRounds':
      return `${structure.rounds} Rounds`;
    case 'repScheme':
      return structure.scheme || undefined;
    case 'timeBased':
      return `${structure.minutes}:${String(structure.seconds).padStart(2, '0')}`;
    case 'custom':
      return structure.text.split('\n')[0] || undefined;
  }
}

export function formatSectionHeadline(section: WorkoutSection): string | undefined {
  const parts = [
    section.workoutType && SECTION_TYPE_LABEL[section.workoutType],
    formatStructure(section.structure),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

export function countWorkoutExercises(sections: WorkoutSection[]): number {
  return sections.reduce((n, s) => n + s.exercises.length, 0);
}
