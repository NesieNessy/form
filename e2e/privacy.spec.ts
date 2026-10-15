/**
 * Provenance and privacy blur (roadmap Step 14): every recovery signal says
 * where it came from, and with "hide health values" on, values show only
 * when tapped.
 */
import { test } from '@playwright/test';
import { close, openApp, readFixture, type App } from './helpers';

test.describe.configure({ mode: 'serial' });

let app: App;
test.beforeAll(async ({ browser }) => {
  app = await openApp(browser, readFixture('store-v5.json'));
});
test.afterAll(() => close(app));

test('recovery signals say where they came from', async () => {
  await app.page.goto('/');
  await app.click('Health');
  await app.click('Recovery');
  await app.see('58 bpm, your normal 51 bpm');
  await app.see('Measurement');
});

test('with privacy on, values stay hidden until tapped', async () => {
  await app.page.goto('/');
  await app.click('More');
  await app.click('Appearance & Language');
  await app.page.getByRole('switch', { name: 'Hide health values until tapped' }).filter({ visible: true }).click();
  await app.page.goto('/');
  await app.click('Health');
  await app.click('Recovery');
  await app.notSee('58 bpm, your normal 51 bpm');
  await app.page.getByRole('button', { name: 'Hidden, tap to show' }).filter({ visible: true }).first().click();
  await app.see('58 bpm, your normal 51 bpm');
  app.expectNoBrowserErrors();
});
