/**
 * Everything the `assistant` edge function needs from the app's own code.
 * scripts/build-edge-core.ts bundles this file into
 * supabase/functions/_shared/core.js, so the server runs the very same
 * validator, catalog matching and change list as the app does.
 */
export { rowToVersion } from '../sync/mappers';
export { diffWorkouts } from './diff';
export { LIMITS, runAdaptation, runImport } from './pipeline';
export { MEAL_LIMITS, runMealParse } from './meal';
export type { AdaptConstraints, CallModel, ModelMessage, ModelRequest, ModelResult, PipelineResult } from './pipeline';
