import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against the exported web app in local mode (see
 * e2e/build.cjs). Nothing here talks to Supabase or the assistant.
 * Locally, set E2E_BROWSER_CHANNEL=msedge to use an installed Edge instead of
 * downloading Playwright's Chromium.
 */
const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.E2E_BROWSER_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node e2e/serve.cjs dist-e2e ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
