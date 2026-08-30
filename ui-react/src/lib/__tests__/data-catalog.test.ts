/**
 * Tests for the thread wizard's dataset lookup (issue #94).
 *
 * The defect these guard against: variable names were sent to CKAN as a
 * free-text `q`. CKAN does not index `mint_standard_variables` and Solr splits
 * the names on `_` and `~`, so the query matched prose. Measured against TACC,
 * it returned the right datasets for 3 of 40 annotated variables.
 *
 * Fixtures use TACC's real wire shape: `mint_standard_variables` is a
 * comma-separated string on each *resource*, and unannotated resources carry
 * the empty string rather than nothing.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';

import { findDatasets, findDatasetsByVariables, loadDatasetResources } from '../data-catalog';
import type { CkanPackage } from '../datasets/ckan';

const CKAN_HOST = 'https://ckan.example.org';

let searchRequests: URL[] = [];

function stubSearch(results: CkanPackage[]) {
  server.use(
    http.get('*/api/3/action/package_search', ({ request }) => {
      searchRequests.push(new URL(request.url));
      return HttpResponse.json({ success: true, result: { count: results.length, results } });
    }),
  );
}

function stubShow(pkg: CkanPackage) {
  server.use(
    http.get('*/api/3/action/package_show', () =>
      HttpResponse.json({ success: true, result: pkg }),
    ),
  );
}

/** Carries the variable on one of its three resources. */
const CARRIER: CkanPackage = {
  id: 'uuid-1',
  name: 'capitan-reef-complex-aquifer-gam-files',
  title: 'Capitan Reef Complex Aquifer GAM files',
  resources: [
    { id: 'r1', format: 'zip', mint_standard_variables: 'groundwater__initial_head' },
    { id: 'r2', format: 'csv', mint_standard_variables: 'aquifer__transmissivity' },
    { id: 'r3', format: 'pdf', mint_standard_variables: '' },
  ],
};

/** The kind of row free-text search returned: the words appear, the annotation does not. */
const PROSE_MATCH: CkanPackage = {
  id: 'uuid-2',
  name: 'groundwater-initial-head-report',
  title: 'Groundwater initial head across the basin',
  notes: 'Estimates of groundwater initial head.',
  resources: [{ id: 'r4', format: 'pdf', mint_standard_variables: '' }],
};

// ─── Region fixtures (issue #97) ──────────────────────────────────────────────
//
// Every geometry shape below is one TACC actually holds in `spatial`. The old
// extractor read `coordinates[0]` and understood a bare Polygon only, so a
// client-side region filter built on it would have dropped the rest in silence.

/** Texas, near enough — the bounding box measured off the region's geometry. */
const TEXAS = { xmin: -106.64, xmax: -93.52, ymin: 25.84, ymax: 36.5 };

const TEXAS_POLYGON = JSON.stringify({
  type: 'Polygon',
  coordinates: [
    [
      [-106.64, 25.84],
      [-93.52, 25.84],
      [-93.52, 36.5],
      [-106.64, 36.5],
      [-106.64, 25.84],
    ],
  ],
});

function annotated(name: string, spatial?: string): CkanPackage {
  return {
    id: `uuid-${name}`,
    name,
    title: name,
    ...(spatial ? { spatial } : {}),
    resources: [{ id: `r-${name}`, format: 'csv', mint_standard_variables: 'a' }],
  };
}

