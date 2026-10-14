/**
 * Athlete data without an account: profile, benchmarks, export and deleting
 * everything on the device. Starts from a store written by the Step 1 build.
 */
import { expect, test } from '@playwright/test';
import { readFileSync, unlinkSync } from 'node:fs';
import { close, openApp, type App } from './helpers';

test.describe.configure({ mode: 'serial' });

const V2 = {
  state: {
    ownerUserId: null,
    workouts: {},
    versions: {},
    scheduled: {},
    sessions: {},
    dirty: { versions: [], workouts: [], scheduled: [], sessions: [] },
    settings: { weeklySessionTarget: 3 },
  },
  version: 2,
};

let app: App;
test.beforeAll(async ({ browser }) => {
  app = await openApp(browser, V2);
});
test.afterAll(() => close(app));

const nameField = () => app.page.getByPlaceholder('How should people you share with see you?');

test('an older store keeps its weekly target', async () => {
  await app.page.goto('/');
  await app.see('0 / 3 Workouts');
});

test('profile edits apply', async () => {
  const { page, see, click } = app;
  await click('More');
  await click('Profile');
  await nameField().fill('Local Athlete');
  await click('CrossFit');
  await click('Barbell');
  await click('Mon');
  await see('3 sessions per week');
  await page.locator('svg.lucide-plus').first().click();
  await see('4 sessions per week');
});

test('benchmarks are validated and kept with their history', async () => {
  const { page, see, click } = app;
  await click('Add Benchmark');
  await click('Save');
  await see('Choose which lift this is for.');
  await see('Enter a value above zero.');
  await click('Deadlift');
  await page.getByPlaceholder('–').first().fill('2000');
  await click('Save');
  await see('outside the plausible range');
  await page.getByPlaceholder('–').first().fill('140');
  await click('Save');
  await see('Deadlift 1RM');
  await see('140 kg');
  await click('Add Benchmark');
  await click('Threshold pace (run)');
  const fields = page.getByPlaceholder('–');
  await fields.nth(0).fill('4');
  await fields.nth(1).fill('15');
  await click('Save');
  await see('4:15 /km');
});

test('everything persists across a reload', async () => {
  const { page, see, click } = app;
  await page.goto('/');
  await see('0 / 4 Workouts');
  await click('More');
  await click('Profile');
  await see('Deadlift 1RM');
  await expect(nameField()).toHaveValue('Local Athlete');
});

test('the export downloads what is on the device', async () => {
  const { page, see, click, back } = app;
  await back();
  await click('Sharing & Privacy');
  await see('Sharing needs an account');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), click('Export My Data')]);
  const file = await download.path();
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  expect([doc.format, doc.device.profile.displayName, doc.device.profile.weeklySessionTarget, Object.keys(doc.device.benchmarks).length, 'account' in doc]).toEqual([
    'form-export-v1',
    'Local Athlete',
    4,
    2,
    false,
  ]);
  unlinkSync(file);
  await see('Your export is ready.');
});

test('deleting device data needs the typed word, then wipes everything', async () => {
  const { page, see, click } = app;
  await click('Delete Data on This Device');
  await click('Delete Forever'); // nothing typed: nothing happens
  await page.waitForTimeout(500);
  await see('Type DELETE to confirm.');
  await page.getByPlaceholder('DELETE').fill('DELETE');
  await click('Delete Forever');
  await page.goto('/');
  await see('0 / 5 Workouts');
  await click('More');
  await click('Profile');
  await see('No benchmarks recorded yet.');
  app.expectNoBrowserErrors();
});
