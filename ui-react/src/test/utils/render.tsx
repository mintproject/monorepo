/**
 * Custom render wrapper for React Testing Library.
 *
 * Wraps components in all required providers:
 *  - MemoryRouter (react-router-dom)
 *  - MockedProvider (Apollo Client)
 *  - AuthContext.Provider (auth state)
 *
 * Usage:
 *   import { renderWithProviders } from '@/test/utils/render';
 *
 *   renderWithProviders(<MyComponent />, {
 *     authState: mockAuthState,
 *     apolloMocks: [mockQuery],
 *     initialEntries: ['/models/123'],
 *   });
 */
import type { MockedResponse } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing';
import { render, type RenderOptions } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AuthContext, type AuthState } from '@/lib/auth/AuthProvider';

import { mockAuthState } from './auth-mocks';

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Auth state to inject. Defaults to authenticated state. */
  authState?: AuthState;
  /** Apollo MockedProvider responses. Defaults to empty array. */
  apolloMocks?: MockedResponse[];
  /** Initial router entries. Defaults to ['/']. */
  initialEntries?: string[];
}

/**
 * Render a component wrapped in MemoryRouter, MockedProvider, and AuthContext.
 * This is the standard test render helper for this app.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  {
    authState = mockAuthState,
    apolloMocks = [],
    initialEntries = ['/'],
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter
        initialEntries={initialEntries}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <MockedProvider mocks={apolloMocks}>
          <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
        </MockedProvider>
      </MemoryRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Re-export everything from @testing-library/react so tests only need
 * to import from this module.
 */
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';
export { renderWithProviders as render };
