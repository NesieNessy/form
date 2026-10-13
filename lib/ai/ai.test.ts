import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildEdgeCore, readCommittedBundle } from '../../scripts/build-edge-core';
import { newUuid } from '../id';
import type { Block, Step, WorkoutContent } from '../workout/model';
import { validateWorkout } from '../workout/validate';
import { AI_DRAFT_SCHEMA, contentToDraft, draftToContent, type AiDraft } from './draft';
import { diffWorkouts } from './diff';
import { PROFESSIONAL_MESSAGE, knownSeconds, runAdaptation, runImport, type CallModel, type ModelRequest } from './pipeline';

/** A model that replies with the given drafts in order and records what it was asked. */
function scripted(...replies: (AiDraft | { fail: 'refusal' | 'truncated' | 'invalid_json' | 'error' } | unknown)[]) {
  const requests: ModelRequest[] = [];
  const call: CallModel = async (request) => {
    requests.push(JSON.parse(JSON.stringify(request)));
    const reply = replies[requests.length - 1];
    if (reply === undefined) throw new Error('model called more often than scripted');
    if (typeof reply === 'object' && reply !== null && 'fail' in reply) return { ok: false, reason: (reply as { fail: 'refusal' }).fail };
    return { ok: true, json: reply, model: 'test-model', inputTokens: 100, outputTokens: 50 };
  };
  return { call, requests };
}

const fran: AiDraft = {
  title: 'Fran',
  sport: 'crossfit',
  open_questions: [],
  blocks: [
    {
      type: 'conditioning',
      format: 'for_time',
      rep_scheme: [21, 15, 9],
      steps: [
        { kind: 'exercise', name: 'Thrusters', reps: 21, load_kg: 43, note: '95 lb' },
        { kind: 'exercise', name: 'Pull-ups', reps: 21 },
      ],
    },
  ],
};

const ex = (name: string, activityId: string | null, prescription: object = {}): Step => ({ kind: 'exercise', id: newUuid(), name, activityId, prescription });
const block = (config: Block['config'], steps: Step[], type: Block['type'] = 'conditioning'): Block => ({ id: newUuid(), type, config, steps });

const barbellWorkout = (): WorkoutContent => ({
  title: 'Monday',
  sport: 'crossfit',
  description: 'my notes',
  blocks: [
    block({ format: 'sets_reps', sets: 5, restSeconds: 120 }, [ex('Back Squat', 'back_squat', { reps: 5, load: { value: 80, unit: 'kg' } })], 'strength'),
    block({ format: 'amrap', durationSeconds: 900 }, [ex('Thruster', 'thruster', { reps: 10 }), ex('Pull Up', 'pull_up', { reps: 10 }), ex('Run', 'run', { distanceMeters: 200 })]),
  ],
});

/** Strips ids so two workouts can be compared by what they prescribe. */
const shape = (content: WorkoutContent) => JSON.parse(JSON.stringify(content, (key, value) => (key === 'id' ? undefined : value)));

