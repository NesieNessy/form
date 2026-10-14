/**
 * Studios (roadmap Step 11) need an account; on a device without one the
 * entry explains that instead of failing. Booking, rosters and reports are
 * covered by supabase/tests/studio.test.ts.
 */
import { test } from '@playwright/test';
import { close, openApp, type App } from './helpers';

let app: App;
test.beforeAll(async ({ browser }) => {
  app = await openApp(browser);
});
test.afterAll(() => close(app));

test('the studio entry explains that it needs an account', async () => {
  await app.page.goto('/');
  await app.click('More');
  await app.click('Studios');
  await app.see('Studios need an account');
  app.expectNoBrowserErrors();
});
