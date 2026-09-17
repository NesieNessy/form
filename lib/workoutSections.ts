import { Icons, type LucideIcon } from '@/theme/icons';
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
  warmup: { label: strings.warmup, icon: Icons.flame, required: false },
  skill: { label: strings.skill, icon: Icons.target, required: false },
  strength: { label: strings.strength, icon: Icons.dumbbell, required: false },
  accessory: { label: strings.accessory, icon: Icons.layoutGrid, required: false },
  wod: { label: strings.workoutOfTheDay, icon: Icons.star, required: true },
  cooldown: { label: strings.coolDown, icon: Icons.wind, required: false },
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
