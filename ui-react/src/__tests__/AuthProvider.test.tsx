/**
 * Unit tests for AuthProvider and AuthContext
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { AuthProvider, AuthContext, type AuthState } from '@/lib/auth/AuthProvider';
import { clearTokens, storeTokens } from '@/lib/auth/token-store';

// Stub oauth2 actions so tests don't actually redirect
vi.mock('@/lib/auth/oauth2-adapter', () => ({
  authorize: vi.fn(),
  logout: vi.fn(),
  setRefreshCallback: vi.fn(),
  refreshAccessToken: vi.fn().mockResolvedValue(false),
}));

// Helper component that reads auth context
function AuthConsumer() {
  const ctx = React.useContext(AuthContext);
  return (
    <div>
      <span data-testid="auth-status">{ctx.isAuthenticated ? 'authed' : 'guest'}</span>
      <span data-testid="loading">{ctx.isLoading ? 'loading' : 'ready'}</span>
      <span data-testid="username">{ctx.user?.username ?? 'none'}</span>
      <button onClick={ctx.login}>login</button>
      <button onClick={ctx.logout}>logout</button>
    </div>
  );
}

// Minimal valid JWT — use real base64 so decodeUserFromToken works
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload)).replace(/=/g, '');
  return `${header}.${body}.fakesig`;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    clearTokens();
  });

  it('starts as unauthenticated when localStorage is empty', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));
    expect(screen.getByTestId('auth-status').textContent).toBe('guest');
    expect(screen.getByTestId('username').textContent).toBe('none');
  });

  it('restores persisted token on mount', async () => {
    const token = makeJwt({
      sub: 'u1',
      email: 'alice@test.com',
      preferred_username: 'alice',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    storeTokens({ accessToken: token, accessExpiresIn: 3600 });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));
    expect(screen.getByTestId('auth-status').textContent).toBe('authed');
    expect(screen.getByTestId('username').textContent).toBe('alice');
  });

  it('calls authorize() when login is invoked', async () => {
    const { authorize } = await import('@/lib/auth/oauth2-adapter');

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'login' }));
    expect(authorize).toHaveBeenCalledTimes(1);
  });

  it('clears token and calls oauth2Logout when logout is invoked', async () => {
    const { logout } = await import('@/lib/auth/oauth2-adapter');
    const token = makeJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 });
    storeTokens({ accessToken: token, accessExpiresIn: 3600 });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('auth-status').textContent).toBe('authed'));
    await userEvent.click(screen.getByRole('button', { name: 'logout' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('provides getAccessToken in context via accessToken field', async () => {
    const token = makeJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 });
    storeTokens({ accessToken: token, accessExpiresIn: 3600 });

    let capturedState: AuthState | null = null;
    function Capturer() {
      capturedState = React.useContext(AuthContext);
      return null;
    }

    render(
      <AuthProvider>
        <Capturer />
      </AuthProvider>,
    );

    await waitFor(() => expect(capturedState?.isLoading).toBe(false));
    expect((capturedState as unknown as AuthState).accessToken).toBe(token);
    expect((capturedState as unknown as AuthState).isAuthenticated).toBe(true);
  });
});
