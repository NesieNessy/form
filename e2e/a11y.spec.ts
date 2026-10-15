/**
 * Accessibility checks on the web build (roadmap Step 14): axe on key
 * screens in both themes, no horizontal scrolling at 320 px, and the main
 * action reachable by keyboard.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { close, openApp, readFixture } from './helpers';

const SCREENS = ['/', '/workouts', '/progress', '/health-hub', '/more', '/nutrition', '/recovery', '/goals-forecast', '/settings'];

for (const theme of ['dark', 'light'] as const) {
  test(`no serious accessibility problems on key screens (${theme})`, async ({ browser }) => {
    const app = await openApp(browser, readFixture('store-v6.json'));
    await app.page.addInitScript((t) => localStorage.setItem('form-pref-theme', t), theme);
    const found: string[] = [];
    for (const route of SCREENS) {
      await app.page.goto(route);
      await app.page.waitForTimeout(800);
      const result = await new AxeBuilder({ page: app.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      for (const v of result.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
        found.push(`${route} ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`);
      }
    }
    expect(found).toEqual([]);
    await close(app);
  });
}

test('nothing scrolls sideways at 320 px wide', async ({ browser }) => {
  const app = await openApp(browser, readFixture('store-v6.json'));
  await app.page.setViewportSize({ width: 320, height: 720 });
  const wide: string[] = [];
  for (const route of SCREENS) {
    await app.page.goto(route);
    await app.page.waitForTimeout(800);
    const overflow = await app.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) wide.push(`${route}: ${overflow}px`);
  }
  expect(wide).toEqual([]);
  await close(app);
});

test('the main action on Today can be reached and used by keyboard', async ({ browser }) => {
  const app = await openApp(browser, readFixture('store-v6.json'));
  await app.page.goto('/');
  await app.see('Start Workout');
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    await app.page.keyboard.press('Tab');
    reached = await app.page.evaluate(() => (document.activeElement?.textContent ?? '').includes('Start Workout'));
  }
  expect(reached).toBe(true);
  // Enter opens today's workout, or a new one when nothing is planned: either way the page moves on.
  await app.page.keyboard.press('Enter');
  await app.page.waitForURL((url) => url.pathname !== '/', { timeout: 8000 });
  await close(app);
});
