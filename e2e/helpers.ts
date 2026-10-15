import { expect, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const FIXTURES = join(__dirname, '.fixtures');
export const fixture = (name: string) => join(FIXTURES, name);
export const readFixture = (name: string) => JSON.parse(readFileSync(fixture(name), 'utf8'));

/**
 * One page shared by the serial tests of a file, optionally starting from a
 * stored state, plus the small vocabulary the tests are written in. Inactive
 * screens stay mounted on the web, so every lookup is limited to visible text.
 */
export async function openApp(browser: Browser, seed?: unknown, options: { firstRun?: boolean } = {}) {
  // English, whatever the machine's language: the tests read the English text.
  const context = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'en-US' });
  if (seed) {
    await context.addInitScript((value) => {
      if (!localStorage.getItem('seeded')) {
        localStorage.setItem('form-workouts-store', JSON.stringify(value));
        localStorage.setItem('seeded', '1');
      }
    }, seed);
  }
  // The first-run setup is tested on its own; everywhere else it is already done.
  if (!options.firstRun) await context.addInitScript(() => localStorage.setItem('form-pref-onboarded', 'done'));
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });

  const visible = (text: string | RegExp, exact = true) => page.getByText(text, { exact }).filter({ visible: true });
  const ui = {
    page,
    problems,
    visible,
    click: (text: string) => visible(text).last().click(),
    see: (text: string | RegExp, timeout = 8000) => visible(text, false).first().waitFor({ timeout }),
    notSee: async (text: string) => {
      await page.waitForTimeout(400);
      await expect(visible(text, false)).toHaveCount(0);
    },
    /** The header's back arrow. */
    back: () => page.mouse.click(36, 24),
    stored: () => page.evaluate(() => JSON.parse(localStorage.getItem('form-workouts-store') ?? 'null')),
    expectNoBrowserErrors: () => expect([...new Set(problems)]).toEqual([]),
  };
  return ui;
}

export type App = Awaited<ReturnType<typeof openApp>>;

export async function close(app: App | undefined) {
  await app?.page.context().close();
}

export type { Page };
