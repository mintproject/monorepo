import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for ui-react.
 *
 * Real Chromium, fully mocked network (see e2e/support/graphql.ts) — no backend,
 * no secrets. The dev server is host-agnostic for the mock because we intercept
 * every request to the /v1/graphql endpoint regardless of its host.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // --no-open overrides vite.config's `server.open: true` so the dev server
    // doesn't spawn a browser when Playwright starts it.
    command: 'npm run dev -- --no-open',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
