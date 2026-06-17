/**
 * Shared Playwright test fixtures.
 *
 * - `mockApi` (auto): installs the GraphQL mock on every test's page, so no test
 *   ever hits a real backend.
 * - `authenticated` (opt-in): seeds a fake JWT + future expiry into localStorage
 *   BEFORE the app boots, so ProtectedRoute renders. Request it in a test's args
 *   to exercise authenticated routes; omit it to test the anonymous experience.
 */
import { test as base, expect } from '@playwright/test';

import { mockGraphql } from './graphql';

export const test = base.extend<{ mockApi: void; authenticated: void }>({
  mockApi: [
    async ({ page }, use) => {
      await mockGraphql(page);
      await use();
    },
    { auto: true },
  ],

  authenticated: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        const b64url = (obj: unknown) =>
          btoa(JSON.stringify(obj))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        const header = b64url({ alg: 'none', typ: 'JWT' });
        const payload = b64url({
          sub: 'e2e-user',
          email: 'e2e@example.com',
          preferred_username: 'e2e-user',
        });
        const jwt = `${header}.${payload}.signature`;
        // Far-future expiry computed at runtime so it never rots.
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem('mint.access_token', jwt);
        localStorage.setItem('mint.access_expires_at', expiresAt);
      });
      await use();
    },
    { auto: false },
  ],
});

export { expect };
