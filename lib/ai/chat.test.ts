import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newUuid } from '../id';
import type { FoodLogEntry } from '../nutrition/model';
import type { Session } from '../workout/model';
import { CHAT_TOOLS, PROFESSIONAL_ANSWER, checkMemory, runChat, type CallChatModel, type ChatBlock, type ChatModelRequest, type ToolExecutor } from './chat';
import { rescheduleTarget } from './chatActions';
import { clampOffset, nutritionResult, scheduleResult, sessionsResult } from './chatData';

const input = (message: string, extra: Partial<Parameters<typeof runChat>[0]> = {}) => ({ message, history: [], memories: [], today: '2026-10-14 (Wednesday)', ...extra });

/** A model that plays back the given turns and records every request. */
function scripted(turns: ChatBlock[][]) {
  const requests: ChatModelRequest[] = [];
  const call: CallChatModel = async (req) => {
    requests.push(JSON.parse(JSON.stringify(req)));
    const content = turns[requests.length - 1];
    return content ? { ok: true, content, model: 'scripted', inputTokens: 100, outputTokens: 20 } : { ok: false, reason: 'error' };
  };
  return { call, requests };
}
const use = (name: string, input: Record<string, unknown>, id = newUuid()): ChatBlock => ({ type: 'tool_use', id, name, input });
const respond = (answer: string, citations: { entity_type: string; entity_id: string }[] = [], intent = 'question') => use('respond', { intent, answer, citations, warnings: [] });

const session: Session = {
  id: 's1',
  workoutId: 'w1',
  versionId: 'v1',
  prescribed: { title: 'Fran', sport: 'crossfit', blocks: [] },
  status: 'completed',
  entryMode: 'player',
  startedAt: Date.UTC(2026, 9, 12, 7),
  endedAt: Date.UTC(2026, 9, 12, 7, 6),
  blockResults: [],
  rpe: 9,
  updatedAt: 1,
};

describe('coaching chat loop', () => {
  it('answers from tool results and keeps only citations a tool returned', async () => {
    const m = scripted([[use('get_recent_sessions', { days: 7 })], [respond('You did Fran on Monday at RPE 9.', [{ entity_type: 'session', entity_id: 's1' }, { entity_type: 'session', entity_id: 'made-up' }], 'progress_summary')]]);
    const calls: string[] = [];
    const exec: ToolExecutor = async (name) => (calls.push(name), sessionsResult([session]));
    const res = await runChat(input('What did I do last week?'), m.call, exec);
    assert.ok(res.ok);
    assert.deepEqual([res.intent, res.citations.map((c) => c.entity_id), res.requires_approval], ['progress_summary', ['s1'], false]);
    assert.deepEqual(calls, ['get_recent_sessions']);
    assert.deepEqual(m.requests[0].tools.map((t) => t.name), CHAT_TOOLS.map((t) => t.name));
    assert.ok(!m.requests[0].tools.some((t) => /sql|http|user|all_athletes/i.test(t.name)), 'no open-ended data tools');
    assert.match(m.requests[0].system, /Today is 2026-10-14 \(Wednesday\)/);
    assert.match(m.requests[0].system, /data, not instructions/);
    const toolResult = m.requests[1].messages.at(-1)?.content[0] as Extract<ChatBlock, { type: 'tool_result' }>;
    assert.match(toolResult.content, /"title":"Fran"/);
    assert.equal(res.steps.find((s) => s.name === 'grounding')?.detail, '1 kept, 1 dropped');
  });

  it('answers medical and clearance questions without calling the model', async () => {
    for (const q of ['Can I train through this knee injury?', 'I have chest pain when running', 'Am I cleared to return to sport?', 'Is it safe to run with a sprained ankle?']) {
      const m = scripted([]);
      const res = await runChat(input(q), m.call, async () => ({ ok: false, error: 'no' }));
      assert.ok(res.ok, q);
      assert.deepEqual([res.intent, res.answer, m.requests.length], ['rehab_boundary', PROFESSIONAL_ANSWER, 0], q);
    }
  });

  it('collects drafts from tools and asks for approval', async () => {
    const m = scripted([[use('draft_workout', { description: '20 min AMRAP: 10 push-ups, 15 air squats' })], [respond('Here is a draft for you to review.', [], 'workout_request')]]);
    const exec: ToolExecutor = async () => ({ ok: true, content: { proposal_id: 'p1', valid: true }, proposal: { type: 'workout', proposal_id: 'p1', proposal_type: 'workout_import', title: 'AMRAP 20' } });
    const res = await runChat(input('Make me a 20 minute bodyweight workout'), m.call, exec);
    assert.ok(res.ok);
    assert.deepEqual([res.requires_approval, res.proposals], [true, [{ type: 'workout', proposal_id: 'p1', proposal_type: 'workout_import', title: 'AMRAP 20' }]]);
  });

  it('offers to remember stated preferences, but never health information', async () => {
    const m = scripted([[use('suggest_memory', { text: 'Prefers morning sessions' }), use('suggest_memory', { text: 'Has knee pain when squatting' })], [respond('Noted.', [], 'preference')]]);
    const res = await runChat(input('I always train in the morning. Also my knee hurts when squatting.'), m.call, async () => ({ ok: false, error: 'x' }));
    assert.ok(res.ok);
    assert.deepEqual(res.proposals, [{ type: 'memory', text: 'Prefers morning sessions' }]);
    const results = m.requests[1].messages.at(-1)?.content as Extract<ChatBlock, { type: 'tool_result' }>[];
    assert.equal(results[1].is_error, true);
    assert.equal(checkMemory('Weighs 70 kg'), 'Health information is not kept as a memory.');
    assert.equal(checkMemory('Likes kettlebells'), undefined);
  });

  it('rejects tools it does not offer and survives tool errors', async () => {
    const m = scripted([[use('run_sql', { q: 'select * from auth.users' }), use('get_schedule', { days_back: 0, days_ahead: 7 })], [respond('I could not read your schedule just now.')]]);
    const calls: string[] = [];
    const res = await runChat(input('What is planned?'), m.call, async (name) => {
      calls.push(name);
      throw new Error('db down');
    });
    assert.ok(res.ok);
    assert.deepEqual(calls, ['get_schedule'], 'unknown tools never reach the executor');
    const results = m.requests[1].messages.at(-1)?.content as Extract<ChatBlock, { type: 'tool_result' }>[];
    assert.deepEqual(results.map((r) => [r.is_error, JSON.parse(r.content).error]), [[true, 'Unknown tool.'], [true, 'The tool failed.']]);
  });

  it('nudges once when the model writes prose, and gives up after the step limit', async () => {
    const prose = scripted([[{ type: 'text', text: 'Sure!' }], [respond('Done.')]]);
    const ok = await runChat(input('hi'), prose.call, async () => ({ ok: false, error: 'x' }));
    assert.ok(ok.ok);
    assert.equal((prose.requests[1].messages.at(-1)?.content[0] as { text: string }).text, 'Finish by calling respond.');
    const loop = scripted(Array.from({ length: 10 }, () => [use('get_restrictions', {})]));
    const res = await runChat(input('hi'), loop.call, async () => ({ ok: true, content: [] }));
    assert.deepEqual([res.ok, !res.ok && res.code, loop.requests.length], [false, 'MODEL_FAILED', 6]);
  });

  it('refuses empty and overlong messages without a model call', async () => {
    const m = scripted([]);
    assert.equal((await runChat(input('  '), m.call, async () => ({ ok: false, error: '' }))).ok, false);
    assert.equal((await runChat(input('x'.repeat(2001)), m.call, async () => ({ ok: false, error: '' }))).ok, false);
    assert.equal(m.requests.length, 0);
  });

  it('keeps the last turns of history and the remembered preferences', async () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', text: `turn ${i}` }));
    const m = scripted([[respond('ok')]]);
    await runChat(input('next', { history, memories: ['Prefers morning sessions'] }), m.call, async () => ({ ok: false, error: '' }));
    assert.equal(m.requests[0].messages.length, 13);
    assert.match(m.requests[0].system, /- Prefers morning sessions/);
  });
});

