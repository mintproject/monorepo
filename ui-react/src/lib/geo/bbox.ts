/**
 * GeoJSON bounding boxes.
 *
 * One extractor, shared by everything that has to reduce a GeoJSON value to a
 * rectangle: region geometries from Hasura, and CKAN's `spatial` field.
 *
 * It exists because the partial versions it replaces dropped data silently.
 * `packageSpatialCoverage` read `coordinates[0]` and so understood a bare
 * Polygon only, while TACC's catalog also holds `FeatureCollection`, `Feature`,
 * `Point` and `MultiPolygon`; `calculateBoundingBox` recursed through
 * `coordinates` and `geometries` but not through `Feature.geometry` or
 * `FeatureCollection.features`. A spatial filter built on either would have
 * hidden real datasets without a word — the #94 fault again.
 *
 * The walk is deliberately structural rather than type-driven: it follows
 * whichever of `coordinates` / `geometries` / `geometry` / `features` a node
 * carries, so an unfamiliar GeoJSON shape still yields its coordinates instead
 * of yielding nothing.
 */

export interface BoundingBox {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

/**
 * Every `[lon, lat]` pair reachable from a GeoJSON value, at any nesting depth.
 *
 * A position is recognised by shape — an array whose first two entries are
 * numbers — which covers `[lon, lat]` and the `[lon, lat, elevation]` GeoJSON
 * also allows.
 */
function collectPositions(node: unknown, out: Array<[number, number]>): void {
  if (Array.isArray(node)) {
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      out.push([node[0], node[1]]);
      return;
    }
    for (const child of node) collectPositions(child, out);
    return;
  }
  if (!node || typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;
  // A node may legitimately carry more than one of these (a Feature holding a
  // GeometryCollection, say), so every branch is followed rather than the first.
  if ('coordinates' in obj) collectPositions(obj['coordinates'], out);
  if ('geometries' in obj) collectPositions(obj['geometries'], out);
  if ('geometry' in obj) collectPositions(obj['geometry'], out);
  if ('features' in obj) collectPositions(obj['features'], out);
}

/**
 * The bounding box of any GeoJSON value — geometry, Feature, FeatureCollection
 * or GeometryCollection — accepted as an object or as a JSON string.
 *
 * Returns null when the value is unparseable or holds no position at all. That
 * is "no location", which callers must distinguish from "a location elsewhere":
 * they are different claims and the Datasets step answers them differently.
 */
export function geoJsonBoundingBox(geo: unknown): BoundingBox | null {
  let value = geo;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;

  const positions: Array<[number, number]> = [];
  collectPositions(value, positions);
  if (!positions.length) return null;

  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const [lon, lat] of positions) {
    if (lon < xmin) xmin = lon;
    if (lon > xmax) xmax = lon;
    if (lat < ymin) ymin = lat;
    if (lat > ymax) ymax = lat;
  }
  return { xmin, xmax, ymin, ymax };
}

/** The box enclosing several GeoJSON values, or null when none carries one. */
export function unionBoundingBox(values: unknown[]): BoundingBox | null {
  let box: BoundingBox | null = null;
  for (const value of values) {
    const next = geoJsonBoundingBox(value);
    if (!next) continue;
    box = box
      ? {
          xmin: Math.min(box.xmin, next.xmin),
          xmax: Math.max(box.xmax, next.xmax),
          ymin: Math.min(box.ymin, next.ymin),
          ymax: Math.max(box.ymax, next.ymax),
        }
      : next;
  }
  return box;
}

/** True when two boxes share any area. Touching edges count as overlapping. */
export function boundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.xmax < b.xmin || a.xmin > b.xmax || a.ymax < b.ymin || a.ymin > b.ymax);
}
