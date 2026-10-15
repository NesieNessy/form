import { pick } from '../i18n/tr';
import type { Sport } from '../workout/model';

/** Display names for sports and equipment in both languages; the stored values stay the ids. */
export const SPORT_LABEL: Record<Sport, string> = pick(
  { crossfit: 'CrossFit', strength: 'Strength', endurance: 'Endurance', running: 'Running', cycling: 'Cycling', swimming: 'Swimming', triathlon: 'Triathlon', yoga: 'Yoga', hiit: 'HIIT', other: 'Other' },
  { crossfit: 'CrossFit', strength: 'Kraft', endurance: 'Ausdauer', running: 'Laufen', cycling: 'Radfahren', swimming: 'Schwimmen', triathlon: 'Triathlon', yoga: 'Yoga', hiit: 'HIIT', other: 'Sonstiges' }
);

const EQUIPMENT_DE: Record<string, string> = {
  barbell: 'Langhantel',
  bench: 'Bank',
  bike: 'Fahrrad',
  'bike erg': 'Bike Erg',
  box: 'Box',
  'dip bars': 'Dip-Barren',
  dumbbell: 'Kurzhantel',
  'jump rope': 'Springseil',
  kettlebell: 'Kettlebell',
  mat: 'Matte',
  'medicine ball': 'Medizinball',
  pool: 'Schwimmbad',
  'pull-up bar': 'Klimmzugstange',
  rack: 'Rack',
  rings: 'Ringe',
  rower: 'Rudergerät',
  'ski erg': 'Ski Erg',
};

export function equipmentLabel(id: string): string {
  const en = id.charAt(0).toUpperCase() + id.slice(1);
  return pick({ [id]: en }, { [id]: EQUIPMENT_DE[id] ?? en })[id];
}
