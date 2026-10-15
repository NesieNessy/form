import { tr } from '../i18n/tr';
import { LIMITATIONS, OBSERVATION_LABELS, type Analysis } from './model';

/** The same rules the database applies before an analysis is stored; undefined when it is acceptable. */
export function checkAnalysis(a: Analysis): string | undefined {
  if (a.movementId !== 'bodyweight_squat') return tr('Unknown movement.', 'Unbekannte Bewegung.');
  if (a.cameraView !== 'side' && a.cameraView !== 'front') return tr('Unknown camera view.', 'Unbekannte Kameraperspektive.');
  if (!a.quality.limitations.every((l) => l in LIMITATIONS)) return tr('Unknown limitation.', 'Unbekannte Einschränkung.');
  if (!a.quality.usable && a.observations.length) return tr('Unusable footage cannot carry observations.', 'Unbrauchbare Aufnahmen können keine Beobachtungen enthalten.');
  if (a.observations.length > 12) return tr('Too many observations.', 'Zu viele Beobachtungen.');
  for (const o of a.observations) {
    if (!(OBSERVATION_LABELS as readonly string[]).includes(o.label)) return tr(`Unknown observation label: ${o.label}.`, `Unbekannte Beobachtung: ${o.label}.`);
    if (!['low', 'moderate', 'high'].includes(o.confidence)) return tr('Unknown confidence.', 'Unbekannte Sicherheit.');
    if (!o.summary || o.summary.length > 200) return tr('Observation text must be 1 to 200 characters.', 'Der Beobachtungstext muss 1 bis 200 Zeichen lang sein.');
    if (o.timestamps.length > 50 || o.timestamps.some((t) => !Number.isFinite(t) || t < 0 || t > 600)) return tr('Bad timestamps.', 'Ungültige Zeitpunkte.');
  }
  return undefined;
}
