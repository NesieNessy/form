import { LIMITATIONS, OBSERVATION_LABELS, type Analysis } from './model';

/** The same rules the database applies before an analysis is stored; undefined when it is acceptable. */
export function checkAnalysis(a: Analysis): string | undefined {
  if (a.movementId !== 'bodyweight_squat') return 'Unknown movement.';
  if (a.cameraView !== 'side' && a.cameraView !== 'front') return 'Unknown camera view.';
  if (!a.quality.limitations.every((l) => l in LIMITATIONS)) return 'Unknown limitation.';
  if (!a.quality.usable && a.observations.length) return 'Unusable footage cannot carry observations.';
  if (a.observations.length > 12) return 'Too many observations.';
  for (const o of a.observations) {
    if (!(OBSERVATION_LABELS as readonly string[]).includes(o.label)) return `Unknown observation label: ${o.label}.`;
    if (!['low', 'moderate', 'high'].includes(o.confidence)) return 'Unknown confidence.';
    if (!o.summary || o.summary.length > 200) return 'Observation text must be 1 to 200 characters.';
    if (o.timestamps.length > 50 || o.timestamps.some((t) => !Number.isFinite(t) || t < 0 || t > 600)) return 'Bad timestamps.';
  }
  return undefined;
}
