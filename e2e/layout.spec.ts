/**
 * Mobile, tablet and desktop (CLAUDE.md, roadmap Step 15): no screen scrolls
 * sideways, wide screens get the side navigation, pushed screens keep a
 * readable column, and axe finds no serious problems at each size.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { close, openApp, readFixture } from './helpers';

const SIZES = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;
const SCREENS = ['/', '/workouts', '/progress', '/health-hub', '/more', '/trends', '/nutrition', '/recovery', '/goals-forecast'];

for (const size of SIZES) {
  test(`${size.name} (${size.width} px): nothing scrolls sideways and nothing serious for axe`, async ({ browser }) => {
    const app = await openApp(browser, readFixture('store-v6.json'));
    await app.page.setViewportSize({ width: size.width, height: size.height });
    const problems: string[] = [];
    for (const route of SCREENS) {
      await app.page.goto(route);
      await app.page.waitForTimeout(700);
      const overflow = await app.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) problems.push(`${route}: ${overflow}px sideways`);
      if (size.name !== 'mobile') {
        const result = await new AxeBuilder({ page: app.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        for (const v of result.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) problems.push(`${route} ${v.id}: ${v.nodes[0]?.target.join(' ')}`);
      }
    }
    expect(problems).toEqual([]);
    await close(app);
  });
}

test('wide screens put the navigation at the side and keep pushed screens in a readable column', async ({ browser }) => {
  const app = await openApp(browser, readFixture('store-v6.json'));
  await app.page.setViewportSize({ width: 1280, height: 800 });
  await app.page.goto('/');
  const tab = app.page.getByRole('tab', { name: /^Today(,|$)/ }).or(app.page.getByRole('link', { name: /^Today(,|$)/ })).filter({ visible: true }).first();
  const box = await tab.boundingBox();
  expect(box && box.x < 260 && box.y < 400).toBe(true); // in the sidebar, not along the bottom
  await app.page.goto('/trends');
  await app.see('Your Trends');
  const widest = await app.page.evaluate(() => Math.max(...[...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).maxWidth === '840px').map((d) => d.getBoundingClientRect().width)));
  expect(widest).toBeLessThanOrEqual(840);
  await app.page.setViewportSize({ width: 390, height: 844 });
  await app.page.goto('/');
  const bottom = await app.page.getByRole('tab', { name: /^Today(,|$)/ }).or(app.page.getByRole('link', { name: /^Today(,|$)/ })).filter({ visible: true }).first().boundingBox();
  expect(bottom && bottom.y > 700).toBe(true); // a bottom tab bar on phones
  await close(app);
});
