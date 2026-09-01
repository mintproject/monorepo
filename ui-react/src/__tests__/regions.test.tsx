/**
 * Tests for the Regions pages and utilities.
 *
 * react-leaflet requires a real browser and does not work in jsdom. We mock
 * the entire react-leaflet module so that RegionsEditor can be rendered
 * without hanging or crashing.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils/render';

import { RegionsHome } from '../pages/regions/RegionsHome';
import { RegionsManual } from '../pages/regions/RegionsManual';
import { RegionsAdministrative } from '../pages/regions/RegionsAdministrative';
import { RegionsHydrology } from '../pages/regions/RegionsHydrology';
import { RegionsAgriculture } from '../pages/regions/RegionsAgriculture';
import {
  calculateBoundingBox,
  parseGeoJsonFeatures,
  parseGeometry,
  generateRegionId,
} from '../pages/regions/regionUtils';
import type { RegionGeometryData } from '../pages/regions/regionUtils';

// ─── Mock leaflet + react-leaflet so jsdom doesn't hang ──────────────────────

vi.mock('leaflet', () => ({
  default: {
    geoJSON: vi.fn(() => ({
      getBounds: () => ({ isValid: () => false }),
    })),
    latLngBounds: vi.fn(),
  },
  geoJSON: vi.fn(),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  GeoJSON: () => <div data-testid="geo-json" />,
  useMapEvents: () => ({}),
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));

// ─── Mock Google Maps: RegionsHome now carries the region-picker map ─────────

vi.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: true }),
  GoogleMap: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="google-map">{children}</div>
  ),
}));

// ─── Utility tests ────────────────────────────────────────────────────────────

describe('regionUtils', () => {
  describe('calculateBoundingBox', () => {
    it('returns null for empty array', () => {
      expect(calculateBoundingBox([])).toBeNull();
    });

    it('returns correct bounding box for a simple polygon geometry', () => {
      const geometries: RegionGeometryData[] = [
        {
          id: 1,
          geometry: JSON.stringify({
            type: 'Polygon',
            coordinates: [
              [
                [10, 20],
                [30, 20],
                [30, 40],
                [10, 40],
                [10, 20],
              ],
            ],
          }),
        },
      ];
      const bbox = calculateBoundingBox(geometries);
      expect(bbox).not.toBeNull();
      expect(bbox!.xmin).toBe(10);
      expect(bbox!.xmax).toBe(30);
      expect(bbox!.ymin).toBe(20);
      expect(bbox!.ymax).toBe(40);
    });

    it('returns null for invalid geometry JSON', () => {
      const geometries: RegionGeometryData[] = [{ id: 1, geometry: 'not-json' }];
      expect(calculateBoundingBox(geometries)).toBeNull();
    });

    // Hasura returns jsonb geometry columns as already-parsed objects, not
    // strings. The bounding box (and map) must handle that shape.
    it('handles geometry returned as a parsed object (Hasura jsonb)', () => {
      const geometries = [
        {
          id: 1,
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [10, 20],
                [30, 20],
                [30, 40],
                [10, 40],
                [10, 20],
              ],
            ],
          },
        },
      ] as unknown as RegionGeometryData[];
      const bbox = calculateBoundingBox(geometries);
      expect(bbox).not.toBeNull();
      expect(bbox!.xmin).toBe(10);
      expect(bbox!.xmax).toBe(30);
      expect(bbox!.ymin).toBe(20);
      expect(bbox!.ymax).toBe(40);
    });
  });

  describe('parseGeometry', () => {
    it('parses a JSON geometry string', () => {
      const geom = parseGeometry(JSON.stringify({ type: 'Point', coordinates: [1, 2] }));
      expect(geom).toEqual({ type: 'Point', coordinates: [1, 2] });
    });

    it('passes through an already-parsed geometry object (Hasura jsonb)', () => {
      const obj = { type: 'Point', coordinates: [1, 2] };
      expect(parseGeometry(obj as unknown as string)).toEqual(obj);
    });

    it('returns null for invalid input', () => {
      expect(parseGeometry('not-json')).toBeNull();
      expect(parseGeometry(null as unknown as string)).toBeNull();
    });
  });

  describe('parseGeoJsonFeatures', () => {
    it('returns one feature per GeoJSON feature', () => {
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { NAME: 'Alpha' },
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
          {
            type: 'Feature',
            properties: { NAME: 'Beta' },
            geometry: { type: 'Point', coordinates: [1, 1] },
          },
        ],
      };
      const result = parseGeoJsonFeatures(geojson);
      expect(result).toHaveLength(2);
      expect(result[0]?.featureProperties).toEqual({ NAME: 'Alpha' });
      expect(result[1]?.featureProperties).toEqual({ NAME: 'Beta' });
    });

    it('handles features with null geometry', () => {
      const geojson: GeoJSON.FeatureCollection<GeoJSON.Geometry | null> = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: null }],
      };
      const result = parseGeoJsonFeatures(geojson);
      expect(result).toHaveLength(1);
      expect(result[0]?.geometries).toEqual([]);
    });
  });

  describe('generateRegionId', () => {
    it('creates a slug from parent id and name', () => {
      const id = generateRegionId('ethiopia', 'Blue Nile Basin');
      expect(id).toMatch(/^ethiopia__blue_nile_basin__\d+$/);
    });

    it('removes special characters', () => {
      const id = generateRegionId('parent', 'Region #1 (Test)');
      expect(id).toMatch(/^parent__region_1_test__\d+$/);
    });
  });
});

// ─── Page render tests ────────────────────────────────────────────────────────

describe('RegionsHome', () => {
  it('renders the main h1 heading', () => {
    renderWithProviders(<RegionsHome />);
    expect(screen.getByRole('heading', { level: 1, name: 'Regions' })).toBeInTheDocument();
  });

  it('renders three category card headings', () => {
    renderWithProviders(<RegionsHome />);
    expect(
      screen.getByRole('heading', { level: 4, name: 'Agricultural Regions' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Hydrological Regions' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Administrative Regions' }),
    ).toBeInTheDocument();
  });

  it('renders explore links for each category', () => {
    renderWithProviders(<RegionsHome />);
    expect(screen.getByRole('link', { name: /explore agricultural/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explore hydrological/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explore administrative/i })).toBeInTheDocument();
  });

  it('offers the region map as the other way in', () => {
    renderWithProviders(<RegionsHome />);
    expect(screen.getByRole('heading', { name: 'Start from the map' })).toBeInTheDocument();
    expect(
      screen.getByText(/select a region by hovering over it and clicking/i),
    ).toBeInTheDocument();
  });
});

describe('RegionsManual', () => {
  it('renders the in-progress message', () => {
    renderWithProviders(<RegionsManual />);
    expect(screen.getByText(/this page is in progress/i)).toBeInTheDocument();
  });
});

describe('RegionsAdministrative', () => {
  it('renders without crashing', () => {
    renderWithProviders(<RegionsAdministrative />, {
      initialEntries: ['/regions/administrative'],
    });
    // Administrative page renders the editor which shows map container placeholder
    // The map is mocked so it renders as a div
    expect(document.body).toBeTruthy();
  });
});

describe('RegionsHydrology', () => {
  it('renders without crashing', () => {
    renderWithProviders(<RegionsHydrology />, {
      initialEntries: ['/regions/hydrology'],
    });
    expect(document.body).toBeTruthy();
  });
});

describe('RegionsAgriculture', () => {
  it('renders without crashing', () => {
    renderWithProviders(<RegionsAgriculture />, {
      initialEntries: ['/regions/agriculture'],
    });
    expect(document.body).toBeTruthy();
  });
});
