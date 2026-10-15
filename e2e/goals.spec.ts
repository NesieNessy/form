/**
 * Goals (roadmap Step 10) without an account: setting a goal, progress
 * from a recorded result, a changed target kept in the history, and the
 * athlete's own status changes.
 */
import { expect, test } from '@playwright/test';
import { STORE_VERSION } from '../lib/workout/state';
import { close, openApp, readFixture, type App } from './helpers';

test.describe.configure({ mode: 'serial' });

let app: App;
test.beforeAll(async ({ browser }) => {
  app = await openApp(browser, readFixture('store-v6.json'));
});
test.afterAll(() => close(app));

const field = (label: string) => app.page.getByLabel(label, { exact: true }).filter({ visible: true }).first();
const ymd = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('a v6 store is upgraded, and a lift goal without a result says it has no starting point', async () => {
  await app.page.goto('/');
  await app.click('Progress');
  await app.click('Goals');
  await app.see('No goals yet.');
  await app.click('New Goal');
  await field('Target (kg)').fill('140');
  await app.see('No comparable result yet, so there is no starting point.');
  await app.click('Save Goal');
  await app.see('Nothing comparable recorded yet.');
  const s = await app.stored();
  expect(s.version).toBe(STORE_VERSION);
  const goals = Object.values(s.state.goals) as { title: string; target: number; status: string; baseline?: unknown }[];
  expect(goals.map((g) => [g.title, g.target, g.status, g.baseline])).toEqual([['Back Squat 140 kg', 140, 'active', undefined]]);
});

test('a recorded 1RM shows up as evidence, and a changed target is kept in the history', async () => {
  const now = Date.now();
  await app.page.evaluate(
    ({ day, now }) => {
      const s = JSON.parse(localStorage.getItem('form-workouts-store')!);
      const id = '9b000000-0000-4000-8000-000000000001';
      s.state.benchmarks[id] = { id, kind: 'one_rep_max', activityId: 'back_squat', value: 125, unit: 'kg', measuredOn: day, source: 'tested', createdAt: now, updatedAt: now };
      localStorage.setItem('form-workouts-store', JSON.stringify(s));
    },
    { day: ymd(now), now }
  );
  await app.page.reload();
  await app.see('Best: 125 kg, target 140 kg. Based on 1 result.');
  await app.click('Change Target or Date');
  await field('Target').fill('130');
  await field('Why? (optional, kept in the history)').fill('Back after a break');
  await app.click('Save Change');
  await app.see('Target: 140 kg → 130 kg');
  await app.see('Back after a break');
  const goal = Object.values((await app.stored()).state.goals)[0] as { target: number; revisions: unknown[]; progress: { current: number } };
  expect([goal.target, goal.revisions.length, goal.progress.current]).toEqual([130, 1, 125]);
});

test('pausing, sharing and stopping are the athlete’s; achieved is not', async () => {
  await app.click('Pause');
  await app.see('Resume');
  await app.page.getByRole('switch', { name: 'Show to my coach' }).filter({ visible: true }).click();
  await app.click('Stop This Goal');
  const goal = Object.values((await app.stored()).state.goals)[0] as { status: string; visibility: string; revisions: { changes: Record<string, unknown> }[] };
  expect([goal.status, goal.visibility]).toEqual(['abandoned', 'shared']);
  await app.notSee('Change Target or Date');
  await app.click('Delete Goal');
  await app.see('No goals yet.');
  app.expectNoBrowserErrors();
});
