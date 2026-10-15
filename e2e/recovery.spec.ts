/**
 * Recovery (roadmap Step 7) without an account: the day view from the
 * athlete's own normal, the check-in changing it, options that need a
 * choice, and the summary that keeps no values.
 */
import { expect, test } from '@playwright/test';
import { STORE_VERSION } from '../lib/workout/state';
import { close, openApp, readFixture, type App } from './helpers';

test.describe.configure({ mode: 'serial' });

let app: App;
test.beforeAll(async ({ browser }) => {
  app = await openApp(browser, readFixture('store-v5.json'));
});
test.afterAll(() => close(app));

/** Picks a 0-10 answer in the row of the given check-in question. */
async function answer(question: string, value: number) {
  const row = app.page
    .locator('div')
    .filter({ has: app.page.getByText(question, { exact: true }) })
    .filter({ has: app.page.getByText('10', { exact: true }) })
    .last();
  await row.getByText(String(value), { exact: true }).click();
}

test('a v5 store is upgraded, and a poor night against the usual one is pointed out', async () => {
  await app.page.goto('/');
  await app.click('Health');
  await app.click('Recovery');
  await app.see('Some signals suggest taking it easier today.');
  await app.see('58 bpm, your normal 51 bpm');
  await app.see('no check-in today');
  await app.see('Options for Evening Squats');
  await app.see('Make it lighter');
  await app.see('85 kg');
  const s = await app.stored();
  expect([s.version, Object.values(s.state.recovery).length]).toEqual([STORE_VERSION, 1]);
  expect(Object.values(s.state.scheduled).map((e) => (e as { status: string }).status)).toEqual(['planned']);
});

test('feeling clearly fine wins over the device: no suggestion', async () => {
  for (const [q, v] of [['Fatigue', 2], ['Soreness', 1], ['Energy', 9]] as const) await answer(q, v);
  await app.click('Save Check-in');
  await app.see('point different ways. Go by how you feel.');
  await app.notSee('Options for Evening Squats');
});

test('a hard day offers options, and only the choice changes the plan', async () => {
  await app.click('Update Check-in');
  await answer('Fatigue', 8);
  await answer('Energy', 3);
  await app.click('Save Check-in');
  await app.see('Some signals suggest taking it easier today.');
  const before = await app.stored();
  const entry = Object.values(before.state.scheduled)[0] as { versionId: string };
  await app.page.getByLabel('Choose: Make it lighter').click();
  await app.see('You chose: make it lighter.');
  const after = await app.stored();
  const moved = Object.values(after.state.scheduled)[0] as { versionId: string };
  expect(moved.versionId).not.toBe(entry.versionId);
  const day = Object.values(after.state.recovery)[0] as { decision: { option: string }; signals: unknown[] };
  expect(day.decision.option).toBe('lighter');
  // The summary names signals and directions only; the values stay with the athlete.
  expect(day.signals.every((x) => Object.keys(x as object).sort().join() === 'direction,key')).toBe(true);
  expect(Object.keys(day).sort()).toEqual(['createdAt', 'decision', 'id', 'localDate', 'ruleVersion', 'signals', 'status', 'updatedAt']);
  await app.click('Open Workout');
  await app.see('5 reps · 85 kg');
});

test('feeling unwell takes all pressure off', async () => {
  await app.page.goto('/recovery');
  await app.click('Update Check-in');
  await app.click('I feel ill, or have pain or an injury');
  await app.click('Save Check-in');
  await app.see('There is no need to train.');
  app.expectNoBrowserErrors();
});
