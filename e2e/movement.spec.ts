/**
 * Movement clips (roadmap Step 12) are stored privately per account; without
 * one the entry says so. The analysis engine is covered by
 * lib/movement/movement.test.ts and storage access by supabase/tests/movement.test.ts.
 */
import { test } from '@playwright/test';
import { close, openApp, type App } from './helpers';

let app: App;
test.beforeAll(async ({ browser }) => {
  app = await openApp(browser);
});
test.afterAll(() => close(app));

test('the movement entry explains that clips need an account', async () => {
  await app.page.goto('/');
  await app.click('More');
  await app.click('Movement Clips');
  await app.see('Clips need an account');
  app.expectNoBrowserErrors();
});
