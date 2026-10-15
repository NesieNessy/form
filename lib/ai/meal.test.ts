import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATALOG } from '../nutrition/catalog';
import { resolveDraftItem } from '../nutrition/draft';
import { logFood } from '../nutrition/state';
import type { Food } from '../nutrition/model';
import { EMPTY_DATA } from '../workout/state';
import { MEAL_SCHEMA, SUPPORT_MESSAGE, runMealParse } from './meal';
import type { CallModel, ModelRequest } from './pipeline';

/** A scripted model: returns the given JSON and records what it was asked. */
function scripted(json: unknown) {
  const calls: ModelRequest[] = [];
  const call: CallModel = async (request) => {
    calls.push(request);
    return { ok: true, json, model: 'scripted', inputTokens: 10, outputTokens: 5 };
  };
  return { call, calls };
}

const item = (o: Record<string, unknown>) => ({ name: 'x', food_id: '', amount: 0, unit: 'unspecified', serving_label: '', estimated: false, ...o });

describe('meal parsing pipeline', () => {
  it('sends the foods to choose from and the text as data, with the strict schema', async () => {
    const m = scripted({ items: [item({ name: 'oats', food_id: 'catalog:oats', amount: 80, unit: 'g' })], open_questions: [], not_food: false });
    const res = await runMealParse('Oats 80 g', [{ id: 'mine-1', name: 'Protein bar' }], m.call);
    assert.ok(res.ok);
    const req = m.calls[0];
    assert.equal(req.schema, MEAL_SCHEMA);
    assert.match(req.system, /mine-1 \| Protein bar/);
    assert.match(req.system, /catalog:oats \| Oats, rolled \(dry\)/);
    assert.match(req.system, /Never state calories/);
    assert.deepEqual(req.messages[0].content, [{ type: 'text', text: 'Meal description:\n<meal>\nOats 80 g\n</meal>' }]);
    assert.deepEqual(res.draft.items, [{ name: 'oats', foodId: 'catalog:oats', amount: 80, unit: 'g', servingLabel: null, estimated: false }]);
    assert.equal(res.usage.modelCalls, 1);
  });

  it('drops ids that were not offered and amounts that are missing or absurd', async () => {
    const m = scripted({
      items: [
        item({ name: 'yogurt', food_id: 'catalog:made_up', amount: 150, unit: 'g' }),
        item({ name: 'berries', food_id: 'catalog:blueberries', amount: 0, unit: 'unspecified' }),
        item({ name: 'milk', food_id: 'catalog:milk_whole', amount: 90000, unit: 'ml' }),
        item({ name: '   ' }),
      ],
      open_questions: ['  ', 'Which yogurt?'],
      not_food: false,
    });
    const res = await runMealParse('yogurt 150 g, berries, a lot of milk', [], m.call);
    assert.ok(res.ok);
    assert.deepEqual(
      res.draft.items.map((i) => [i.name, i.foodId, i.amount, i.unit]),
      [
        ['yogurt', null, 150, 'g'],
        ['berries', 'catalog:blueberries', null, null],
        ['milk', 'catalog:milk_whole', null, null],
      ]
    );
    assert.deepEqual(res.draft.openQuestions, ['Which yogurt?']);
  });

  it('turns text about disordered eating towards support, without calling the model', async () => {
    for (const text of ['I binged on cereal and want to purge', 'I am starving myself this week', 'fasting for 5 days, logging water']) {
      const m = scripted({});
      const res = await runMealParse(text, [], m.call);
      assert.deepEqual([res.ok, !res.ok && res.code, !res.ok && res.message], [false, 'NEEDS_SUPPORT', SUPPORT_MESSAGE], text);
      assert.equal(m.calls.length, 0);
    }
  });

  it('says so when the text is not about food', async () => {
    const res = await runMealParse('Write me a poem', [], scripted({ items: [], open_questions: ['That is not a meal.'], not_food: true }).call);
    assert.deepEqual([res.ok, !res.ok && res.code, !res.ok && res.message], [false, 'NOT_FOOD', 'That is not a meal.']);
  });

  it('refuses empty or overlong input and reports model failures', async () => {
    const m = scripted({});
    assert.equal((await runMealParse('  ', [], m.call)).ok, false);
    assert.equal((await runMealParse('x'.repeat(1001), [], m.call)).ok, false);
    assert.equal(m.calls.length, 0);
    const broken: CallModel = async () => ({ ok: false, reason: 'invalid_json' });
    const res = await runMealParse('toast', [], broken);
    assert.deepEqual([res.ok, !res.ok && res.code], [false, 'MODEL_FAILED']);
  });
});

describe('reviewing a meal draft', () => {
  const own: Food = { id: 'mine-1', name: 'Protein bar', basis: 'per_serving', nutrients: { energy_kcal: 200, protein_g: 20 }, servings: [{ label: '1 bar', grams: 60 }], source: 'user', createdAt: 1, updatedAt: 1 };

  it('resolves a matched food and a written amount into a loggable quantity', () => {
    const r = resolveDraftItem({ name: 'oats', foodId: 'catalog:oats', amount: 80, unit: 'g', servingLabel: null, estimated: false }, []);
    assert.deepEqual([r.food?.id, r.quantity], ['catalog:oats', { value: 80, unit: 'g' }]);
    const logged = logFood(EMPTY_DATA, r.food as Food, r.quantity!, { mealType: 'breakfast', consumedAt: Date.now() - 1000, entryMethod: 'ai_draft', estimated: r.estimated }, Date.now());
    assert.ok(logged.ok);
    assert.equal(logged.data.foodLog[logged.entryId].entryMethod, 'ai_draft');
  });

  it('matches a portion word to the food’s servings, and marks an unknown one as an estimate', () => {
    const banana = resolveDraftItem({ name: 'banana', foodId: 'catalog:banana', amount: 1, unit: 'serving', servingLabel: 'medium', estimated: false }, []);
    assert.deepEqual([banana.quantity, banana.estimated], [{ value: 1, unit: 'serving', servingLabel: '1 medium' }, false]);
    const bowl = resolveDraftItem({ name: 'oats', foodId: 'catalog:oats', amount: 1, unit: 'serving', servingLabel: 'bowl', estimated: false }, []);
    assert.deepEqual([bowl.quantity?.servingLabel, bowl.estimated], ['1/2 cup', true]);
  });

  it('finds the athlete’s own foods and leaves impossible units for the athlete', () => {
    assert.equal(resolveDraftItem({ name: 'bar', foodId: 'mine-1', amount: 2, unit: 'serving', servingLabel: null, estimated: false }, [own]).quantity?.value, 2);
    const oatsInMl = resolveDraftItem({ name: 'oats', foodId: 'catalog:oats', amount: 200, unit: 'ml', servingLabel: null, estimated: false }, []);
    assert.deepEqual([oatsInMl.food?.id, oatsInMl.quantity], ['catalog:oats', undefined]);
    const unknown = resolveDraftItem({ name: 'kimchi', foodId: null, amount: 50, unit: 'g', servingLabel: null, estimated: false }, []);
    assert.deepEqual([unknown.food, unknown.quantity], [undefined, undefined]);
    assert.ok(CATALOG.length > 40);
  });
});
