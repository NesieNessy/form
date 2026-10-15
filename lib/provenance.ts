/**
 * Where a value came from, shown the same way everywhere
 * (docs/concepts/11-frontend-ux-ui-architecture.md, "visible provenance").
 */
export type Provenance = 'measurement' | 'device' | 'self' | 'calculated' | 'estimate' | 'ai' | 'clinician';

/** A health observation: typed in by the athlete, or imported from a device or service. */
export const observationSource = (provider: string): Provenance => (provider === 'manual' ? 'self' : 'device');

/** A recovery signal. */
export const signalSource = (source: 'measurement' | 'check_in' | 'training_log'): Provenance =>
  source === 'measurement' ? 'measurement' : source === 'check_in' ? 'self' : 'calculated';

/** A food log entry; plain entries from food data are not tagged. */
export const foodEntrySource = (e: { entryMethod: string; estimated: boolean }): Provenance | undefined =>
  e.entryMethod === 'ai_draft' ? 'ai' : e.estimated ? 'estimate' : undefined;

/** Goal evidence. */
export const evidenceSource = (source: 'benchmark' | 'session' | 'activity' | 'clinician' | 'athlete'): Provenance =>
  source === 'activity' ? 'device' : source === 'clinician' ? 'clinician' : 'self';
