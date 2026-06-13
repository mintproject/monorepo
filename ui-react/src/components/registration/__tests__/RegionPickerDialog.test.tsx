import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ListRegionCategoriesDocument,
  ListRegionsByCategoryDocument,
} from '@/graphql/generated/graphql';
import { renderWithProviders } from '@/test/utils/render';
import { RegionPickerDialog } from '@/components/registration/RegionPickerDialog';

// Shared mutable handle so tests can drive the mocked Leaflet map: set the
// viewport bounds, fire map events, and assert fly-to calls.
const lmock = vi.hoisted(() => ({
  handlers: {} as Record<string, (() => void) | undefined>,
  bounds: { west: -180, south: -90, east: 180, north: 90 },
  flyToBounds: vi.fn(),
}));

// react-leaflet needs a real browser; mock it so jsdom doesn't hang. The GeoJSON
// mock invokes onEachFeature with a fake layer and renders a clickable button per
// feature, so polygon-click selection stays testable.
vi.mock('leaflet', () => ({
  default: { geoJSON: () => ({ getBounds: () => ({ isValid: () => false }) }) },
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('react-leaflet', () => {
  // Stable map instance — react-leaflet returns the same instance across renders,
  // so effects keyed on the map run once (a fresh object each call would loop).
  const mapInstance = {
    getBounds: () => ({
      getWest: () => lmock.bounds.west,
      getSouth: () => lmock.bounds.south,
      getEast: () => lmock.bounds.east,
      getNorth: () => lmock.bounds.north,
    }),
    fitBounds: () => {},
    flyToBounds: lmock.flyToBounds,
  };
  return {
    MapContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="map-container">{children}</div>
    ),
    TileLayer: () => <div data-testid="tile-layer" />,
    useMap: () => mapInstance,
    useMapEvents: (h: Record<string, () => void>) => {
      Object.assign(lmock.handlers, h);
      return mapInstance;
    },
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
  };
});

beforeEach(() => {
  lmock.bounds = { west: -180, south: -90, east: 180, north: 90 };
  lmock.handlers = {};
  lmock.flyToBounds.mockClear();
});

interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

function polygonOf(b: Box) {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [b.west, b.south],
        [b.east, b.south],
        [b.east, b.north],
        [b.west, b.north],
        [b.west, b.south],
      ],
    ],
  };
}

// Unique geometry ids — Apollo normalizes region_geometry by id, so reusing one
// id would collapse every region onto a single shared geometry.
let geomId = 0;

function region(id: string, name: string, categoryId: string, box?: Box) {
  const b = box ?? { west: 0, south: 0, east: 1, north: 1 };
  return {
    __typename: 'region',
    id,
    name,
    parent_region_id: 'parent',
    category_id: categoryId,
    model_catalog_uri: null,
    geometries: [{ __typename: 'region_geometry', id: ++geomId, geometry: polygonOf(b) }],
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

function regionsMockOf(
  categoryId: string,
  regions: Array<{ id: string; name: string; box?: Box }>,
) {
  return {
    request: { query: ListRegionsByCategoryDocument, variables: { categoryId } },
    result: { data: { region: regions.map((r) => region(r.id, r.name, categoryId, r.box)) } },
  };
}

const categoriesMock = categoriesMockOf([
  { id: 'agriculture', name: 'Agriculture' },
  { id: 'hydrology', name: 'Hydrology' },
]);
const TEXAS_BOX: Box = { west: -100, south: 28, east: -95, north: 32 };
const CALIFORNIA_BOX: Box = { west: -124, south: 34, east: -118, north: 40 };
const agricultureRegionsMock = regionsMockOf('agriculture', [
  { id: 'tx', name: 'Texas', box: TEXAS_BOX },
  { id: 'ca', name: 'California', box: CALIFORNIA_BOX },
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

  it('filters the list to the map viewport (B)', async () => {
    renderWithProviders(
      <RegionPickerDialog open onOpenChange={() => {}} selected={[]} onChange={() => {}} />,
      { apolloMocks: [categoriesMock, agricultureRegionsMock] },
    );

    expect(await screen.findByRole('option', { name: 'Texas' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'California' })).toBeInTheDocument();

    // Pan the map to a viewport that only covers Texas, then emit moveend.
    lmock.bounds = { west: -101, south: 27, east: -94, north: 33 };
    await act(async () => {
      lmock.handlers.moveend?.();
    });

    await waitFor(() =>
      expect(screen.queryByRole('option', { name: 'California' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('option', { name: 'Texas' })).toBeInTheDocument();
  });

  it('flies the map to a region when its locate button is clicked (A)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RegionPickerDialog open onOpenChange={() => {}} selected={[]} onChange={() => {}} />,
      { apolloMocks: [categoriesMock, agricultureRegionsMock] },
    );

    await user.click(await screen.findByRole('button', { name: /zoom to california/i }));

    await waitFor(() => expect(lmock.flyToBounds).toHaveBeenCalled());
    expect(lmock.flyToBounds).toHaveBeenCalledWith(
      [
        [CALIFORNIA_BOX.south, CALIFORNIA_BOX.west],
        [CALIFORNIA_BOX.north, CALIFORNIA_BOX.east],
      ],
      expect.objectContaining({ maxZoom: 8 }),
    );
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