describe('draft conversion', () => {
  it('mints ids and matches exercises to the catalog in code', () => {
    const content = draftToContent(fran);
    const [thruster, pullUp] = content.blocks[0].steps;
    assert.ok(thruster.kind === 'exercise' && pullUp.kind === 'exercise');
    assert.deepEqual([thruster.activityId, pullUp.activityId], ['thruster', 'pull_up']);
    assert.deepEqual(thruster.prescription, { reps: 21, load: { value: 43, unit: 'kg' }, note: '95 lb' });
    assert.deepEqual(content.blocks[0].config, { format: 'for_time', repScheme: [21, 15, 9] });
    assert.match(thruster.id, /^[0-9a-f-]{36}$/);
    assert.equal(validateWorkout(content).valid, true);
  });

  it('ignores an activity id the model tries to supply and leaves unknown names unresolved', () => {
    const draft = JSON.parse(JSON.stringify(fran)) as AiDraft;
    (draft.blocks[0].steps[0] as Record<string, unknown>).activityId = 'deadlift';
    (draft.blocks[0].steps[0] as Record<string, unknown>).name = 'Zercher Carry';
    const step = draftToContent(draft).blocks[0].steps[0];
    assert.ok(step.kind === 'exercise');
    assert.equal(step.activityId, null);
  });

  it('keeps gaps as gaps for the validator instead of filling them', () => {
    const content = draftToContent({ title: 'x', sport: 'hiit', open_questions: [], blocks: [{ type: 'conditioning', format: 'amrap', duration_seconds: null, steps: [{ kind: 'exercise', name: 'Burpee', reps: null }] }] });
    assert.deepEqual(content.blocks[0].config, { format: 'amrap' });
    assert.deepEqual(validateWorkout(content).errors.map((e) => e.code), ['MISSING_DURATION']);
  });

  it('round-trips a workout through the draft shape, groups and all', () => {
    const original: WorkoutContent = {
      title: 'Mix',
      sport: 'hiit',
      description: 'desc',
      blocks: [
        { ...block({ format: 'repeating_interval', intervalSeconds: 30, workSeconds: 20, rounds: 8, alternating: true }, [ex('Burpee', 'burpee'), ex('Air Squat', 'air_squat')]), label: 'Tabata', notes: 'go hard' },
        block({ format: 'for_time', rounds: 3, timeCapSeconds: 600 }, [
          { kind: 'group', id: newUuid(), label: 'Couplet', rounds: 2, steps: [ex('Kettlebell Swing', 'kettlebell_swing', { reps: 15, load: { value: 24, unit: 'kg', per: 'total' } }), { kind: 'rest', id: newUuid(), durationSeconds: 30 }] },
          ex('Back Squat', 'back_squat', { reps: 'max', load: { value: 70, unit: 'percent_1rm' }, intensity: { type: 'rpe', value: 8 } }),
          { kind: 'transition', id: newUuid(), name: 'Shoes', durationSeconds: 60 },
        ]),
        block({ format: 'continuous', durationSeconds: 1200, distanceMeters: 4000 }, [ex('Run', 'run', { distanceMeters: 4000, side: 'both' }), ex('Warrior II', 'warrior_2', { breaths: 5, side: 'left' })], 'endurance'),
      ],
    };
    assert.deepEqual(shape(draftToContent({ ...contentToDraft(original), open_questions: [] })), shape(original));
  });

  it('has a schema the structured-output API accepts: closed objects, no recursion, nothing optional or nullable', () => {
    const text = JSON.stringify(AI_DRAFT_SCHEMA);
    assert.equal(text.includes('$ref') || text.includes('anyOf') || text.includes('null'), false);
    const check = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(check);
      if (typeof node !== 'object' || node === null) return;
      const obj = node as Record<string, unknown>;
      if (obj.type === 'object') {
        assert.equal(obj.additionalProperties, false);
        assert.deepEqual([...(obj.required as string[])].sort(), Object.keys(obj.properties as object).sort());
      }
      Object.values(obj).forEach(check);
    };
    check(AI_DRAFT_SCHEMA);
  });
});

