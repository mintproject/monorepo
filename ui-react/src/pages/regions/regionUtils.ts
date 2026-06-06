/**
 * Shared types and utilities for region-related pages.
 */

export interface BoundingBox {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export interface RegionGeometryData {
  id: number;
  /**
   * Hasura returns the jsonb `geometry` column as an already-parsed object,
   * while file uploads and the generated types model it as a JSON string.
   * Accept both shapes.
   */
  geometry: string | GeoJSON.Geometry;
}

export interface RegionData {
  id: string;
  name: string;
  parent_region_id?: string | null;
  category_id?: string | null;
  model_catalog_uri?: string | null;
  geometries: RegionGeometryData[];
}

export interface RegionCategoryData {
  id: string;
  name: string;
  citation?: string | null;
  sub_categories?: Array<{ region_category_id: string }>;
}

/**
 * Normalise a geometry value into a parsed GeoJSON object.
 *
 * Hasura returns jsonb geometry columns as already-parsed objects, whereas
 * GeoJSON file uploads (and the generated GraphQL types) provide JSON strings.
 * Handle both, returning null for anything unparseable.
 */
export function parseGeometry(
  geometry: string | GeoJSON.Geometry | null | undefined,
): GeoJSON.Geometry | null {
  if (geometry == null) return null;
  if (typeof geometry === 'object') return geometry;
  try {
    return JSON.parse(geometry) as GeoJSON.Geometry;
  } catch {
    return null;
  }
}

/** Calculate a bounding box from an array of geometry strings. */
export function calculateBoundingBox(geometries: RegionGeometryData[]): BoundingBox | null {
  let xmin = 99999;
  let ymin = 99999;
  let xmax = -99999;
  let ymax = -99999;
  let hasCoords = false;

  geometries.forEach((geomObj) => {
    const geom = parseGeometry(geomObj.geometry);
    if (!geom) return;
    const coords = extractCoordinates(geom);
    coords.forEach(([lon, lat]) => {
      if (lon < xmin) xmin = lon;
      if (lon > xmax) xmax = lon;
      if (lat < ymin) ymin = lat;
      if (lat > ymax) ymax = lat;
      hasCoords = true;
    });
  });

  if (!hasCoords) return null;
  return { xmin, xmax, ymin, ymax };
}

function extractCoordinates(geom: GeoJSON.Geometry): Array<[number, number]> {
  const coords: Array<[number, number]> = [];

  function recurse(obj: unknown) {
    if (Array.isArray(obj)) {
      if (obj.length >= 2 && typeof obj[0] === 'number' && typeof obj[1] === 'number') {
        coords.push([obj[0], obj[1]]);
      } else {
        obj.forEach(recurse);
      }
    } else if (obj && typeof obj === 'object' && 'coordinates' in obj) {
      recurse((obj as GeoJSON.Geometry & { coordinates: unknown }).coordinates);
    } else if (obj && typeof obj === 'object' && 'geometries' in obj) {
      (obj as GeoJSON.GeometryCollection).geometries.forEach(recurse);
    }
  }

  recurse(geom);
  return coords;
}

/** Generate a unique region ID from the parent region ID. */
export function generateRegionId(parentRegionId: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  const shortParent = parentRegionId.split('/').pop() ?? parentRegionId;
  return `${shortParent}__${slug}__${Date.now()}`;
}

/** Convert a GeoJSON FeatureCollection to an array of regions to insert. */
export interface NewRegionFromGeoJSON {
  name: string;
  geometries: string[]; // array of GeoJSON geometry strings
  featureProperties: Record<string, unknown>;
}

export function parseGeoJsonFeatures(
  geojson: GeoJSON.FeatureCollection<GeoJSON.Geometry | null>,
): NewRegionFromGeoJSON[] {
  return geojson.features.map((feature) => ({
    name: '',
    geometries: feature.geometry ? [JSON.stringify(feature.geometry)] : [],
    featureProperties: (feature.properties ?? {}) as Record<string, unknown>,
  }));
}