const IN_TEXAS = annotated('in-texas', TEXAS_POLYGON);
const IN_ALASKA = annotated(
  'in-alaska',
  JSON.stringify({
    type: 'Polygon',
    coordinates: [
      [
        [-150, 60],
        [-149, 60],
        [-149, 61],
        [-150, 61],
        [-150, 60],
      ],
    ],
  }),
);
const NO_LOCATION = annotated('no-location');
const FEATURE_IN_TEXAS = annotated(
  'feature-in-texas',
  JSON.stringify({
    type: 'Feature',
    properties: {},
    geometry: JSON.parse(TEXAS_POLYGON) as unknown,
  }),
);
const FEATURE_COLLECTION_IN_TEXAS = annotated(
  'feature-collection-in-texas',
  JSON.stringify({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: JSON.parse(TEXAS_POLYGON) as unknown }],
  }),
);
const POINT_IN_TEXAS = annotated(
  'point-in-texas',
  JSON.stringify({ type: 'Point', coordinates: [-97.74, 30.27] }),
);
const MULTI_IN_ALASKA = annotated(
  'multipolygon-in-alaska',
  JSON.stringify({
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [-150, 60],
          [-149, 60],
          [-149, 61],
          [-150, 61],
          [-150, 60],
        ],
      ],
    ],
  }),
);

beforeEach(() => {
  searchRequests = [];
  window.__MINT_CONFIG__ = { DATA_CATALOG_API: CKAN_HOST } as never;
});

afterEach(() => {
  delete (window as { __MINT_CONFIG__?: unknown }).__MINT_CONFIG__;
});

