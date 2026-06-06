// @vitest-environment jsdom
/**
 * Unit tests for AppHome page component.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';
import { renderWithProviders } from '@/test/utils/render';
import { mockAuthState, mockUnauthenticatedState } from '@/test/utils/auth-mocks';
import { AppHome } from '@/pages/AppHome';

// ---------------------------------------------------------------------------
// Mock @react-google-maps/api — avoids real browser Google Maps SDK.
// isLoaded: true so that the "no regions" empty-state branch is reachable.
// ---------------------------------------------------------------------------
vi.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: true }),
  GoogleMap: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="google-map">{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const mockRegions = [
  {
    id: 'south_sudan',
    name: 'South Sudan',
    model_catalog_uri: null,
    geometries: [{ geometry: null }],
  },
  {
    id: 'ethiopia',
    name: 'Ethiopia',
    model_catalog_uri: null,
    geometries: [{ geometry: null }],
  },
];

const listRegionsMock = {
  request: {
    query: LIST_TOP_REGIONS,
    variables: {},
  },
  result: {
    data: {
      region: mockRegions,
    },
  },
};

const emptyRegionsMock = {
  request: {
    query: LIST_TOP_REGIONS,
    variables: {},
  },
  result: {
    data: {
      region: [],
    },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AppHome', () => {
  beforeEach(() => {
    // Reset window config
    (window as Window).__MINT_CONFIG__ = {
      HASURA_ENDPOINT: 'http://localhost:8080/v1/graphql',
      AUTH_SERVER: '',
      AUTH_CLIENT_ID: '',
      AUTH_REALM: '',
      AUTH_PROVIDER: 'keycloak',
      GOOGLE_MAPS_KEY: 'test-maps-key',
      WELCOME_MESSAGE: 'Welcome to DYNAMO',
    };
  });

  it('renders the welcome message', () => {
    renderWithProviders(<AppHome />, { apolloMocks: [listRegionsMock] });
    expect(screen.getByText('Welcome to DYNAMO')).toBeTruthy();
  });

  it('renders the DYNAMO description paragraphs', () => {
    renderWithProviders(<AppHome />, { apolloMocks: [listRegionsMock] });
    expect(screen.getAllByText(/DYNAMO/)).toBeTruthy();
  });

  it('renders the Getting Started card', () => {
    renderWithProviders(<AppHome />, { apolloMocks: [listRegionsMock] });
    expect(screen.getByText('Getting Started')).toBeTruthy();
  });

  it('shows region selection instruction', () => {
    renderWithProviders(<AppHome />, { apolloMocks: [listRegionsMock] });
    expect(
      screen.getByText(/Select a region by hovering over it and clicking/),
    ).toBeTruthy();
  });

  it('shows loading spinner while regions are loading', () => {
    // Regions are loading (Apollo hasn't resolved yet), so the spinner should
    // be visible even though isLoaded:true from the maps mock.
    renderWithProviders(<AppHome />, { apolloMocks: [listRegionsMock] });
    // map is not ready yet (regionsLoading is true initially)
    expect(screen.queryByTestId('google-map')).toBeNull();
  });

  it('shows signed-in username when authenticated', () => {
    renderWithProviders(<AppHome />, {
      apolloMocks: [listRegionsMock],
      authState: { ...mockAuthState, user: { username: 'analyst1', email: 'a@b.com', sub: 'x' } },
    });
    expect(screen.getByText(/analyst1/)).toBeTruthy();
  });

  it('does not show username section when unauthenticated', () => {
    renderWithProviders(<AppHome />, {
      apolloMocks: [listRegionsMock],
      authState: mockUnauthenticatedState,
    });
    const userEl = screen.queryByText(/Signed in as/);
    expect(userEl).toBeNull();
  });

  it('shows "no regions" message when region list is empty and map is loaded', async () => {
    renderWithProviders(<AppHome />, {
      apolloMocks: [emptyRegionsMock],
    });

    await waitFor(() => {
      expect(
        screen.queryByText(/No regions available/),
      ).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('falls back to default welcome message when config not set', () => {
    // Remove WELCOME_MESSAGE from window config
    (window as Window).__MINT_CONFIG__ = {
      HASURA_ENDPOINT: 'http://localhost:8080/v1/graphql',
      AUTH_SERVER: '',
      AUTH_CLIENT_ID: '',
      AUTH_REALM: '',
      AUTH_PROVIDER: 'keycloak',
    };

    renderWithProviders(<AppHome />, { apolloMocks: [listRegionsMock] });
    // Should fall back to the default message
    expect(
      screen.getByText('Welcome to MINT Model Catalog'),
    ).toBeTruthy();
  });
});
