// FORM assistant — AI workout import and adaptation (roadmap Step 3), meal parsing (Step 5) and the coaching chat (Step 9).
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
import {
  checkWorkout,
  clampOffset,
  diffWorkouts,
  LIMITS,
  MEAL_LIMITS,
  nutritionResult,
  recoveryResult,
  rowToFoodLog,
  rowToRecovery,
  rowToScheduled,
  rowToSession,
  rowToVersion,
  runAdaptation,
  runChat,
  runImport,
  runMealParse,
  scheduleResult,
  sessionsResult,
  TAG_LABEL,
  workoutResult,
} from '../_shared/core.js';

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

  // The coaching chat: one turn, with tools that read as the athlete and only ever create drafts.
  if (body?.action === 'chat') {
    const message = typeof body.message === 'string' ? body.message : '';
    const today = typeof body.today === 'string' ? body.today.slice(0, 40) : new Date().toISOString().slice(0, 10);
    let conversationId: string | null = typeof body.conversation_id === 'string' ? body.conversation_id : null;
    if (conversationId) {
      const { data: conv } = await asUser.from('chat_conversations').select('id').eq('id', conversationId).maybeSingle();
      if (!conv) conversationId = null;
    }
    const { data: past } = conversationId
      ? await asUser.from('chat_messages').select('role, content').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(12)
      : { data: [] };
    const { data: memoryRows } = await asUser.from('coach_memories').select('text').order('created_at');
    const history = (past ?? []).reverse().map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, text: m.content }));
    const memories = (memoryRows ?? []).map((m: { text: string }) => m.text);

    const chat = await runChat({ message, history, memories, today }, callChatModel, chatTools(asUser, asService, user.id, clampOffset(body.utc_offset_minutes)));
    await asService.from('agent_runs').insert({
      user_id: user.id,
      workflow: 'chat',
      status: chat.ok ? 'succeeded' : 'failed',
      failure_code: chat.ok ? null : chat.code,
      model: chat.usage.model,
      input_tokens: chat.usage.inputTokens,
      output_tokens: chat.usage.outputTokens,
      model_calls: chat.usage.modelCalls,
      steps: chat.steps,
      input_meta: { message_chars: message.length, history_turns: history.length, memories: memories.length, intent: chat.ok ? chat.intent : null },
      duration_ms: Date.now() - started,
    });
    if (!chat.ok) return failure(chat.code, chat.message);

    if (!conversationId) {
      const { data: conv } = await asService.from('chat_conversations').insert({ user_id: user.id, title: message.trim().slice(0, 60) }).select('id').single();
      conversationId = conv?.id ?? null;
    }
    const reply = { intent: chat.intent, answer: chat.answer, citations: chat.citations, proposals: chat.proposals, warnings: chat.warnings, requires_approval: chat.requires_approval };
    if (conversationId) {
      await asService.from('chat_messages').insert([
        { conversation_id: conversationId, user_id: user.id, role: 'user', content: message.trim(), payload: {} },
        { conversation_id: conversationId, user_id: user.id, role: 'assistant', content: chat.answer, payload: reply },
      ]);
      await asService.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
    }
    return json({ ok: true, conversation_id: conversationId, reply });
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

// ------------------------------------------------------------------ chat

type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

// The chat's model call with tools. Forcing a tool is not supported for this model; runChat nudges it to respond instead.
async function callChatModel(request: { system: string; messages: { role: 'user' | 'assistant'; content: Block[] }[]; tools: { name: string; description: string; input_schema: object }[] }) {
  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: request.system,
      tools: request.tools,
      output_config: { effort: 'medium' },
      messages: request.messages,
      // deno-lint-ignore no-explicit-any
    } as any);
    if (response.stop_reason === 'refusal') return { ok: false as const, reason: 'refusal' as const };
    if (response.stop_reason === 'max_tokens') return { ok: false as const, reason: 'truncated' as const };
    const content = response.content
      // deno-lint-ignore no-explicit-any
      .filter((b: any) => b.type === 'text' || b.type === 'tool_use')
      // deno-lint-ignore no-explicit-any
      .map((b: any) => (b.type === 'text' ? { type: 'text', text: b.text } : { type: 'tool_use', id: b.id, name: b.name, input: b.input ?? {} }));
    const usage = response.usage;
    return {
      ok: true as const,
      content,
      model: response.model,
      inputTokens: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
      outputTokens: usage.output_tokens ?? 0,
    };
  } catch (error) {
    if (error instanceof Anthropic.BadRequestError) return { ok: false as const, reason: 'error' as const, detail: `bad_request: ${error.message}`.slice(0, 300) };
    return { ok: false as const, reason: 'error' as const, detail: error instanceof Anthropic.APIError ? `api_${error.status}` : 'network' };
  }
}

const clamp = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/**
 * The chat's tools. Reads go through `db`, the athlete's own client, so
 * row-level security limits them to the athlete's records. The only writes
 * are drafts (proposals) and the run log, through `service`.
 */
