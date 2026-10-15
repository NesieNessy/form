/**
 * Appearance & Language (roadmap Step 14): the web app reloads into the
 * chosen language and theme, and keeps them.
 */
import { expect, test } from '@playwright/test';
import { close, openApp, type App } from './helpers';

let app: App;
test.beforeAll(async ({ browser }) => {
  app = await openApp(browser);
});
test.afterAll(() => close(app));

test('switching to German and light mode reloads the app in both', async () => {
  const { page } = app;
  await page.goto('/');
  await app.click('More');
  await app.click('Appearance & Language');
  await Promise.all([page.waitForEvent('load'), app.click('Deutsch')]);
  await app.see('Darstellung & Sprache');
  await Promise.all([page.waitForEvent('load'), app.click('Hell')]);
  await app.see('Darstellung');
  // The light canvas colour is painted; the dark one is not.
  const painted = await page.evaluate(() => [...document.querySelectorAll('div')].map((d) => getComputedStyle(d).backgroundColor));
  expect(painted).toContain('rgb(247, 249, 252)');
  expect(painted).not.toContain('rgb(11, 18, 32)');
  await page.goto('/');
  await app.see('Workout starten');
  expect(await page.evaluate(() => [localStorage.getItem('form-pref-language'), localStorage.getItem('form-pref-theme')])).toEqual(['de', 'light']);
  app.expectNoBrowserErrors();
});
