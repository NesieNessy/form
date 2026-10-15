import { tr } from '../i18n/tr';
import type { Observation, ObservationLabel } from './model';

export type ObservationParams = Record<string, number | string>;

/**
 * The sentence for an observation, built from its label, variant and
 * values in the reader's language. Analyses store the variant and values,
 * so a coach reading in German sees German even when the athlete's app was
 * in English. Older analyses without a variant keep their stored sentence.
 */
export function describeObservation(label: ObservationLabel, variant: string, p: ObservationParams): string {
  const n = Number(p.n ?? 0);
  const count = Number(p.count ?? 0);
  switch (`${label}:${variant}`) {
    case 'repetitions:count':
      return n === 1 ? tr('1 repetition found.', '1 Wiederholung gefunden.') : tr(`${n} repetitions found.`, `${n} Wiederholungen gefunden.`);
    case 'depth:all':
      return tr(`Hips reached about knee height or lower in all ${n} repetitions.`, `Die Hüfte kam in allen ${n} Wiederholungen etwa auf Kniehöhe oder tiefer.`);
    case 'depth:none':
      return tr(`Hips stayed above knee height in all ${n} repetitions.`, `Die Hüfte blieb in allen ${n} Wiederholungen über Kniehöhe.`);
    case 'depth:some':
      return tr(`Hips reached about knee height in ${count} of ${n} repetitions.`, `Die Hüfte kam in ${count} von ${n} Wiederholungen etwa auf Kniehöhe.`);
    case 'depth_consistency:varies':
      return tr('Depth varies across repetitions.', 'Die Tiefe schwankt zwischen den Wiederholungen.');
    case 'depth_consistency:consistent':
      return tr('Depth is consistent across repetitions.', 'Die Tiefe ist in allen Wiederholungen gleichmäßig.');
    case 'torso_lean:upright':
      return tr(`The torso stays fairly upright at the bottom (roughly ${p.rough}° from vertical).`, `Der Oberkörper bleibt unten recht aufrecht (etwa ${p.rough}° aus der Senkrechten).`);
    case 'torso_lean:moderate':
      return tr(`Moderate forward lean at the bottom (roughly ${p.rough}° from vertical).`, `Mäßige Vorlage unten (etwa ${p.rough}° aus der Senkrechten).`);
    case 'torso_lean:pronounced':
      return tr(`Pronounced forward lean at the bottom (roughly ${p.rough}° from vertical).`, `Deutliche Vorlage unten (etwa ${p.rough}° aus der Senkrechten).`);
    case 'heel_lift:lifts':
      return tr(`Heels may lift at the bottom in ${count} of ${n} repetitions.`, `Die Fersen heben sich unten möglicherweise in ${count} von ${n} Wiederholungen.`);
    case 'heel_lift:down':
      return tr('Heels appear to stay down.', 'Die Fersen scheinen am Boden zu bleiben.');
    case 'knee_tracking:inward':
      return tr(`Knees move inward at the bottom in ${count} of ${n} repetitions.`, `Die Knie wandern unten in ${count} von ${n} Wiederholungen nach innen.`);
    case 'knee_tracking:aligned':
      return tr('Knees stay roughly in line with the feet.', 'Die Knie bleiben ungefähr in Linie mit den Füßen.');
    case 'hip_symmetry:left_lower':
      return tr('The left hip sits lower than the right at the bottom in most repetitions.', 'Die linke Hüfte sitzt unten in den meisten Wiederholungen tiefer als die rechte.');
    case 'hip_symmetry:right_lower':
      return tr('The right hip sits lower than the left at the bottom in most repetitions.', 'Die rechte Hüfte sitzt unten in den meisten Wiederholungen tiefer als die linke.');
    case 'hip_symmetry:level':
      return tr('Hips stay about level at the bottom.', 'Die Hüfte bleibt unten etwa waagerecht.');
    case 'tempo:tempo':
      return tr(`About ${p.down} s down and ${p.up} s up per repetition.`, `Etwa ${p.down} s abwärts und ${p.up} s aufwärts pro Wiederholung.`);
    default:
      return '';
  }
}

/** The text to show: rebuilt in the reader's language when the variant is known. */
export const observationText = (o: Pick<Observation, 'label' | 'summary'> & { variant?: string; params?: ObservationParams }): string =>
  (o.variant && describeObservation(o.label, o.variant, o.params ?? {})) || o.summary;
