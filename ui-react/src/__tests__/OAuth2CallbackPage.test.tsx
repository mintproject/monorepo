/**
 * Tests for OAuth2CallbackPage
 */
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { OAuth2CallbackPage } from '@/pages/OAuth2CallbackPage';
import { renderWithProviders } from '@/test/utils/render';
import { mockAuthState } from '@/test/utils/auth-mocks';

// Mock the oauth2-adapter's handleCallback
vi.mock('@/lib/auth/oauth2-adapter', () => ({
  handleCallback: vi.fn(),
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

    await waitFor(
      () => expect(screen.getByText(/Signed in\. Redirecting/i)).toBeInTheDocument(),
      { timeout: 2000 },
    );
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

    await waitFor(() =>
      expect(screen.getByText(/Authentication Failed/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('access_denied')).toBeInTheDocument();
  });

  it('shows error state when handleCallback throws', async () => {
    const { handleCallback } = await import('@/lib/auth/oauth2-adapter');
    (handleCallback as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network failure'));

    renderWithProviders(<OAuth2CallbackPage />, {
      authState: mockAuthState,
      initialEntries: ['/oauth2/callback'],
    });

    await waitFor(() =>
      expect(screen.getByText(/Authentication Failed/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('Network failure')).toBeInTheDocument();
  });
});