describe('findDatasets', () => {
  it('does not put the variable names into CKANs q', async () => {
    stubSearch([]);
    await findDatasets({ standard_variable_names__in: ['groundwater__initial_head'] });
    expect(searchRequests).toHaveLength(1);
    expect(searchRequests[0]?.searchParams.has('q')).toBe(false);
  });

  it('returns the dataset that carries the variable', async () => {
    stubSearch([CARRIER, PROSE_MATCH]);
    const found = await findDatasets({
      standard_variable_names__in: ['groundwater__initial_head'],
    });
    expect(found.map((d) => d.id)).toEqual([CARRIER.name]);
  });

  it('drops the prose match, which free-text search would have returned', async () => {
    stubSearch([PROSE_MATCH]);
    const found = await findDatasets({
      standard_variable_names__in: ['groundwater__initial_head'],
    });
    expect(found).toEqual([]);
  });

  it('does not match a variable that only shares tokens with the annotation', async () => {
    // 'groundwater__hydraulic_head' and 'groundwater__initial_head' share both
    // Solr tokens, which is why free text conflated them.
    stubSearch([CARRIER]);
    const found = await findDatasets({
      standard_variable_names__in: ['groundwater__hydraulic_head'],
    });
    expect(found).toEqual([]);
  });

  it('reports the datatype of the matching resource, not of the first one', async () => {
    stubSearch([CARRIER]);
    const found = await findDatasets({
      standard_variable_names__in: ['aquifer__transmissivity'],
    });
    // Without narrowing, this would be 'zip' — the format of r1.
    expect(found[0]?.datatype).toBe('csv');
    expect(found[0]?.resource_count).toBe(1);
  });

  it('matches a dataset carrying any one of several requested variables', async () => {
    stubSearch([CARRIER]);
    const found = await findDatasets({
      standard_variable_names__in: ['nope', 'aquifer__transmissivity'],
    });
    expect(found).toHaveLength(1);
  });

  it('never sends ext_bbox: the region is applied here, so nothing is dropped for it', async () => {
    stubSearch([]);
    await findDatasets({
      standard_variable_names__in: ['a'],
      spatial_coverage__intersects: { xmin: -100, xmax: -97, ymin: 29, ymax: 31 },
    });
    expect(searchRequests[0]?.searchParams.has('ext_bbox')).toBe(false);
  });

  it('still narrows by date range', async () => {
    stubSearch([
      { ...CARRIER, temporal_coverage_start: '1990-01-01', temporal_coverage_end: '1995-01-01' },
    ]);
    const found = await findDatasets({
      standard_variable_names__in: ['groundwater__initial_head'],
      // findDatasets reads end_time__lte as the window start (legacy param naming).
      end_time__lte: '2020-01-01',
      start_time__gte: '2025-01-01',
    });
    expect(found).toEqual([]);
  });

  it('returns everything when no variable is requested', async () => {
    stubSearch([CARRIER, PROSE_MATCH]);
    const found = await findDatasets({});
    expect(found).toHaveLength(2);
  });

  it('labels a dataset inside the region, and one outside it, without dropping either', async () => {
    stubSearch([IN_TEXAS, IN_ALASKA]);
    const found = await findDatasets({ spatial_coverage__intersects: TEXAS });
    expect(found.map((d) => [d.id, d.region_match])).toEqual([
      [IN_TEXAS.name, 'inside'],
      [IN_ALASKA.name, 'outside'],
    ]);
  });

  it('labels a dataset with no spatial field unknown, not outside', async () => {
    // The defect this guards: ext_bbox filtered on *having* a location, so
    // these never reached the client — 11 of TACC's 33 annotated packages.
    stubSearch([NO_LOCATION]);
    const found = await findDatasets({ spatial_coverage__intersects: TEXAS });
    expect(found).toHaveLength(1);
    expect(found[0]?.region_match).toBe('unknown');
  });

  it('places a Feature and a FeatureCollection, which ext_bbox drops entirely', async () => {
    stubSearch([FEATURE_IN_TEXAS, FEATURE_COLLECTION_IN_TEXAS, POINT_IN_TEXAS, MULTI_IN_ALASKA]);
    const found = await findDatasets({ spatial_coverage__intersects: TEXAS });
    expect(found.map((d) => d.region_match)).toEqual(['inside', 'inside', 'inside', 'outside']);
  });

  it('calls everything inside when no region is asked for', async () => {
    stubSearch([IN_TEXAS, IN_ALASKA, NO_LOCATION]);
    const found = await findDatasets({});
    expect(found.every((d) => d.region_match === 'inside')).toBe(true);
  });

  it('accepts a regions list of geometries as the region', async () => {
    stubSearch([IN_TEXAS, IN_ALASKA]);
    const found = await findDatasets({
      spatial_coverage__intersects: [JSON.parse(TEXAS_POLYGON) as unknown],
    });
    expect(found.map((d) => d.region_match)).toEqual(['inside', 'outside']);
  });

  it('applies no region filter when the region carries no usable extent', async () => {
    // An empty geometry list must not read as an empty box, which would call
    // the whole catalog "elsewhere".
    stubSearch([IN_TEXAS, IN_ALASKA]);
    const found = await findDatasets({ spatial_coverage__intersects: [] });
    expect(found.map((d) => d.region_match)).toEqual(['inside', 'inside']);
  });

  it('caps the datasets returned by limit, without capping what it fetches', async () => {
    stubSearch([CARRIER, { ...CARRIER, id: 'uuid-3', name: 'second-carrier' }]);
    const found = await findDatasets({
      standard_variable_names__in: ['groundwater__initial_head'],
      limit: 1,
    });
    expect(found).toHaveLength(1);
    expect(searchRequests[0]?.searchParams.get('rows')).toBe('1000');
  });
});

describe('findDatasetsByVariables', () => {
  it('makes no request at all when there are no variables', async () => {
    stubSearch([CARRIER]);
    await expect(findDatasetsByVariables({ variableNames: [] })).resolves.toEqual([]);
    expect(searchRequests).toHaveLength(0);
  });

  it('finds the carrier through the thread wizards entry point', async () => {
    stubSearch([CARRIER, PROSE_MATCH]);
    const found = await findDatasetsByVariables({
      variableNames: ['groundwater__initial_head'],
    });
    expect(found.map((d) => d.id)).toEqual([CARRIER.name]);
    expect(found[0]?.variables).toEqual(['groundwater__initial_head']);
  });
});

describe('loadDatasetResources', () => {
  it('returns only the resources carrying the requested variable', async () => {
    stubShow(CARRIER);
    const resources = await loadDatasetResources({
      datasetId: CARRIER.name as string,
      variableNames: ['groundwater__initial_head'],
    });
    expect(resources.map((r) => r.id)).toEqual(['r1']);
  });

  it('returns every resource when no variable is given', async () => {
    stubShow(CARRIER);
    const resources = await loadDatasetResources({ datasetId: CARRIER.name as string });
    expect(resources).toHaveLength(3);
  });
});
