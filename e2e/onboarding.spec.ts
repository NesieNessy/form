/**
 * First run (roadmap Step 13): a new device starts with the short setup,
 * the choices land in the profile, and the setup does not come back.
 */
import { expect, test } from '@playwright/test';
import { close, openApp } from './helpers';

test('a new device starts with the setup, and it is not shown again', async ({ browser }) => {
  const app = await openApp(browser, undefined, { firstRun: true });
  await app.page.goto('/');
  await app.see('Welcome to FORM');
  await app.see('The assistant only writes drafts.');
  await app.click('Continue');
  await app.click('Running');
  await app.click('Continue');
  await app.click('Skip this step');
  await app.see('Step 4 of 4');
  await app.click('Start Training');
  await app.see('Shortcuts');
  const s = await app.stored();
  expect(s.state.profile.sports).toEqual(['running']);
  await app.page.goto('/');
  await app.see('Shortcuts');
  await app.notSee('Welcome to FORM');
  app.expectNoBrowserErrors();
  await close(app);
});
