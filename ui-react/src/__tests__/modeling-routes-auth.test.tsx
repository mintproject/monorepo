/**
 * Modeling routes require authentication.
 *
 * The problem-statement / thread pages query the `events` and `permissions`
 * relationships, which Hasura only exposes to the authenticated `user` role
 * (their target tables grant SELECT to `user` only — not `anonymous`).
 *
 * If these routes are reachable while logged out, Apollo sends no JWT, Hasura
 * runs the request as `anonymous`, and the query fails with
 * "field 'events' not found in type: 'problem_statement'".
 *
 * These routes must therefore be wrapped in <ProtectedRoute>.
 */
import { describe, expect, it } from 'vitest';

import { App } from '@/App';
import { renderWithProviders, screen } from '@/test/utils/render';
import { mockUnauthenticatedState } from '@/test/utils/auth-mocks';

const USER_SCOPED_ROUTES = [
  '/modeling/problem-statements',
  '/modeling/problem-statement/ps-123',
  '/modeling/thread/th-123',
];

describe('modeling routes auth guard', () => {
  it.each(USER_SCOPED_ROUTES)(
    'redirects unauthenticated users away from %s instead of rendering the page',
    (route) => {
      renderWithProviders(<App />, {
        authState: mockUnauthenticatedState,
        initialEntries: [route],
      });

      // The login-required page is rendered on redirect.
      expect(screen.getByText(/redirecting to sign-in/i)).toBeInTheDocument();
      // The protected page heading must NOT be visible to a logged-out user.
      expect(screen.queryByRole('heading', { name: /problem statement/i })).not.toBeInTheDocument();
    },
  );
});
