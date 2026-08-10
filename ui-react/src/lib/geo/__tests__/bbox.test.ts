/**
 * Tests for the shared GeoJSON bounding-box extractor (issue #97).
 *
 * The defect these guard against: the two extractors this replaces each
 * understood a subset of GeoJSON and returned nothing for the rest. Building a
 * spatial filter on either would have hidden real datasets without a word.
 *
 * `packageSpatialCoverage` read `coordinates[0]`, so it understood a bare
 * Polygon only. `calculateBoundingBox` recursed through `coordinates` and
 * `geometries` but not `Feature.geometry` or `FeatureCollection.features`.
 * TACC's CKAN holds Polygon ×103, FeatureCollection ×5, MultiPolygon, Point
 * and Feature — so 8 packages sat outside the union of the two.
 */
import { describe, expect, it } from 'vitest';

import { boundingBoxesOverlap, geoJsonBoundingBox, unionBoundingBox } from '../bbox';

const SQUARE = [
  [-2, -1],
  [2, -1],
  [2, 1],
  [-2, 1],
  [-2, -1],
];
const POLYGON = { type: 'Polygon', coordinates: [SQUARE] };
const EXPECTED = { xmin: -2, xmax: 2, ymin: -1, ymax: 1 };

describe('geoJsonBoundingBox', () => {
  it('reads a Polygon', () => {
    expect(geoJsonBoundingBox(POLYGON)).toEqual(EXPECTED);
  });

  it('reads a MultiPolygon, which nests one ring deeper', () => {
    expect(geoJsonBoundingBox({ type: 'MultiPolygon', coordinates: [[SQUARE]] })).toEqual(EXPECTED);
  });

  it('reads a Point, whose coordinates are a bare position', () => {
    expect(geoJsonBoundingBox({ type: 'Point', coordinates: [-97.74, 30.27] })).toEqual({
      xmin: -97.74,
      xmax: -97.74,
      ymin: 30.27,
      ymax: 30.27,
    });
  });

  it('reads a position carrying an elevation', () => {
    expect(geoJsonBoundingBox({ type: 'Point', coordinates: [1, 2, 300] })).toEqual({
      xmin: 1,
      xmax: 1,
      ymin: 2,
      ymax: 2,
    });
  });

  it('reads a Feature, which holds its geometry one level down', () => {
    expect(geoJsonBoundingBox({ type: 'Feature', properties: {}, geometry: POLYGON })).toEqual(
      EXPECTED,
    );
  });

  it('reads a FeatureCollection, which holds a list of features', () => {
    expect(
      geoJsonBoundingBox({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: POLYGON }],
      }),
    ).toEqual(EXPECTED);
  });

  it('reads a GeometryCollection', () => {
    expect(geoJsonBoundingBox({ type: 'GeometryCollection', geometries: [POLYGON] })).toEqual(
      EXPECTED,
    );
  });

  it('spans every member of a collection, not just the first', () => {
    expect(
      geoJsonBoundingBox({
        type: 'GeometryCollection',
        geometries: [POLYGON, { type: 'Point', coordinates: [10, 10] }],
      }),
    ).toEqual({ xmin: -2, xmax: 10, ymin: -1, ymax: 10 });
  });

  it('parses a JSON string, which is how CKAN stores it', () => {
    expect(geoJsonBoundingBox(JSON.stringify(POLYGON))).toEqual(EXPECTED);
  });

  it('returns null for absent, unparseable or coordinate-free input', () => {
    expect(geoJsonBoundingBox(undefined)).toBeNull();
    expect(geoJsonBoundingBox('{not json')).toBeNull();
    expect(geoJsonBoundingBox({ type: 'Polygon', coordinates: [] })).toBeNull();
    expect(geoJsonBoundingBox({ type: 'FeatureCollection', features: [] })).toBeNull();
  });
});

describe('unionBoundingBox', () => {
  it('encloses every value that has an extent', () => {
    expect(unionBoundingBox([POLYGON, { type: 'Point', coordinates: [10, -10] }])).toEqual({
      xmin: -2,
      xmax: 10,
      ymin: -10,
      ymax: 1,
    });
  });

  it('ignores the values that have none', () => {
    expect(unionBoundingBox([null, 'not json', POLYGON])).toEqual(EXPECTED);
  });

  it('is null when nothing has an extent', () => {
    expect(unionBoundingBox([])).toBeNull();
    expect(unionBoundingBox([null, undefined])).toBeNull();
  });
});

describe('boundingBoxesOverlap', () => {
  const a = { xmin: 0, xmax: 10, ymin: 0, ymax: 10 };

  it('is true when the boxes intersect', () => {
    expect(boundingBoxesOverlap(a, { xmin: 5, xmax: 15, ymin: 5, ymax: 15 })).toBe(true);
  });

  it('is true when one contains the other', () => {
    expect(boundingBoxesOverlap(a, { xmin: 1, xmax: 2, ymin: 1, ymax: 2 })).toBe(true);
  });

  it('is true when they only touch: a dataset on the border is not elsewhere', () => {
    expect(boundingBoxesOverlap(a, { xmin: 10, xmax: 20, ymin: 0, ymax: 10 })).toBe(true);
  });

  it('is false when they are apart on either axis', () => {
    expect(boundingBoxesOverlap(a, { xmin: 11, xmax: 20, ymin: 0, ymax: 10 })).toBe(false);
    expect(boundingBoxesOverlap(a, { xmin: 0, xmax: 10, ymin: 11, ymax: 20 })).toBe(false);
  });
});