// deno-lint-ignore no-explicit-any
function chatTools(db: any, service: any, userId: string, offset: number) {
  const activeLimits = async () => {
    const [{ data: restrictions }, { data: episodes }] = await Promise.all([
      db.from('activity_restrictions').select('id, tags, rule, expires_on').eq('status', 'active'),
      db.from('injury_episodes').select('affected_activities, status').is('deleted_at', null),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    // deno-lint-ignore no-explicit-any
    const clinician = (restrictions ?? []).filter((r: any) => !r.expires_on || r.expires_on >= today);
    // deno-lint-ignore no-explicit-any
    const self = [...new Set((episodes ?? []).filter((e: any) => e.status !== 'resolved').flatMap((e: any) => e.affected_activities ?? []))] as string[];
    return { clinician, self };
  };

  // deno-lint-ignore no-explicit-any
  const logInnerRun = async (workflow: string, result: any) =>
    service.from('agent_runs').insert({
      user_id: userId,
      workflow,
      status: result.ok ? 'succeeded' : 'failed',
      failure_code: result.ok ? null : result.code,
      model: result.usage.model,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      model_calls: result.usage.modelCalls,
      steps: result.steps,
      input_meta: { via: 'chat' },
      duration_ms: 0,
    });

  return async (name: string, input: Record<string, unknown>) => {
    switch (name) {
      case 'get_recent_sessions': {
        const { data, error } = await db.from('sessions').select('*, session_results(*)').eq('status', 'completed').is('deleted_at', null).gte('started_at', daysAgo(clamp(input.days, 1, 56, 14)));
        if (error) return { ok: false as const, error: 'Could not read sessions.' };
        return sessionsResult((data ?? []).map(rowToSession), offset);
      }
      case 'get_schedule': {
        const from = daysAgo(clamp(input.days_back, 0, 28, 0));
        const to = new Date(Date.now() + clamp(input.days_ahead, 0, 28, 7) * 86_400_000).toISOString();
        const { data, error } = await db.from('scheduled_workouts').select('*').is('deleted_at', null).gte('scheduled_at', from).lte('scheduled_at', to);
        if (error) return { ok: false as const, error: 'Could not read the schedule.' };
        // deno-lint-ignore no-explicit-any
        const ids = [...new Set((data ?? []).map((r: any) => r.version_id))];
        const { data: versions } = ids.length ? await db.from('workout_versions').select('id, title').in('id', ids) : { data: [] };
        // deno-lint-ignore no-explicit-any
        const titles = Object.fromEntries((versions ?? []).map((v: any) => [v.id, v.title]));
        return scheduleResult((data ?? []).map(rowToScheduled), titles, offset);
      }
      case 'get_workout': {
        const { data: entry } = await db.from('scheduled_workouts').select('*').eq('id', String(input.scheduled_id ?? '')).is('deleted_at', null).maybeSingle();
        if (!entry) return { ok: false as const, error: 'No planned workout with that id.' };
        const { data: version } = await db.from('workout_versions').select('*, blocks(*, steps(*))').eq('id', entry.version_id).maybeSingle();
        if (!version) return { ok: false as const, error: 'That workout could not be read.' };
        return workoutResult(entry.id, rowToVersion(version).content, new Date(new Date(entry.scheduled_at).getTime() + offset * 60_000).toISOString().slice(0, 10));
      }
      case 'get_recovery': {
        const { data, error } = await db.from('daily_recovery').select('*').is('deleted_at', null).gte('local_date', daysAgo(clamp(input.days, 1, 14, 7)).slice(0, 10));
        if (error) return { ok: false as const, error: 'Could not read recovery.' };
        return recoveryResult((data ?? []).map(rowToRecovery));
      }
      case 'get_restrictions': {
        const { clinician, self } = await activeLimits();
        return {
          ok: true as const,
          // deno-lint-ignore no-explicit-any
          content: { from_physio: clinician.map((r: any) => ({ id: r.id, movements: r.tags.map((t: string) => TAG_LABEL[t] ?? t), rule: r.rule, until: r.expires_on })), noted_by_athlete: self.map((t) => TAG_LABEL[t] ?? t) },
          // deno-lint-ignore no-explicit-any
          citations: clinician.map((r: any) => ({ entity_type: 'restriction' as const, entity_id: r.id, label: 'Training limit' })),
        };
      }
      case 'get_nutrition_days': {
        const since = daysAgo(clamp(input.days, 1, 7, 7)).slice(0, 10);
        const [{ data, error }, { data: profile }] = await Promise.all([db.from('food_log_entries').select('*').is('deleted_at', null).gte('local_date', since), db.from('profiles').select('hide_energy').maybeSingle()]);
        if (error) return { ok: false as const, error: 'Could not read the food log.' };
        return nutritionResult((data ?? []).map(rowToFoodLog), !!profile?.hide_energy);
      }
      case 'draft_workout': {
        const description = typeof input.description === 'string' ? input.description.slice(0, LIMITS.textChars) : '';
        const result = await runImport({ text: description }, callModel);
        await logInnerRun('workout_import', result);
        if (!result.ok) return { ok: false as const, error: result.message };
        const { clinician, self } = await activeLimits();
        const limits = [
          // deno-lint-ignore no-explicit-any
          ...clinician.map((r: any) => ({ source: 'clinician', rule: r.rule, tags: r.tags, restrictionId: r.id, episodeId: '' })),
          ...(self.length ? [{ source: 'self', rule: 'limit', tags: self, episodeId: '' }] : []),
        ];
        const check = checkWorkout(result.content, limits);
        const warnings = check.conflicts.length ? [`This draft includes movements you are limited in: ${[...new Set(check.conflicts.map((c: { stepName: string }) => c.stepName))].join(', ')}.`] : [];
        const { data: proposal } = await service
          .from('agent_proposals')
          .insert({ user_id: userId, type: 'workout_import', source: { kind: 'text', text: description }, content: result.content, validation: result.validation, open_questions: result.openQuestions, notices: result.notices, changes: [], rationale: [], model: result.usage.model })
          .select('id')
          .single();
        if (!proposal) return { ok: false as const, error: 'The draft could not be saved.' };
        return {
          ok: true as const,
          content: { proposal_id: proposal.id, title: result.content.title, valid: result.validation.valid, open_questions: result.openQuestions, warnings },
          proposal: { type: 'workout' as const, proposal_id: proposal.id, proposal_type: 'workout_import' as const, title: result.content.title },
          warnings,
        };
      }
      case 'draft_adaptation': {
        const { data: entry } = await db.from('scheduled_workouts').select('id, workout_id, version_id, status, deleted_at').eq('id', String(input.scheduled_id ?? '')).maybeSingle();
        if (!entry || entry.deleted_at) return { ok: false as const, error: 'No planned workout with that id.' };
        if (entry.status !== 'planned') return { ok: false as const, error: 'Only a workout that is still planned can be changed.' };
        const { data: versionRow } = await db.from('workout_versions').select('*, blocks(*, steps(*))').eq('id', entry.version_id).maybeSingle();
        if (!versionRow) return { ok: false as const, error: 'That workout could not be read.' };
        const original = rowToVersion(versionRow).content;
        const { clinician, self } = await activeLimits();
        // deno-lint-ignore no-explicit-any
        const avoid = [...new Set([...clinician.flatMap((r: any) => r.tags), ...self])].map((t) => TAG_LABEL[t as string] ?? t);
        const note = [typeof input.note === 'string' ? input.note.slice(0, 400) : '', avoid.length ? `Leave out or replace movements involving: ${avoid.join(', ')} (training limits).` : ''].filter(Boolean).join(' ');
        const constraints = sanitizeConstraints({ maxMinutes: input.max_minutes, difficulty: input.difficulty, volume: input.volume, note });
        const result = await runAdaptation(original, constraints, callModel);
        await logInnerRun('workout_adaptation', result);
        if (!result.ok) return { ok: false as const, error: result.message };
        const { data: proposal } = await service
          .from('agent_proposals')
          .insert({
            user_id: userId,
            type: 'workout_adaptation',
            source: { kind: 'workout', scheduled_id: entry.id, workout_id: entry.workout_id, version_id: entry.version_id },
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
          .select('id')
          .single();
        if (!proposal) return { ok: false as const, error: 'The draft could not be saved.' };
        return {
          ok: true as const,
          content: { proposal_id: proposal.id, changes: result.changes.length, notices: result.notices.map((n: { message: string }) => n.message) },
          proposal: { type: 'workout' as const, proposal_id: proposal.id, proposal_type: 'workout_adaptation' as const, title: original.title },
        };
      }
      case 'propose_reschedule': {
        const date = String(input.new_date ?? '');
        const time = typeof input.new_time === 'string' && /^\d{2}:\d{2}$/.test(input.new_time) ? input.new_time : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false as const, error: 'Give the new date as YYYY-MM-DD.' };
        const target = new Date(`${date}T12:00:00Z`).getTime();
        if (!(Math.abs(target - Date.now()) < 90 * 86_400_000)) return { ok: false as const, error: 'That date is too far away.' };
        const { data: entry } = await db.from('scheduled_workouts').select('id, version_id, scheduled_at, status, deleted_at').eq('id', String(input.scheduled_id ?? '')).maybeSingle();
        if (!entry || entry.deleted_at || entry.status !== 'planned') return { ok: false as const, error: 'No planned workout with that id.' };
        const { data: version } = await db.from('workout_versions').select('title').eq('id', entry.version_id).maybeSingle();
        const title = version?.title ?? 'Workout';
        return {
          ok: true as const,
          content: { proposed: true, note: 'The athlete sees the change and decides.' },
          proposal: { type: 'reschedule' as const, scheduled_id: entry.id, title, from: entry.scheduled_at, to: time ? `${date}T${time}` : date },
          citations: [{ entity_type: 'scheduled_workout' as const, entity_id: entry.id, label: title }],
        };
      }
      default:
        return { ok: false as const, error: 'Unknown tool.' };
    }
  };
}