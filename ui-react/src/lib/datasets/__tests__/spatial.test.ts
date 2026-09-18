import { describe, expect, it } from 'vitest';

import { datasetOverlapsBoundingBox, spatialCoverageBoundingBox } from '../spatial';

describe('dataset spatial filtering', () => {
  it('normalizes a catalog bounding-box envelope', () => {
    expect(
      spatialCoverageBoundingBox({
        type: 'BoundingBox',
        value: { xmin: -100, xmax: -97, ymin: 29, ymax: 31 },
      }),
    ).toEqual({ xmin: -100, xmax: -97, ymin: 29, ymax: 31 });
  });

  it('matches datasets whose coverage overlaps the selected box', () => {
    const dataset = {
      spatial_coverage: {
        type: 'BoundingBox',
        value: { xmin: -100, xmax: -97, ymin: 29, ymax: 31 },
      },
    } as never;

    expect(datasetOverlapsBoundingBox(dataset, { xmin: -99, xmax: -96, ymin: 30, ymax: 32 })).toBe(
      true,
    );
    expect(datasetOverlapsBoundingBox(dataset, { xmin: -96, xmax: -95, ymin: 30, ymax: 32 })).toBe(
      false,
    );
  });
});
