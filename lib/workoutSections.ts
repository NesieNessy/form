import { Dumbbell, Flame, LayoutGrid, Star, Target, Wind, type LucideIcon } from 'lucide-react-native';
import { strings } from './strings';
import type { SectionKey, StructureKind, WorkoutStructure } from './types';

export const SECTION_KEYS_IN_DEFAULT_ORDER: SectionKey[] = [
  'warmup',
  'skill',
  'strength',
  'accessory',
  'wod',
  'cooldown',
];

export const SECTION_META: Record<SectionKey, { label: string; icon: LucideIcon; required: boolean }> = {
  warmup: { label: strings.warmup, icon: Flame, required: false },
  skill: { label: strings.skill, icon: Target, required: false },
  strength: { label: strings.strength, icon: Dumbbell, required: false },
  accessory: { label: strings.accessory, icon: LayoutGrid, required: false },
  wod: { label: strings.workoutOfTheDay, icon: Star, required: true },
  cooldown: { label: strings.coolDown, icon: Wind, required: false },
};

export function defaultStructureForKind(kind: StructureKind): WorkoutStructure {
  switch (kind) {
    case 'fixedRounds':
      return { kind: 'fixedRounds', rounds: 3 };
    case 'repScheme':
      return { kind: 'repScheme', scheme: '21-15-9' };
    case 'timeBased':
      return { kind: 'timeBased', minutes: 10, seconds: 0 };
    case 'custom':
      return { kind: 'custom', text: '' };
  }
}
