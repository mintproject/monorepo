// @vitest-environment jsdom
/**
 * The region picker. The Google Maps SDK needs a real browser, so the module is
 * mocked; what matters here is the surrounding states and the click target.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';
import { setMintConfig } from '@/test/utils/mint-config';
import { renderWithProviders } from '@/test/utils/render';

const mapsLoaded = { value: true };

vi.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: mapsLoaded.value }),
  GoogleMap: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="google-map">{children}</div>
  ),
}));

const { RegionMap } = await import('@/components/regions/RegionMap');

function regionsMock(regions: unknown[]) {
  return {
    request: { query: LIST_TOP_REGIONS, variables: {} },
    result: { data: { region: regions } },
  };
}

describe('RegionMap', () => {
  beforeEach(() => {
    mapsLoaded.value = true;
    setMintConfig({ GOOGLE_MAPS_KEY: 'test-maps-key' });
  });

  it('draws the map once the regions arrive', async () => {
    renderWithProviders(<RegionMap />, {
      apolloMocks: [
        regionsMock([
          { id: 'ethiopia', name: 'Ethiopia', model_catalog_uri: null, geometries: [] },
        ]),
      ],
    });

    expect(await screen.findByTestId('google-map')).toBeInTheDocument();
  });

  it('shows a spinner instead of the map while the regions load', () => {
    renderWithProviders(<RegionMap />, { apolloMocks: [regionsMock([])] });
    expect(screen.queryByTestId('google-map')).not.toBeInTheDocument();
  });

  it('tells the user when there is nothing to draw', async () => {
    renderWithProviders(<RegionMap />, { apolloMocks: [regionsMock([])] });

    await waitFor(() => {
      expect(screen.getByText(/no regions available/i)).toBeInTheDocument();
    });
  });
});
