// FORM assistant — AI workout import and adaptation (roadmap Step 3) and meal parsing (Step 5).
//
// One server-side entry point for every AI workflow. The model only ever
// produces a draft; the pipelines in ../_shared/core.js (bundled from the
// app's own lib/) convert, validate and diff it, and the result is stored
// as a proposal for the athlete to approve.
//
// Two database clients are used on purpose:
//   - `asUser` carries the caller's token, so anything it reads is limited
//     by row-level security to what that athlete may see.
//   - `asService` only writes the run log and the proposal, which clients
//     are not allowed to write themselves.
//
// Deploy:  npx supabase functions deploy assistant
// Secret:  ANTHROPIC_API_KEY (npx supabase secrets set ANTHROPIC_API_KEY=...)

import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { diffWorkouts, LIMITS, MEAL_LIMITS, rowToVersion, runAdaptation, runImport, runMealParse } from '../_shared/core.js';

const MODEL = 'claude-opus-5-5';
const RUNS_PER_HOUR = 20;

const anthropic = new Anthropic();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const failure = (code: string, message: string, status = 200) => json({ ok: false, code, message }, status);

type Part = { type: 'text'; text: string } | { type: 'image'; mediaType: string; data: string } | { type: 'document'; mediaType: string; data: string };

function toBlocks(parts: Part[]) {
  return parts.map((part) => {
    if (part.type === 'text') return { type: 'text' as const, text: part.text };
    if (part.type === 'image') {
      return { type: 'image' as const, source: { type: 'base64' as const, media_type: part.mediaType, data: part.data } };
    }
    return { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: part.data } };
  });
}

