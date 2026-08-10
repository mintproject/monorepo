/**
 * Shared types and utilities for region-related pages.
 */

import { unionBoundingBox, type BoundingBox } from '@/lib/geo/bbox';

export type { BoundingBox };

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

/**
 * Calculate a bounding box from an array of region geometries.
 *
 * The walk lives in lib/geo/bbox so the Datasets step and the region map read
 * the same GeoJSON the same way; this used to miss `Feature` and
 * `FeatureCollection`, which CKAN and uploaded region files both produce.
 */
export function calculateBoundingBox(geometries: RegionGeometryData[]): BoundingBox | null {
  return unionBoundingBox(geometries.map((g) => g.geometry));
}

/** A map viewport expressed as geographic edges (degrees). */
export interface ViewportBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * True when a region's bounding box overlaps the given map viewport. Pure
 * number math (no Leaflet) so it is cheap to run per region and easy to test.
 */
export function boundingBoxInViewport(bb: BoundingBox, vp: ViewportBounds): boolean {
  return !(bb.xmax < vp.west || bb.xmin > vp.east || bb.ymax < vp.south || bb.ymin > vp.north);
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
