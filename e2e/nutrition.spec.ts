/**
 * Nutrition (roadmap Step 5) without an account: logging from the catalog,
 * quick-adds, corrections, own foods from a label, saved meals, the
 * calorie-free view, rule-based targets that need approval, and fuel logged
 * against a workout.
 */
import { expect, test } from '@playwright/test';
import { STORE_VERSION } from '../lib/workout/state';
import { close, openApp, readFixture, type App } from './helpers';

const field = (app: App, label: string) => app.page.getByLabel(label, { exact: true }).filter({ visible: true }).first();

test.describe('logging food on a fresh device', () => {
  test.describe.configure({ mode: 'serial' });
  let app: App;
  test.beforeAll(async ({ browser }) => {
    app = await openApp(browser);
  });
  test.afterAll(() => close(app));

  test('an empty day says so', async () => {
    await app.page.goto('/');
    await app.click('Health');
    await app.click('Nutrition');
    await app.see('Nothing logged for this day.');
  });

  test('a catalog food is logged by weight with a live preview', async () => {
    await app.click('Add Food or Drink');
    await app.page.getByPlaceholder('Search foods…').fill('oats');
    await app.click('Oats, rolled (dry)');
    await field(app, 'Amount').fill('80');
    await app.see('311 kcal');
    await app.click('Breakfast');
    await app.click('Log It');
    await app.see('Oats, rolled (dry)');
    await app.see('80 g');
  });

  test('a quick-add keeps what was not entered unknown', async () => {
    await app.click('Add Food or Drink');
    await app.click('Quick Add');
    await field(app, 'What was it? (optional)').fill('Restaurant dinner');
    await field(app, 'Energy').fill('800');
    await app.click('Dinner');
    await app.click('Log It');
    await app.see('Restaurant dinner');
    await app.see('1111 kcal');
    await app.see('at least 13.5 g');
    await app.see('not state every value');
  });

  test('an entry is corrected and the totals follow', async () => {
    await app.click('Oats, rolled (dry)');
    await app.see('Edit Entry');
    await field(app, 'Amount').fill('100');
    await app.click('Save Changes');
    await app.see('389 kcal');
    await app.see('1189 kcal');
  });

  test('a label in kilojoules becomes an own food and is logged', async () => {
    await app.click('Add Food or Drink');
    await app.click('New Food');
    await field(app, 'Name').fill('Muesli bar');
    await app.click('Serving');
    await field(app, 'Serving description').fill('1 bar');
    await field(app, 'Serving weight (g, optional)').fill('40');
    await app.click('kJ');
    await field(app, 'Energy').fill('700');
    await field(app, 'Protein').fill('4');
    await field(app, 'Carbohydrate').fill('25');
    await field(app, 'Fat').fill('5');
    await app.click('Save Food');
    await app.see('Muesli bar');
    await app.see('167 kcal');
    await app.click('Snack');
    await app.click('Log It');
    await app.see('Muesli bar');
    const s = await app.stored();
    expect(Object.values(s.state.foods).map((f) => (f as { name: string }).name)).toEqual(['Muesli bar']);
  });

  test('a meal is saved and logged again as separate entries', async () => {
    await app.page.getByText('Save as Meal').filter({ visible: true }).first().click();
    await app.page.getByPlaceholder('e.g. Usual breakfast').fill('Oat breakfast');
    await app.click('Save');
    await app.see('Meal saved');
    await app.click('Add Food or Drink');
    await app.click('Saved Meals');
    await app.see('Oat breakfast');
    await app.click('Log This Meal');
    await expect(app.visible('Oats, rolled (dry)')).toHaveCount(2);
  });

  test('the calorie-free view hides energy everywhere on the day', async () => {
    await app.click('Targets & Settings');
    await app.click('Hide energy (calories)');
    await app.back();
    await app.notSee('kcal');
    await app.see('Protein');
  });

  test('targets cannot be suggested without a weight, and a very low energy target is called out', async () => {
    await app.click('Targets & Settings');
    await app.click('Hide energy (calories)'); // show energy again
    await app.click('Suggest From My Training');
    await app.see('Log your weight under Health & Activities first.');
    await app.click('Set Targets');
    await app.page.getByLabel('From', { exact: true }).filter({ visible: true }).first().fill('1000');
    await app.page.getByLabel('To', { exact: true }).filter({ visible: true }).first().fill('1200');
    await app.click('Save');
    await app.see('very low energy target');
    await app.click('Save'); // saving again after the warning keeps the athlete's choice
    await app.see('Set by you');
    await app.see('1000–1200 kcal');
    app.expectNoBrowserErrors();
  });
});

test.describe('targets and fuel around training', () => {
  test.describe.configure({ mode: 'serial' });
  let app: App;
  test.beforeAll(async ({ browser }) => {
    app = await openApp(browser, readFixture('store-v4.json'));
  });
  test.afterAll(() => close(app));

  test('a v4 store gains the nutrition collections', async () => {
    await app.page.goto('/nutrition');
    await app.see('Nothing logged for this day.');
    const s = await app.stored();
    expect([s.version, s.state.foodLog, s.state.dirty.foodLog]).toEqual([STORE_VERSION, {}, []]);
  });

  test('suggested targets follow the weight and the day, and need approval', async () => {
    await app.click('Targets & Settings');
    await app.click('Suggest From My Training');
    await app.see('Suggested Targets');
    await app.see('latest weight (70 kg)');
    await app.see('85–140 g');
    await app.see('not individual advice');
    expect((await app.stored()).state.profile.nutritionTargets).toBeUndefined();
    await app.click('Use These Targets');
    await app.see("FORM's rules (targets_v1) for 70 kg, approved by you");
    await app.back();
    await app.see('Hard training day · 120 min planned');
    await app.see('420–700 g');
  });

  test('fuel is logged against the completed workout', async () => {
    await app.page.goto('/');
    await app.click('Train');
    await app.visible('Long Ride').first().click();
    await app.see('Training Fuel');
    await app.see('Nothing logged for this session.');
    await app.click('Log Fuel');
    await app.page.getByPlaceholder('Search foods…').fill('gel');
    await app.click('Energy gel (generic)');
    await app.click('Log It');
    await app.see('Energy gel (generic) · 1 × 1 gel · 100 kcal');
    const entry = Object.values((await app.stored()).state.foodLog)[0] as { sessionId?: string; mealType: string };
    expect([!!entry.sessionId, entry.mealType]).toEqual([true, 'during_workout']);
    app.expectNoBrowserErrors();
  });
});
