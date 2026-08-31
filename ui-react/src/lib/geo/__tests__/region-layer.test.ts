// @vitest-environment jsdom
/**
 * Regression tests for the region data layer on the landing page.
 *
 * The Maps API disables itself when it cannot authenticate the key: every
 * method becomes `function () {}` and returns `undefined`. That happens shortly
 * after the first map is drawn, so the crash only showed on a later mount --
 * for example when the user pressed the browser back button to return home.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { loadRegionFeatures, type Region } from '@/lib/geo/region-layer';

const regions: Region[] = [
  {
    id: 'south_sudan',
    name: 'South Sudan',
    geometries: [{ geometry: { type: 'Point', coordinates: [31, 7] } }],
  },
  { id: 'no_geometry', name: 'No geometry', geometries: [{ geometry: null }] },
];

/** A LatLngBounds good enough for the code under test. */
class FakeBounds {
  points: unknown[] = [];
  extend(latlng: unknown) {
    this.points.push(latlng);
  }
  isEmpty() {
    return this.points.length === 0;
  }
  getCenter() {
    return { lat: 0, lng: 0 };
  }
}

/** A working data layer: addGeoJson returns the features it added. */
function healthyMap() {
  const features: { props: Record<string, unknown> }[] = [];
  return {
    fitBounds: vi.fn(),
    data: {
      addGeoJson: vi.fn((geoJson: { features: { properties: object }[] }) =>
        geoJson.features.map((f) => {
          const feature = {
            props: { ...f.properties } as Record<string, unknown>,
            getGeometry: () => ({ forEachLatLng: (cb: (p: unknown) => void) => cb({ lat: 7 }) }),
            setProperty(key: string, value: unknown) {
              this.props[key] = value;
            },
          };
          features.push(feature);
          return feature;
        }),
      ),
      forEach: (cb: (f: unknown) => void) => features.forEach(cb),
      setStyle: vi.fn(),
      addListener: vi.fn(),
    },
    features,
  };
}

/** The map the Maps API leaves behind after an authentication failure. */
function neuteredMap() {
  const noop = () => undefined;
  return {
    fitBounds: noop,
    data: { addGeoJson: noop, forEach: noop, setStyle: noop, addListener: noop },
  };
}

beforeEach(() => {
  (globalThis as unknown as { google: unknown }).google = {
    maps: { LatLngBounds: FakeBounds },
  };
});

afterEach(() => {
  delete (globalThis as unknown as { google?: unknown }).google;
});

describe('loadRegionFeatures', () => {
  it('does not throw when the Maps API has disabled itself', () => {
    // addGeoJson returns undefined here, exactly as it does once the API has
    // rejected the key. Reading `.forEach` off that result crashed the page.
    expect(() =>
      loadRegionFeatures(neuteredMap() as unknown as google.maps.Map, regions),
    ).not.toThrow();
  });

  it('does not throw when a region carries no geometries', () => {
    const map = healthyMap();
    expect(() =>
      loadRegionFeatures(map as unknown as google.maps.Map, [{ id: 'bare', name: 'Bare' }]),
    ).not.toThrow();
  });

  it('puts the region identity in the GeoJSON properties', () => {
    const map = healthyMap();
    loadRegionFeatures(map as unknown as google.maps.Map, regions);

    const firstCall = map.data.addGeoJson.mock.calls[0]![0] as {
      features: { properties: Record<string, string> }[];
    };
    expect(firstCall.features).toHaveLength(1);
    expect(firstCall.features[0]!.properties).toMatchObject({
      region_id: 'south_sudan',
      region_name: 'South Sudan',
    });
  });

  it('caches a centre on each feature and fits the map to them', () => {
    const map = healthyMap();
    loadRegionFeatures(map as unknown as google.maps.Map, regions);

    expect(map.features).toHaveLength(1);
    expect(map.features[0]!.props.center).toEqual({ lat: 0, lng: 0 });
    expect(map.fitBounds).toHaveBeenCalledOnce();
  });

  it('skips geometries that are null', () => {
    const map = healthyMap();
    loadRegionFeatures(map as unknown as google.maps.Map, regions);

    const secondCall = map.data.addGeoJson.mock.calls[1]![0] as { features: unknown[] };
    expect(secondCall.features).toEqual([]);
  });
});
