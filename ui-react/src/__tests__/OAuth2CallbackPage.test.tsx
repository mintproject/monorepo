/**
 * Tests for OAuth2CallbackPage
 */
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { OAuth2CallbackPage } from '@/pages/OAuth2CallbackPage';
import { renderWithProviders } from '@/test/utils/render';
import { mockAuthState } from '@/test/utils/auth-mocks';

// Mock the oauth2-adapter's handleCallback and maybeForwardToOrigin
vi.mock('@/lib/auth/oauth2-adapter', () => ({
  handleCallback: vi.fn(),
  // Default: not forwarding, so the callback page runs its normal handleCallback flow
  maybeForwardToOrigin: vi.fn().mockReturnValue({ forwarded: false }),
  authorize: vi.fn(),
  logout: vi.fn(),
  setRefreshCallback: vi.fn(),
}));

describe('OAuth2CallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows processing state initially', async () => {
    const { handleCallback } = await import('@/lib/auth/oauth2-adapter');
    (handleCallback as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {})); // never resolves

    renderWithProviders(<OAuth2CallbackPage />, {
      authState: mockAuthState,
      initialEntries: ['/oauth2/callback'],
    });

    expect(screen.getByText(/Completing sign-in/i)).toBeInTheDocument();
  });

  it('navigates to / after successful code exchange', async () => {
    const { handleCallback } = await import('@/lib/auth/oauth2-adapter');
    (handleCallback as ReturnType<typeof vi.fn>).mockResolvedValue({ type: 'code' });

    renderWithProviders(<OAuth2CallbackPage />, {
      authState: mockAuthState,
      initialEntries: ['/oauth2/callback'],
    });

    await waitFor(() => expect(screen.getByText(/Signed in\. Redirecting/i)).toBeInTheDocument(), {
      timeout: 2000,
    });
  });

  it('shows error state when handleCallback returns error', async () => {
    const { handleCallback } = await import('@/lib/auth/oauth2-adapter');
    (handleCallback as ReturnType<typeof vi.fn>).mockResolvedValue({
      type: 'error',
      error: 'access_denied',
    });

    renderWithProviders(<OAuth2CallbackPage />, {
      authState: mockAuthState,
      initialEntries: ['/oauth2/callback'],
    });

    await waitFor(() => expect(screen.getByText(/Authentication Failed/i)).toBeInTheDocument());
    expect(screen.getByText('access_denied')).toBeInTheDocument();
  });

  it('shows error state when handleCallback throws', async () => {
    const { handleCallback } = await import('@/lib/auth/oauth2-adapter');
    (handleCallback as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network failure'));

    renderWithProviders(<OAuth2CallbackPage />, {
      authState: mockAuthState,
      initialEntries: ['/oauth2/callback'],
    });

    await waitFor(() => expect(screen.getByText(/Authentication Failed/i)).toBeInTheDocument());
    expect(screen.getByText('Network failure')).toBeInTheDocument();
  });
});

describe('OAuth2CallbackPage forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stops and does not call handleCallback when forwarding without error', async () => {
    const { maybeForwardToOrigin, handleCallback } = await import('@/lib/auth/oauth2-adapter');
    (maybeForwardToOrigin as ReturnType<typeof vi.fn>).mockReturnValue({ forwarded: true });

    renderWithProviders(<OAuth2CallbackPage />, {
      authState: mockAuthState,
      initialEntries: ['/oauth2/callback'],
    });

    await waitFor(() =>
      expect(maybeForwardToOrigin as ReturnType<typeof vi.fn>).toHaveBeenCalled()
    );
    expect(handleCallback as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    // Page keeps showing the processing/spinner state
    expect(screen.getByText(/Completing sign-in/i)).toBeInTheDocument();
  });

  it('shows an error when forwarding is refused due to disallowed origin', async () => {
    const { maybeForwardToOrigin } = await import('@/lib/auth/oauth2-adapter');
    (maybeForwardToOrigin as ReturnType<typeof vi.fn>).mockReturnValue({
      forwarded: true,
      error: 'Refusing to forward authentication to a disallowed origin: https://evil.example.com',
    });

    renderWithProviders(<OAuth2CallbackPage />, {
      authState: mockAuthState,
      initialEntries: ['/oauth2/callback'],
    });

    await waitFor(() => expect(screen.getByText(/disallowed origin/i)).toBeInTheDocument());
    expect(screen.getByText(/Authentication Failed/i)).toBeInTheDocument();
  });

  it('runs handleCallback when not forwarding', async () => {
    const { maybeForwardToOrigin, handleCallback } = await import('@/lib/auth/oauth2-adapter');
    (maybeForwardToOrigin as ReturnType<typeof vi.fn>).mockReturnValue({ forwarded: false });
    (handleCallback as ReturnType<typeof vi.fn>).mockResolvedValue({ type: 'token' });

    renderWithProviders(<OAuth2CallbackPage />, {
      authState: mockAuthState,
      initialEntries: ['/oauth2/callback'],
    });

    await waitFor(() =>
      expect(handleCallback as ReturnType<typeof vi.fn>).toHaveBeenCalled()
    );
  });
});