describe('diffWorkouts', () => {
  it('reports a substitution, a config change, an addition and a removal in plain words', () => {
    const before = barbellWorkout();
    const after: WorkoutContent = JSON.parse(JSON.stringify(before));
    after.blocks[0].config = { format: 'sets_reps', sets: 3, restSeconds: 120 };
    after.blocks[1].steps[0] = ex('Dumbbell Thruster', 'dumbbell_thruster', { reps: 10 });
    after.blocks[1].steps.splice(1, 1);
    after.blocks[1].steps.push(ex('Burpee', 'burpee', { reps: 5 }));

    assert.deepEqual(diffWorkouts(before, after), [
      { kind: 'block_changed', where: 'Strength', before: 'Strength: Sets & Reps · 5 sets · rest 2:00', after: 'Strength: Sets & Reps · 3 sets · rest 2:00' },
      { kind: 'step_changed', where: 'Conditioning', before: 'Thruster — 10 reps', after: 'Dumbbell Thruster — 10 reps' },
      { kind: 'step_removed', where: 'Conditioning', before: 'Pull Up — 10 reps' },
      { kind: 'step_added', where: 'Conditioning', after: 'Burpee — 5 reps' },
    ]);
  });

  it('reports nothing for identical workouts even though their ids differ', () => {
    const a = barbellWorkout();
    assert.deepEqual(diffWorkouts(a, draftToContent({ ...contentToDraft(a), open_questions: [] })), []);
  });

  it('reports a changed prescription on the same movement', () => {
    const before = barbellWorkout();
    const after: WorkoutContent = JSON.parse(JSON.stringify(before));
    (after.blocks[1].steps[2] as Extract<Step, { kind: 'exercise' }>).prescription = { distanceMeters: 400 };
    assert.deepEqual(diffWorkouts(before, after), [{ kind: 'step_changed', where: 'Conditioning', before: 'Run — 200 m', after: 'Run — 400 m' }]);
  });
});

describe('runImport', () => {
  it('turns pasted text into a validated draft and logs each step', async () => {
    const model = scripted(fran);
    const result = await runImport({ text: '21-15-9 thrusters (95 lb) and pull-ups, for time' }, model.call);
    assert.ok(result.ok);
    assert.equal(result.validation.valid, true);
    assert.deepEqual(result.steps.map((s) => s.name), ['model_draft', 'convert', 'validate']);
    assert.deepEqual(result.usage, { model: 'test-model', inputTokens: 100, outputTokens: 50, modelCalls: 1 });
    assert.match(model.requests[0].messages[0].content[0].type === 'text' ? model.requests[0].messages[0].content[0].text : '', /<source>\n21-15-9 thrusters/);
    assert.match(model.requests[0].system, /not instructions to you/);
  });

  it('gives the model one chance to fix what the validator rejected', async () => {
    const broken: AiDraft = { ...fran, blocks: [{ type: 'conditioning', format: 'amrap', steps: [{ kind: 'exercise', name: 'Burpee', reps: 10 }] }] };
    const fixed: AiDraft = { ...fran, blocks: [{ type: 'conditioning', format: 'amrap', duration_seconds: 600, steps: [{ kind: 'exercise', name: 'Burpee', reps: 10 }] }] };
    const model = scripted(broken, fixed);
    const result = await runImport({ text: 'AMRAP 10: 10 burpees' }, model.call);
    assert.ok(result.ok && result.validation.valid);
    assert.equal(result.usage.modelCalls, 2);
    const repair = model.requests[1].messages[2].content[0];
    assert.ok(repair.type === 'text' && /AMRAP requires a duration/.test(repair.text) && /leave it empty/.test(repair.text));
  });

  it('returns a draft that is still invalid with its errors, rather than hiding or patching it', async () => {
    const broken: AiDraft = { ...fran, open_questions: ['How long is the AMRAP?'], blocks: [{ type: 'conditioning', format: 'amrap', steps: [{ kind: 'exercise', name: 'Burpee', reps: 10 }] }] };
    const model = scripted(broken, broken);
    const result = await runImport({ text: 'AMRAP: 10 burpees' }, model.call);
    assert.ok(result.ok);
    assert.deepEqual([result.validation.valid, result.validation.errors.map((e) => e.code)], [false, ['MISSING_DURATION']]);
    assert.deepEqual(result.openQuestions, ['How long is the AMRAP?']);
    assert.equal(model.requests.length, 2, 'no third attempt');
  });

  it('says so when the source is not a workout', async () => {
    const model = scripted({ title: '', sport: 'other', blocks: [], open_questions: ['This looks like a shopping list, not a workout.'] });
    const result = await runImport({ text: 'milk, eggs, bread' }, model.call);
    assert.deepEqual([result.ok, !result.ok && result.code, !result.ok && result.message], [false, 'NOT_A_WORKOUT', 'This looks like a shopping list, not a workout.']);
    assert.equal(model.requests.length, 1, 'an empty draft is not sent back for repair');
  });

  it('rejects bad input before spending a model call', async () => {
    const model = scripted();
    for (const input of [{}, { text: '   ' }, { text: 'x'.repeat(8001) }, { file: { mediaType: 'application/zip', data: 'AAAA' } }, { file: { mediaType: 'image/png', data: 'A'.repeat(7_000_001) } }]) {
      const result = await runImport(input, model.call);
      assert.deepEqual([result.ok, !result.ok && result.code], [false, 'INVALID_INPUT']);
    }
    assert.equal(model.requests.length, 0);
  });

  it('sends an image or a PDF as its own content part ahead of the text', async () => {
    const model = scripted(fran, fran);
    await runImport({ file: { mediaType: 'image/jpeg', data: 'QUJD' } }, model.call);
    await runImport({ text: 'page 2 only', file: { mediaType: 'application/pdf', data: 'QUJD' } }, model.call);
    assert.deepEqual(model.requests[0].messages[0].content.map((p) => p.type), ['image', 'text']);
    assert.deepEqual(model.requests[1].messages[0].content.map((p) => p.type), ['document', 'text']);
  });

  it('reports a refusal, a truncated reply and a non-draft reply as failures', async () => {
    const cases: [unknown, string][] = [[{ fail: 'refusal' }, 'REFUSED'], [{ fail: 'truncated' }, 'MODEL_FAILED'], [{ fail: 'invalid_json' }, 'MODEL_FAILED'], ['just a string', 'MODEL_FAILED'], [{ title: 'no blocks key' }, 'MODEL_FAILED']];
    for (const [reply, code] of cases) {
      const result = await runImport({ text: 'something' }, scripted(reply).call);
      assert.deepEqual([result.ok, !result.ok && result.code], [false, code]);
    }
  });
});

