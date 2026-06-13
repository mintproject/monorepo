import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ListRegionCategoriesDocument,
  ListRegionsByCategoryDocument,
} from '@/graphql/generated/graphql';
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

const polygon = {
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

function region(id: string, name: string, categoryId: string) {
  return {
    __typename: 'region',
    id,
    name,
    parent_region_id: 'parent',
    category_id: categoryId,
    model_catalog_uri: null,
    geometries: [{ __typename: 'region_geometry', id: 1, geometry: polygon }],
  };
}

function categoriesMockOf(cats: Array<{ id: string; name: string; subIds?: string[] }>) {
  return {
    request: { query: ListRegionCategoriesDocument },
    result: {
      data: {
        region_category: cats.map((c) => ({
          __typename: 'region_category',
          id: c.id,
          name: c.name,
          citation: null,
          sub_categories: (c.subIds ?? []).map((sid) => ({
            __typename: 'region_category_tree',
            region_category_id: sid,
          })),
        })),
      },
    },
  };
}

function regionsMockOf(categoryId: string, regions: Array<{ id: string; name: string }>) {
  return {
    request: { query: ListRegionsByCategoryDocument, variables: { categoryId } },
    result: { data: { region: regions.map((r) => region(r.id, r.name, categoryId)) } },
  };
}

const categoriesMock = categoriesMockOf([
  { id: 'agriculture', name: 'Agriculture' },
  { id: 'hydrology', name: 'Hydrology' },
]);
const agricultureRegionsMock = regionsMockOf('agriculture', [
  { id: 'tx', name: 'Texas' },
  { id: 'ca', name: 'California' },
]);

describe('RegionPickerDialog', () => {
  it('shows category tabs, a map, and a searchable list', async () => {
    renderWithProviders(
      <RegionPickerDialog open onOpenChange={() => {}} selected={[]} onChange={() => {}} />,
      { apolloMocks: [categoriesMock, agricultureRegionsMock] },
    );

    expect(await screen.findByRole('tab', { name: /agricultural regions/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /hydrological regions/i })).toBeInTheDocument();
    expect(await screen.findByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('region-list')).toBeInTheDocument();
    // The list renders region options (the map renders plain buttons).
    expect(await screen.findByRole('option', { name: 'Texas' })).toBeInTheDocument();
  });

  it('adds a region to the selection when its polygon is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <RegionPickerDialog open onOpenChange={() => {}} selected={[]} onChange={onChange} />,
      { apolloMocks: [categoriesMock, agricultureRegionsMock] },
    );

    // The map polygon renders as a plain button (the list uses role="option").
    await user.click(await screen.findByRole('button', { name: 'Texas' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([{ id: 'tx', label: 'Texas' }]));
  });

  it('adds a region from the list when its option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <RegionPickerDialog open onOpenChange={() => {}} selected={[]} onChange={onChange} />,
      { apolloMocks: [categoriesMock, agricultureRegionsMock] },
    );

    await user.click(await screen.findByRole('option', { name: 'California' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([{ id: 'ca', label: 'California' }]));
  });

  it('filters the list by the search box', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RegionPickerDialog open onOpenChange={() => {}} selected={[]} onChange={() => {}} />,
      { apolloMocks: [categoriesMock, agricultureRegionsMock] },
    );

    expect(await screen.findByRole('option', { name: 'Texas' })).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /search regions/i }), 'cali');
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: 'Texas' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('option', { name: 'California' })).toBeInTheDocument();
  });

  it('filters by administrative level via the level sub-tabs', async () => {
    const user = userEvent.setup();
    const adminCategoriesMock = categoriesMockOf([
      { id: 'administrative', name: 'Administrative', subIds: ['admin_2'] },
      { id: 'admin_2', name: 'Administrative Level 2' },
    ]);
    const baseMock = regionsMockOf('administrative', [{ id: 'et', name: 'Ethiopia' }]);
    const level2Mock = regionsMockOf('admin_2', [{ id: 'oromia', name: 'Oromia' }]);

    renderWithProviders(
      <RegionPickerDialog open onOpenChange={() => {}} selected={[]} onChange={() => {}} />,
      { apolloMocks: [adminCategoriesMock, baseMock, level2Mock] },
    );

    expect(await screen.findByRole('option', { name: 'Ethiopia' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Administrative Level 2$/ })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Administrative Level 2$/ }));
    expect(await screen.findByRole('option', { name: 'Oromia' })).toBeInTheDocument();
  });
});
