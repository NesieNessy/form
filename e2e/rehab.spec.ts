/**
 * Rehab (roadmap Step 8), the athlete's side without an account: noting an
 * injury in their own words, symptom logs with escalation, and workouts
 * checked against what the athlete noted, changed only by their choice.
 * Clinician records need the server and are covered by the database tests.
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

test('an injury is noted in the athlete’s words, with what makes it worse', async () => {
  await app.page.goto('/');
  await app.click('More');
  await app.click('Injuries & Rehab');
  await app.see('No injuries noted.');
  await app.see('it does not diagnose');
  await app.click('Note an Injury');
  await app.click('Knee');
  await app.click('Left');
  await app.page.getByLabel('In your own words').fill('Pain on the outside of the knee after longer runs');
  await app.click('Running');
  await app.click('Jumping and landing');
  await app.click('Save');
  await app.see('Pain on the outside of the knee after longer runs');
  const s = await app.stored();
  expect(s.version).toBe(STORE_VERSION);
  const [episode] = Object.values(s.state.episodes) as { affectedActivities: string[]; status: string }[];
  expect([episode.status, episode.affectedActivities]).toEqual(['reported', ['running', 'jumping']]);
});

test('a symptom entry with a red flag points to prompt care and hides exercise suggestions', async () => {
  const intensity = app.page.locator('div').filter({ has: app.page.getByText('Pain or discomfort (0 none, 10 worst)', { exact: true }) }).filter({ has: app.page.getByText('10', { exact: true }) }).last();
  // The card holds both 0-10 scales; the first is the intensity one.
  await intensity.getByText('6', { exact: true }).first().click();
  await app.click('I cannot put weight on it');
  await app.visible('Save').last().click();
  await app.see('Please get this checked by a doctor promptly');
  await app.see('6/10');
  const s = await app.stored();
  const [log] = Object.values(s.state.symptomLogs) as { intensity: number; redFlags: string[] }[];
  expect([log.intensity, log.redFlags]).toEqual([6, ['cannot_bear_weight']]);
});

test('a planned workout that touches the noted activities is flagged, and changed only on request', async () => {
  await app.page.goto('/');
  await app.click('Workouts');
  await app.click('Run and Jump');
  await app.see('Clashes with your training limits');
  await app.see('Run · running · Limited (your note)');
  await app.see('Box Jump · jumping and landing · Limited (your note)');
  const before = await app.stored();
  const entry = Object.values(before.state.scheduled)[0] as { versionId: string };
  await app.click('Show the Workout Without These');
  await app.see('Use This Version');
  expect((Object.values((await app.stored()).state.scheduled)[0] as { versionId: string }).versionId).toBe(entry.versionId);
  await app.click('Use This Version');
  await app.notSee('Clashes with your training limits');
  const after = await app.stored();
  const moved = Object.values(after.state.scheduled)[0] as { versionId: string };
  expect(moved.versionId).not.toBe(entry.versionId);
  const content = (after.state.versions[moved.versionId] as { content: { blocks: { steps: { name: string; id: string }[] }[] } }).content;
  expect(content.blocks[0].steps.map((s) => s.name)).toEqual(['Air Squat']);
  const old = (after.state.versions[entry.versionId] as { content: { blocks: { steps: { id: string }[] }[] } }).content;
  expect(content.blocks[0].steps[0].id).not.toBe(old.blocks[0].steps[2].id);
  app.expectNoBrowserErrors();
});
