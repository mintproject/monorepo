import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ListRegionCategoriesDocument } from '@/graphql/generated/graphql';
import { REGIONS_BY_CATEGORIES } from '@/graphql/region-picker';
import { renderWithProviders } from '@/test/utils/render';
import { RegionPickerDialog } from '@/components/registration/RegionPickerDialog';

// react-leaflet needs a real browser; mock it so jsdom doesn't hang. The GeoJSON
// mock invokes onEachFeature with a fake layer and renders a clickable button per
// feature, so polygon-click selection stays testable.
vi.mock('leaflet', () => ({
  default: { geoJSON: () => ({ getBounds: () => ({ isValid: () => false }) }) },
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  useMapEvents: () => ({}),
  GeoJSON: ({
    data,
    onEachFeature,
  }: {
    data: GeoJSON.FeatureCollection;
    onEachFeature?: (
      f: GeoJSON.Feature,
      layer: { on: (e: string, cb: () => void) => void; bindTooltip: () => void },
    ) => void;
  }) => (
    <div data-testid="geo-json">
      {data.features.map((feature, i) => {
        let clickHandler = () => {};
        const layer = {
          on: (_evt: string, cb: () => void) => {
            clickHandler = cb;
          },
          bindTooltip: () => {},
        };
        onEachFeature?.(feature, layer);
        return (
          <button key={i} type="button" onClick={() => clickHandler()}>
            {feature.properties?.regionName as string}
          </button>
        );
      })}
    </div>
  ),
}));

const categoriesMock = {
  request: { query: ListRegionCategoriesDocument },
  result: {
    data: {
      region_category: [
        {
          __typename: 'region_category',
          id: 'agriculture',
          name: 'Agriculture',
          citation: null,
          sub_categories: [],
        },
        {
          __typename: 'region_category',
          id: 'hydrology',
          name: 'Hydrology',
          citation: null,
          sub_categories: [],
        },
      ],
    },
  },
};

const texasGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

const agricultureRegionsMock = {
  request: { query: REGIONS_BY_CATEGORIES, variables: { categoryIds: ['agriculture'] } },
  result: {
    data: {
      region: [
        {
          __typename: 'region',
          id: 'tx',
          name: 'Texas',
          category_id: 'agriculture',
          geometries: [{ __typename: 'region_geometry', id: 1, geometry: texasGeometry }],
        },
      ],
    },
  },
};

describe('RegionPickerDialog', () => {
  it('shows category tabs and a map of the active category regions', async () => {
    renderWithProviders(
      <RegionPickerDialog open onOpenChange={() => {}} selected={[]} onChange={() => {}} />,
      { apolloMocks: [categoriesMock, agricultureRegionsMock] },
    );

    expect(await screen.findByRole('tab', { name: /agricultural regions/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /hydrological regions/i })).toBeInTheDocument();
    expect(await screen.findByTestId('map-container')).toBeInTheDocument();
    expect(await screen.findByText('Texas')).toBeInTheDocument();
  });

  it('adds a region to the selection when its polygon is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <RegionPickerDialog open onOpenChange={() => {}} selected={[]} onChange={onChange} />,
      { apolloMocks: [categoriesMock, agricultureRegionsMock] },
    );

    await user.click(await screen.findByText('Texas'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([{ id: 'tx', label: 'Texas' }]));
  });
});
