/**
 * Auth context mocks for testing components that require authentication.
 *
 * Usage:
 *   import { mockAuthState, mockUnauthenticatedState } from '@/test/utils/auth-mocks';
 */
import type { AuthState, AuthUser } from '@/lib/auth/AuthProvider';

export const mockUser: AuthUser = {
  email: 'testuser@example.com',
  username: 'testuser',
  sub: 'test-user-id-123',
};

/** Authenticated state — use in tests that require a logged-in user. */
export const mockAuthState: AuthState = {
  isAuthenticated: true,
  isLoading: false,
  user: mockUser,
  accessToken: 'mock-access-token',
  login: () => {},
  logout: () => {},
};

/** Unauthenticated state — use in tests that simulate a logged-out user. */
export const mockUnauthenticatedState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  accessToken: null,
  login: () => {},
  logout: () => {},
};

/** Loading state — use in tests that need the auth check in-progress state. */
export const mockLoadingAuthState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  accessToken: null,
  login: () => {},
  logout: () => {},
};
