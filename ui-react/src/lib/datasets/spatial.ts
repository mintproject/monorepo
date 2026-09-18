import { boundingBoxesOverlap, geoJsonBoundingBox, type BoundingBox } from '@/lib/geo/bbox';
import type { Dataset, SpatialCoverage } from './types';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Convert the catalog's coverage envelope or GeoJSON coordinates to a box. */
export function spatialCoverageBoundingBox(
  coverage: SpatialCoverage | undefined,
): BoundingBox | null {
  if (!coverage) return null;

  const value = coverage.value;
  if (value) {
    if (isFiniteNumber(value.x) && isFiniteNumber(value.y)) {
      return { xmin: value.x, xmax: value.x, ymin: value.y, ymax: value.y };
    }
    if (
      isFiniteNumber(value.xmin) &&
      isFiniteNumber(value.xmax) &&
      isFiniteNumber(value.ymin) &&
      isFiniteNumber(value.ymax)
    ) {
      return {
        xmin: value.xmin,
        xmax: value.xmax,
        ymin: value.ymin,
        ymax: value.ymax,
      };
    }
  }

  return geoJsonBoundingBox(coverage);
}

/** A dataset matches when its declared spatial extent overlaps the selected box. */
export function datasetOverlapsBoundingBox(dataset: Dataset, box: BoundingBox): boolean {
  const datasetBox = spatialCoverageBoundingBox(dataset.spatial_coverage);
  return datasetBox ? boundingBoxesOverlap(datasetBox, box) : false;
}
