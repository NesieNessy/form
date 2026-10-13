import { supabase } from '../supabase';
import type { WorkoutContent } from '../workout/model';
import type { ValidationResult } from '../workout/validate';
import type { Change } from './diff';
import type { AdaptConstraints, Notice } from './pipeline';

/**
 * App-side client for the assistant (supabase/functions/assistant). The
 * assistant only ever returns a proposal; saving it is a separate, explicit
 * step the athlete takes on the proposal screen.
 */

export type Proposal = {
  id: string;
  type: 'workout_import' | 'workout_adaptation';
  status: 'pending_approval' | 'approved' | 'rejected' | 'superseded';
  source:
    | { kind: 'text'; text: string }
    | { kind: 'file'; media_type: string; text: string | null }
    | { kind: 'workout'; scheduled_id: string; workout_id: string; version_id: string };
  constraints: AdaptConstraints | null;
  content: WorkoutContent;
  original: WorkoutContent | null;
  changes: Change[];
  rationale: { from: string; to: string; reason: string }[];
  validation: ValidationResult;
  open_questions: string[];
  notices: Notice[];
  model: string | null;
  created_at: string;
  expires_at: string;
};

export type AssistantResult = { ok: true; proposal: Proposal } | { ok: false; code: string; message: string };

const OFFLINE = 'The assistant could not be reached. Check your connection and try again.';

const DECISION_MESSAGES: Record<string, string> = {
  PROPOSAL_STALE: 'This workout has changed since the draft was made. Ask the assistant again.',
  PROPOSAL_EXPIRED: 'This draft has expired. Ask the assistant again.',
  PROPOSAL_INVALID: 'This draft still has problems and cannot be saved.',
  PROPOSAL_ALREADY_DECIDED: 'This draft has already been saved or discarded.',
};

async function invoke(body: Record<string, unknown>): Promise<AssistantResult> {
  try {
    const { data, error } = await supabase.functions.invoke('assistant', { body });
    if (error || !data) return { ok: false, code: 'UNREACHABLE', message: OFFLINE };
    return data as AssistantResult;
  } catch {
    return { ok: false, code: 'UNREACHABLE', message: OFFLINE };
  }
}

export const requestImport = (input: { text?: string; file?: { media_type: string; data: string } }) =>
  invoke({ action: 'import_workout', ...input });

export const requestAdaptation = (scheduledId: string, constraints: AdaptConstraints) =>
  invoke({ action: 'adapt_workout', scheduled_id: scheduledId, constraints });

export const reviseProposal = (proposalId: string, note: string) => invoke({ action: 'revise_proposal', proposal_id: proposalId, note });

export async function getProposal(id: string): Promise<Proposal | null> {
  const { data } = await supabase.from('agent_proposals').select('*').eq('id', id).maybeSingle();
  return (data as Proposal | null) ?? null;
}

export async function listPendingProposals(): Promise<Proposal[]> {
  const { data } = await supabase
    .from('agent_proposals')
    .select('*')
    .eq('status', 'pending_approval')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(10);
  return (data as Proposal[] | null) ?? [];
}

/** Records the athlete's decision. Approval is re-checked on the server before anything is saved locally. */
export async function decideProposal(id: string, decision: 'approved' | 'rejected', resultWorkoutId?: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { error } = await supabase.rpc('decide_proposal', { p_proposal: id, p_decision: decision, p_result_workout: resultWorkoutId ?? null });
    if (!error) return { ok: true };
    const code = Object.keys(DECISION_MESSAGES).find((key) => error.message.includes(key));
    return { ok: false, message: code ? DECISION_MESSAGES[code] : OFFLINE };
  } catch {
    return { ok: false, message: OFFLINE };
  }
}
