/**
 * Tests for ProtectedRoute component
 */
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { renderWithProviders } from '@/test/utils/render';
import {
  mockAuthState,
  mockLoadingAuthState,
  mockUnauthenticatedState,
} from '@/test/utils/auth-mocks';

describe('ProtectedRoute', () => {
  it('renders children when authenticated', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div data-testid="protected-content">Secret content</div>
      </ProtectedRoute>,
      { authState: mockAuthState },
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });

  it('shows loading spinner while auth state is loading', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div data-testid="protected-content">Secret content</div>
      </ProtectedRoute>,
      { authState: mockLoadingAuthState },
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    // LoadingSpinner renders a div with animate-spin
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('redirects to /login-required when not authenticated', () => {
    // Render inside a Routes tree so the <Navigate> resolves to a real route
    // and ProtectedRoute unmounts — rendering it bare would re-navigate on every
    // render (a fresh location.state.from each time) and loop indefinitely.
    renderWithProviders(
      <Routes>
        <Route
          path="/configure"
          element={
            <ProtectedRoute>
              <div data-testid="protected-content">Secret content</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/login-required"
          element={<div data-testid="login-required">Login required</div>}
        />
      </Routes>,
      {
        authState: {
          ...mockUnauthenticatedState,
          login: vi.fn(),
        },
        initialEntries: ['/configure'],
      },
    );

    // Content should not be shown when unauthenticated; we land on /login-required.
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-required')).toBeInTheDocument();
  });
});