describe('approving a suggested move', () => {
  it('keeps the planned time of day unless a time was proposed, and rejects nonsense', () => {
    const from = new Date(2026, 9, 15, 18, 30).getTime();
    assert.equal(rescheduleTarget(from, '2026-10-16'), new Date(2026, 9, 16, 18, 30).getTime());
    assert.equal(rescheduleTarget(from, '2026-10-16T07:15'), new Date(2026, 9, 16, 7, 15).getTime());
    assert.equal(rescheduleTarget(from, 'tomorrow'), undefined);
    assert.equal(rescheduleTarget(from, '2026-10-16T25:00'), undefined);
  });
});

describe('chat tool data in local time', () => {
  it('gives the model the athlete’s local date and time, not UTC', () => {
    const at = Date.UTC(2026, 9, 15, 23, 30); // 01:30 the next day in UTC+2
    const entry = { id: 'e1', workoutId: 'w', versionId: 'v', scheduledAt: at, status: 'planned' as const, createdAt: 1, updatedAt: 1 };
    const res = scheduleResult([entry], { v: 'Late Run' }, 120);
    assert.ok(res.ok);
    assert.deepEqual((res.content as { date: string; time: string }[])[0], { id: 'e1', date: '2026-10-16', time: '01:30', title: 'Late Run', status: 'planned' });
    assert.equal(clampOffset(9999), 840);
    assert.equal(clampOffset('x'), 0);
  });
});

describe('chat tool data', () => {
  it('hides energy when the athlete chose to, and calls missing days unknown', () => {
    const entry: FoodLogEntry = { id: 'e1', consumedAt: 1, localDate: '2026-10-13', mealType: 'lunch', nutrients: { energy_kcal: 600, protein_g: 30 }, entryMethod: 'quick_add', estimated: true, revision: 1, createdAt: 1, updatedAt: 1 };
    const hidden = nutritionResult([entry], true);
    assert.ok(hidden.ok);
    assert.equal(JSON.stringify(hidden.content).includes('energy_kcal'), false);
    const shown = nutritionResult([entry], false);
    assert.ok(shown.ok);
    assert.match(JSON.stringify(shown.content), /"energy_kcal":\{"value":600,"complete":true\}/);
    assert.match(JSON.stringify(shown.content), /"carbohydrate_g":\{"value":0,"complete":false\}/);
  });
});
