/**
 * Health and activities (roadmap Step 4) without an account: file import,
 * matching to the plan, duplicates, measurements, baselines and deletion.
 */
import { expect, test } from '@playwright/test';
import { STORE_VERSION } from '../lib/workout/state';
import { close, fixture, openApp, readFixture, type App } from './helpers';

test.describe.configure({ mode: 'serial' });

let app: App;
test.beforeAll(async ({ browser }) => {
  app = await openApp(browser, readFixture('store-v3.json'));
});
test.afterAll(() => close(app));

async function importFile(name: string) {
  const [chooser] = await Promise.all([app.page.waitForEvent('filechooser'), app.click('Import Activity File')]);
  await chooser.setFiles(fixture(name));
}

test('a v3 store is upgraded and keeps the planned run', async () => {
  await app.page.goto('/');
  await app.click('More');
  await app.click('Health & Activities');
  await app.see('No activities yet.');
  const s = await app.stored();
  expect(s.version).toBe(STORE_VERSION);
  expect(s.state.activities).toEqual({});
  expect(Object.keys(s.state.scheduled)).toHaveLength(1);
});

test('a file that is not an activity is refused with a reason', async () => {
  await importFile('notes.txt');
  await app.see("This file couldn't be read.");
});

test('a GPX run is offered the planned run as a likely match', async () => {
  await importFile('morning-run.gpx');
  for (const text of ['Morning Run', '5.40 km', 'Avg HR', 'Planned workouts nearby', 'Easy Run', 'Likely match']) await app.see(text);
});

test('recording it as the result completes the planned workout', async () => {
  await app.click('Record as Result');
  await app.see('View Recording');
  const s = await app.stored();
  const entry = Object.values(s.state.scheduled)[0] as { status: string };
  const session = Object.values(s.state.sessions)[0] as { entryMode: string };
  expect([entry.status, session.entryMode, s.state.dirty.activities.length]).toEqual(['completed', 'import', 1]);
});

test('the same file twice is one activity', async () => {
  await app.page.goto('/health');
  await importFile('morning-run.gpx');
  await app.see('Recorded as a planned workout');
  expect(Object.keys((await app.stored()).state.activities)).toHaveLength(1);
});

test('a second recording of the same run is flagged and can be marked, and undone', async () => {
  await app.page.goto('/health');
  await importFile('phone-run.gpx');
  await app.see('Possibly the same effort');
  await app.click('Same Effort, Keep the Other');
  await app.see('Marked as the same effort as another recording');
  await app.click('Undo');
  await app.see('Possibly the same effort');
  await app.click('Same Effort, Keep the Other');
  await app.see('Marked as the same effort');
});

test('a FIT ride without a plan is logged as its own workout', async () => {
  await app.page.goto('/health');
  await importFile('evening-ride.fit');
  for (const text of ['Ride', '14.40 km', '210 W']) await app.see(text);
  await app.notSee('Planned workouts nearby');
  await app.click('Log as Its Own Workout');
  await app.see('View Recording');
  const s = await app.stored();
  expect([Object.keys(s.state.sessions).length, Object.keys(s.state.workouts).length]).toEqual([2, 2]);
});

test('the health screen lists what was imported', async () => {
  await app.page.goto('/health');
  for (const text of ['Recent Activities', 'Morning Run', 'Run (phone)', '3 activities']) await app.see(text);
  await app.notSee('To Review');
});

test('a measurement is validated, saved, and has no baseline yet', async () => {
  const { page, see, click } = app;
  await click('Add Measurement');
  await click('Save');
  await see('Enter a value');
  await page.getByPlaceholder('–').first().fill('500');
  await click('Save');
  await see('outside the plausible range');
  await page.getByPlaceholder('–').first().fill('52');
  await click('Save');
  await see('52 bpm');
  await see('Your normal appears after 7 more days');
});

test('with a week of history the baseline appears and an unusual value is pointed out', async () => {
  await app.page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('form-workouts-store') as string);
    const day = 86_400_000;
    const local = (ms: number) => {
      const d = new Date(ms);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const add = (metric: string, unit: string, offset: number, value: number) => {
      const at = Date.now() - offset * day - 3_600_000;
      const id = crypto.randomUUID();
      s.state.observations[id] = { id, metric, value, unit, observedAt: at, localDate: local(at), ingestedAt: at, provider: 'manual', origin: 'user_entered', updatedAt: at };
    };
    for (const o of Object.values(s.state.observations) as { value: number }[]) o.value = 61;
    [50, 51, 50, 52, 51, 50, 51, 52].forEach((v, i) => add('resting_hr_bpm', 'bpm', i + 1, v));
    [74.8, 74.5, 74.1].forEach((v, i) => add('weight_kg', 'kg', 20 - i * 10, v));
    localStorage.setItem('form-workouts-store', JSON.stringify(s));
  });
  await app.page.goto('/health');
  for (const text of ['61 bpm', 'Your normal 51 bpm', 'Outside your usual range']) await app.see(text);
  await app.notSee('bpm bpm');
  await app.visible('Resting heart rate').first().click();
  await app.page.locator('svg path').first().waitFor();
});

test('body development shows the real weight trend instead of the sample', async () => {
  await app.page.goto('/body-development');
  await app.see('74.1 kg');
  await app.see('-0.7 kg since');
  await app.notSee('Sample');
  await app.notSee('kg kg');
});

test('deleting imported files removes the activities and keeps the recorded workouts', async () => {
  const { page, see, visible, stored } = app;
  await page.goto('/health');
  await see('61 bpm');
  await see('3 activities');
  const sessionsBefore = Object.keys((await stored()).state.sessions).length;
  const link = page.getByLabel('Delete Data: Imported files');
  await link.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600); // let the scroll settle so the tap lands on the link
  await link.click();
  await see('Delete everything from "Imported files"?');
  // The confirm button sits in the files card, above the next card's own link.
  await visible('Delete Data').first().click();
  await see('No activities yet.');
  const s = await stored();
  const activities = Object.values(s.state.activities) as { deletedAt?: number; series?: unknown }[];
  const sessions = Object.values(s.state.sessions) as { status: string }[];
  expect(activities.filter((a) => !a.deletedAt)).toHaveLength(0);
  expect(activities.some((a) => a.series)).toBe(false);
  expect(sessions.filter((x) => x.status === 'completed')).toHaveLength(sessionsBefore);
  await see('61 bpm'); // measurements are another source
  app.expectNoBrowserErrors();
});
