/**
 * The region layer of the landing-page map.
 *
 * The Maps API disables itself when it cannot authenticate the key -- a bad
 * key, an unlisted HTTP referrer, or an exhausted quota. It replaces each of
 * its own methods with `function () {}`, so every call then returns
 * `undefined`. It does that shortly after the first map is drawn, which is why
 * a page that looked fine on the first load crashed on the next mount.
 *
 * Nothing here reads a value back from the Maps API.
 */

export interface RegionGeometry {
  // geometry is an opaque GeoJSON object stored in Hasura as JSON
  geometry: object | null;
}

export interface Region {
  id: string;
  name: string;
  model_catalog_uri?: string | null;
  // Hasura can omit the relationship, so treat it as optional.
  geometries?: RegionGeometry[] | null;
}

const REGION_FILL_DEFAULT = '#1990d5';
const REGION_FILL_SELECTED = '#d51990';
const REGION_STROKE_DEFAULT = '#1990d5';
const REGION_STROKE_SELECTED = '#d51990';

/** Style one region polygon (mirrors the google-map-custom.ts logic). */
export function applyFeatureStyle(feature: google.maps.Data.Feature, selectedId: string | null) {
  const regionId: string = feature.getProperty('region_id') as string;
  const selected = regionId === selectedId;
  return {
    fillColor: selected ? REGION_FILL_SELECTED : REGION_FILL_DEFAULT,
    fillOpacity: selected ? 0.5 : 0.3,
    strokeColor: selected ? REGION_STROKE_SELECTED : REGION_STROKE_DEFAULT,
    strokeWeight: 1,
  };
}

/**
 * Draw every region on the map data layer, and fit the viewport to them.
 *
 * Region identity travels inside the GeoJSON properties, and the centres come
 * from a pass over the data layer. Reading the features back from `addGeoJson`
 * would crash whenever the Maps API has disabled itself.
 */
export function loadRegionFeatures(map: google.maps.Map, regions: Region[]): void {
  regions.forEach((region) => {
    map.data.addGeoJson({
      type: 'FeatureCollection',
      features: (region.geometries ?? [])
        .filter((g) => g.geometry != null)
        .map((g) => ({
          type: 'Feature' as const,
          geometry: g.geometry as object,
          properties: { region_id: region.id, region_name: region.name },
        })),
    });
  });

  // Cache the centre of each feature, and collect the bounds of all of them.
  const allBounds = new google.maps.LatLngBounds();
  map.data.forEach((feature) => {
    const geom = feature.getGeometry();
    if (!geom) return;

    const featureBounds = new google.maps.LatLngBounds();
    geom.forEachLatLng((latlng) => {
      featureBounds.extend(latlng);
      allBounds.extend(latlng);
    });
    feature.setProperty('center', featureBounds.getCenter());
  });

  if (!allBounds.isEmpty()) {
    map.fitBounds(allBounds);
  }
}