// The single place a model is called. Structured output keeps the reply to
// the draft schema; the pipeline still treats it as untrusted and validates it.
async function callModel(request: { system: string; messages: { role: 'user' | 'assistant'; content: Part[] }[]; schema: object }) {
  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // If the model's safety checks decline a request, Anthropic re-runs it on its recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: request.system,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: request.schema } },
      // deno-lint-ignore no-explicit-any
      messages: request.messages.map((m) => ({ role: m.role, content: toBlocks(m.content) })) as any,
      // deno-lint-ignore no-explicit-any
    } as any);

    if (response.stop_reason === 'refusal') {
      return { ok: false as const, reason: 'refusal' as const, detail: response.stop_details?.category ?? undefined };
    }
    if (response.stop_reason === 'max_tokens') return { ok: false as const, reason: 'truncated' as const };

    const text = response.content
      // deno-lint-ignore no-explicit-any
      .filter((block: any) => block.type === 'text')
      // deno-lint-ignore no-explicit-any
      .map((block: any) => block.text)
      .join('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false as const, reason: 'invalid_json' as const };
    }
    const usage = response.usage;
    return {
      ok: true as const,
      json: parsed,
      model: response.model,
      inputTokens: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
      outputTokens: usage.output_tokens ?? 0,
    };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false as const, reason: 'error' as const, detail: 'rate_limited' };
    if (error instanceof Anthropic.AuthenticationError) return { ok: false as const, reason: 'error' as const, detail: 'bad_api_key' };
    if (error instanceof Anthropic.BadRequestError) return { ok: false as const, reason: 'error' as const, detail: `bad_request: ${error.message}`.slice(0, 300) };
    if (error instanceof Anthropic.APIError) return { ok: false as const, reason: 'error' as const, detail: `api_${error.status}` };
    return { ok: false as const, reason: 'error' as const, detail: 'network' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return failure('METHOD_NOT_ALLOWED', 'Use POST.', 405);

  const authorization = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  const asService = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: auth } = await asUser.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
  const user = auth?.user;
  if (!user) return failure('NOT_AUTHENTICATED', 'Sign in to use the assistant.', 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return failure('INVALID_INPUT', 'The request was not valid JSON.');
  }

  // A per-athlete ceiling, so a bug or a stuck client cannot run up the bill.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await asService.from('agent_runs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
  if ((count ?? 0) >= RUNS_PER_HOUR) return failure('RATE_LIMITED', 'You have used the assistant a lot in the last hour. Try again a little later.');

  const started = Date.now();

  // A meal draft goes straight back to the app for the athlete to check; it is never stored as a proposal.
  if (body?.action === 'parse_meal') {
    const text = typeof body.text === 'string' ? body.text : '';
    // deno-lint-ignore no-explicit-any
    const foods = Array.isArray(body.foods) ? body.foods.filter((f: any) => typeof f?.id === 'string' && typeof f?.name === 'string').slice(0, MEAL_LIMITS.ownFoods) : [];
    const meal = await runMealParse(text, foods, callModel);
    await asService.from('agent_runs').insert({
      user_id: user.id,
      workflow: 'meal_parse',
      status: meal.ok ? 'succeeded' : 'failed',
      failure_code: meal.ok ? null : meal.code,
      model: meal.usage.model,
      input_tokens: meal.usage.inputTokens,
      output_tokens: meal.usage.outputTokens,
      model_calls: meal.usage.modelCalls,
      steps: meal.steps,
      input_meta: { text_chars: text.length, own_foods: foods.length },
      duration_ms: Date.now() - started,
    });
    return meal.ok ? json({ ok: true, draft: meal.draft }) : failure(meal.code, meal.message);
  }

  let workflow: 'workout_import' | 'workout_adaptation' | 'proposal_revision';
  let proposalType: 'workout_import' | 'workout_adaptation';
  // deno-lint-ignore no-explicit-any
  let source: any;
  // deno-lint-ignore no-explicit-any
  let original: any = null;
  // deno-lint-ignore no-explicit-any
  let constraints: any = null;
  let parentProposalId: string | null = null;
  // deno-lint-ignore no-explicit-any
  let inputMeta: Record<string, any> = {};
  // deno-lint-ignore no-explicit-any
  let result: any;

  if (body?.action === 'import_workout') {
    workflow = 'workout_import';
    proposalType = 'workout_import';
    const text = typeof body.text === 'string' ? body.text : '';
    const file = body.file && typeof body.file.data === 'string' && typeof body.file.media_type === 'string' ? { mediaType: body.file.media_type, data: body.file.data } : undefined;
    inputMeta = { text_chars: text.length, file_type: file?.mediaType ?? null };
    // The original is kept with the draft so the athlete can compare. A file is described, not stored.
    source = file ? { kind: 'file', media_type: file.mediaType, text: text.slice(0, LIMITS.textChars) || null } : { kind: 'text', text: text.slice(0, LIMITS.textChars) };
    result = await runImport({ text, file }, callModel);
  } else if (body?.action === 'adapt_workout') {
    workflow = 'workout_adaptation';
    proposalType = 'workout_adaptation';
    // Read with the athlete's own rights: a schedule entry they cannot see does not exist here.
    const { data: entry } = await asUser.from('scheduled_workouts').select('id, workout_id, version_id, status, deleted_at').eq('id', String(body.scheduled_id ?? '')).maybeSingle();
    if (!entry || entry.deleted_at) return failure('NOT_FOUND', 'That workout could not be found. Sync and try again.');
    if (entry.status !== 'planned') return failure('INVALID_INPUT', 'Only a workout that is still planned can be adapted.');
    const { data: versionRow } = await asUser.from('workout_versions').select('*, blocks(*, steps(*))').eq('id', entry.version_id).maybeSingle();
    if (!versionRow) return failure('NOT_FOUND', 'That workout could not be found. Sync and try again.');
    original = rowToVersion(versionRow).content;
    constraints = sanitizeConstraints(body.constraints);
    inputMeta = constraintMeta(constraints);
    source = { kind: 'workout', scheduled_id: entry.id, workout_id: entry.workout_id, version_id: entry.version_id };
    result = await runAdaptation(original, constraints, callModel);
  } else if (body?.action === 'revise_proposal') {
    workflow = 'proposal_revision';
    const { data: parent } = await asUser.from('agent_proposals').select('*').eq('id', String(body.proposal_id ?? '')).maybeSingle();
    if (!parent) return failure('NOT_FOUND', 'That draft could not be found.');
    if (parent.status !== 'pending_approval') return failure('INVALID_INPUT', 'That draft has already been decided.');
    proposalType = parent.type;
    parentProposalId = parent.id;
    source = parent.source;
    // An adaptation is always compared with the athlete's actual workout, however many revisions it took.
    original = parent.type === 'workout_adaptation' ? parent.original : null;
    constraints = { ...(parent.constraints ?? {}), note: typeof body.note === 'string' ? body.note : '' };
    inputMeta = { ...constraintMeta(constraints), revision_of: parent.id };
    result = await runAdaptation(parent.content, { note: constraints.note }, callModel);
    if (result.ok && original) result = { ...result, changes: diffWorkouts(original, result.content) };
  } else {
    return failure('INVALID_INPUT', 'Unknown action.');
  }

  const { data: run } = await asService
    .from('agent_runs')
    .insert({
      user_id: user.id,
      workflow,
      status: result.ok ? 'succeeded' : 'failed',
      failure_code: result.ok ? null : result.code,
      model: result.usage.model,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      model_calls: result.usage.modelCalls,
      steps: result.steps,
      input_meta: inputMeta,
      duration_ms: Date.now() - started,
    })
    .select('id')
    .single();

  if (!result.ok) return failure(result.code, result.message);

  const { data: proposal, error } = await asService
    .from('agent_proposals')
    .insert({
      user_id: user.id,
      run_id: run?.id ?? null,
      parent_proposal_id: parentProposalId,
      type: proposalType,
      source,
      constraints,
      content: result.content,
      original,
      changes: result.changes,
      rationale: result.rationale,
      validation: result.validation,
      open_questions: result.openQuestions,
      notices: result.notices,
      model: result.usage.model,
    })
    .select('*')
    .single();

  if (error || !proposal) return failure('STORAGE_FAILED', 'The draft was created but could not be saved. Try again.');
  return json({ ok: true, proposal });
});

// deno-lint-ignore no-explicit-any
function sanitizeConstraints(raw: any) {
  // deno-lint-ignore no-explicit-any
  const out: Record<string, any> = {};
  if (Array.isArray(raw?.equipment)) out.equipment = raw.equipment.filter((e: unknown) => typeof e === 'string').slice(0, 40);
  if (typeof raw?.maxMinutes === 'number') out.maxMinutes = raw.maxMinutes;
  if (raw?.difficulty === 'easier' || raw?.difficulty === 'harder') out.difficulty = raw.difficulty;
  if (raw?.volume === 'less' || raw?.volume === 'more') out.volume = raw.volume;
  if (typeof raw?.note === 'string' && raw.note.trim()) out.note = raw.note;
  return out;
}

// What is logged about a request: which levers were used, never the athlete's words.
// deno-lint-ignore no-explicit-any
function constraintMeta(c: any) {
  return {
    equipment_count: Array.isArray(c?.equipment) ? c.equipment.length : null,
    max_minutes: c?.maxMinutes ?? null,
    difficulty: c?.difficulty ?? null,
    volume: c?.volume ?? null,
    note_chars: typeof c?.note === 'string' ? c.note.length : 0,
  };
}