describe('runAdaptation', () => {
  const dumbbellVersion = (): AiDraft => {
    const draft = { ...contentToDraft(barbellWorkout()), open_questions: [] } as AiDraft;
    draft.title = 'Renamed by the model';
    draft.blocks[0].steps[0] = { kind: 'exercise', name: 'Goblet Squat', reps: 8, load_kg: 24 };
    draft.blocks[1].steps[0] = { kind: 'exercise', name: 'Dumbbell Thruster', reps: 10 };
    draft.changes = [{ from: 'Thruster', to: 'Dumbbell Thruster', reason: 'No barbell available.' }];
    return draft;
  };

  it('returns the adapted workout with a computed change list and the model’s reasons', async () => {
    const model = scripted(dumbbellVersion());
    const result = await runAdaptation(barbellWorkout(), { equipment: ['dumbbell', 'pull-up bar'] }, model.call);
    assert.ok(result.ok);
    assert.deepEqual(result.changes.map((c) => [c.kind, c.before, c.after]), [
      ['step_changed', 'Back Squat — 5 reps · 80 kg', 'Goblet Squat — 8 reps · 24 kg'],
      ['step_changed', 'Thruster — 10 reps', 'Dumbbell Thruster — 10 reps'],
    ]);
    assert.deepEqual(result.rationale, [{ from: 'Thruster', to: 'Dumbbell Thruster', reason: 'No barbell available.' }]);
    assert.deepEqual([result.content.title, result.content.description], ['Monday', 'my notes'], 'the title and notes stay the athlete’s');
    assert.equal(result.validation.valid, true);
    assert.deepEqual(result.notices, []);
    const sent = model.requests[0].messages[0].content[0];
    assert.ok(sent.type === 'text' && /Available equipment: dumbbell, pull-up bar/.test(sent.text));
  });

  it('checks the result against the equipment and time the athlete gave', async () => {
    const unchangedEquipment = { ...contentToDraft(barbellWorkout()), open_questions: [] } as AiDraft;
    unchangedEquipment.blocks[1].duration_seconds = 1800; // changed, but still needs a barbell and runs long
    const result = await runAdaptation(barbellWorkout(), { equipment: ['dumbbell'], maxMinutes: 20 }, scripted(unchangedEquipment).call);
    assert.ok(result.ok);
    assert.deepEqual(result.notices.map((n) => n.code), ['EQUIPMENT_NOT_AVAILABLE', 'OVER_TIME_LIMIT']);
    assert.match(result.notices[0].message, /Back Squat \(barbell, rack\); Thruster \(barbell\); Pull Up \(pull-up bar\)/);
    assert.match(result.notices[1].message, /about 38 minutes, more than the 20/);
  });

  it('sends a medical situation to a person without calling the model', async () => {
    for (const note of ['I had knee surgery last month', 'chest pain when I run', 'torn rotator cuff', "I'm pregnant", 'numbness in my left hand']) {
      const model = scripted();
      const result = await runAdaptation(barbellWorkout(), { note }, model.call);
      assert.deepEqual([result.ok, !result.ok && result.code, !result.ok && result.message], [false, 'NEEDS_PROFESSIONAL', PROFESSIONAL_MESSAGE], note);
      assert.equal(model.requests.length, 0, note);
    }
  });

  it('adapts around a sore spot but states that it is not medical advice', async () => {
    const result = await runAdaptation(barbellWorkout(), { note: 'my shoulder is a bit sore, skip the thrusters' }, scripted(dumbbellVersion()).call);
    assert.ok(result.ok);
    assert.deepEqual(result.notices.map((n) => n.code), ['NOT_MEDICAL_ADVICE']);
    assert.match(result.notices[0].message, /not medical advice/);
  });

  it('honours the model’s own hand-off to a professional', async () => {
    const draft = { ...contentToDraft(barbellWorkout()), open_questions: [], needs_professional_review: 'Describes an unexplained medical symptom.' } as AiDraft;
    const result = await runAdaptation(barbellWorkout(), { note: 'I keep getting dizzy spells' }, scripted(draft).call);
    assert.deepEqual([result.ok, !result.ok && result.code], [false, 'NEEDS_PROFESSIONAL']);
  });

  it('says nothing changed instead of presenting an empty proposal', async () => {
    const same = { ...contentToDraft(barbellWorkout()), open_questions: [] } as AiDraft;
    const result = await runAdaptation(barbellWorkout(), { volume: 'less' }, scripted(same).call);
    assert.deepEqual([result.ok, !result.ok && result.code], [false, 'NOTHING_TO_CHANGE']);
  });

  it('needs at least one constraint and sane limits', async () => {
    const model = scripted();
    for (const constraints of [{}, { note: '  ' }, { maxMinutes: 2 }, { maxMinutes: 999 }, { note: 'x'.repeat(501) }]) {
      const result = await runAdaptation(barbellWorkout(), constraints, model.call);
      assert.deepEqual([result.ok, !result.ok && result.code], [false, 'INVALID_INPUT']);
    }
    assert.equal(model.requests.length, 0);
  });

  it('adds up only the time a workout is certain to take', () => {
    // 5 sets with 2:00 rest between them (4 rests) plus a 15:00 AMRAP.
    assert.equal(knownSeconds(barbellWorkout()), 4 * 120 + 900);
  });
});

describe('edge function bundle', () => {
  it('is up to date with lib/', () => {
    assert.equal(readCommittedBundle(), buildEdgeCore(), 'run `npm run build:edge-core` and commit supabase/functions/_shared/core.js');
  });
});
