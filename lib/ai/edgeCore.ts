/**
 * Everything the `assistant` edge function needs from the app's own code.
 * scripts/build-edge-core.ts bundles this file into
 * supabase/functions/_shared/core.js, so the server runs the very same
 * validator, catalog matching and change list as the app does.
 */
export { rowToFoodLog, rowToRecovery, rowToScheduled, rowToSession, rowToVersion } from '../sync/mappers';
export { CHAT_LIMITS, runChat } from './chat';
export type { ChatBlock, ChatModelRequest, ChatModelResult, ToolOutcome } from './chat';
export { clampOffset, nutritionResult, recoveryResult, scheduleResult, sessionsResult, workoutResult } from './chatData';
export { checkWorkout } from '../rehab/conflicts';
export { TAG_LABEL } from '../rehab/model';
export { diffWorkouts } from './diff';
export { LIMITS, runAdaptation, runImport } from './pipeline';
export { MEAL_LIMITS, runMealParse } from './meal';
export type { AdaptConstraints, CallModel, ModelMessage, ModelRequest, ModelResult, PipelineResult } from './pipeline';
