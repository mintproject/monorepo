/**
 * Tests for the CKAN Action API transport and its shaping helpers.
 *
 * Fixtures mirror the wire shape of a real CKAN instance
 * (ckan.tacc.utexas.edu), including its quirks: `version: "None"` as a string,
 * `spatial` as stringified GeoJSON, and temporal coverage as bare date strings.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import {
  buildSearchQuery,
  cleanString,
  overlapsDateRange,
  packageExtraFlag,
  packageSpatialCoverage,
  packageTags,
  packageTimePeriod,
  parseDate,
  searchPackages,
  showPackage,
  type CkanPackage,
} from '../ckan';

const CKAN_HOST = 'https://ckan.example.org';

/** Capture the URL of the last intercepted request so we can assert on params. */
let lastUrl: URL | null = null;

function stubSearch(results: CkanPackage[]) {
  server.use(
    http.get('*/api/3/action/package_search', ({ request }) => {
      lastUrl = new URL(request.url);
      return HttpResponse.json({ success: true, result: { count: results.length, results } });
    }),
  );
}

beforeEach(() => {
  lastUrl = null;
  window.__MINT_CONFIG__ = { DATA_CATALOG_API: CKAN_HOST } as never;
});

afterEach(() => {
  delete (window as { __MINT_CONFIG__?: unknown }).__MINT_CONFIG__;
});

// ─── Transport ────────────────────────────────────────────────────────────────

describe('searchPackages', () => {
  it('unwraps the CKAN envelope and returns the results array', async () => {
    stubSearch([{ id: 'a', name: 'pkg-a' }]);
    const packages = await searchPackages({});
    expect(packages).toHaveLength(1);
    expect(packages[0]?.name).toBe('pkg-a');
  });

  it('defaults to 100 rows and omits q when no query is given', async () => {
    stubSearch([]);
    await searchPackages({});
    expect(lastUrl?.searchParams.get('rows')).toBe('100');
    expect(lastUrl?.searchParams.has('q')).toBe(false);
  });

  it('sends ext_bbox as minx,miny,maxx,maxy', async () => {
    stubSearch([]);
    await searchPackages({ boundingBox: { xmin: -100, xmax: -97, ymin: 29, ymax: 31 } });
    // Not xmin,xmax,ymin,ymax — CKAN interleaves the axes.
    expect(lastUrl?.searchParams.get('ext_bbox')).toBe('-100,29,-97,31');
  });

  it('hits the /api/3/action path on the configured host', async () => {
    stubSearch([]);
    await searchPackages({ q: 'rain' });
    expect(lastUrl?.origin).toBe(CKAN_HOST);
    expect(lastUrl?.pathname).toBe('/api/3/action/package_search');
    expect(lastUrl?.searchParams.get('q')).toBe('rain');
  });

  it('throws on a non-2xx response', async () => {
    server.use(
      http.get('*/api/3/action/package_search', () => new HttpResponse(null, { status: 500 })),
    );
    await expect(searchPackages({})).rejects.toThrow(/package_search failed/);
  });

  it('throws when CKAN reports success: false', async () => {
    server.use(
      http.get('*/api/3/action/package_search', () =>
        HttpResponse.json({ success: false, error: { message: 'Bad request' } }),
      ),
    );
    await expect(searchPackages({})).rejects.toThrow(/Bad request/);
  });

  it('throws when the envelope carries no result', async () => {
    server.use(
      http.get('*/api/3/action/package_search', () => HttpResponse.json({ success: true })),
    );
    await expect(searchPackages({})).rejects.toThrow(/package_search failed/);
  });
});

describe('showPackage', () => {
  it('passes the id through and returns the package', async () => {
    server.use(
      http.get('*/api/3/action/package_show', ({ request }) => {
        lastUrl = new URL(request.url);
        return HttpResponse.json({ success: true, result: { id: 'x', name: 'my-slug' } });
      }),
    );
    const pkg = await showPackage('my-slug');
    expect(lastUrl?.searchParams.get('id')).toBe('my-slug');
    expect(pkg.name).toBe('my-slug');
  });

  it('throws a not-found error through the envelope', async () => {
    server.use(
      http.get('*/api/3/action/package_show', () =>
        HttpResponse.json({ success: false, error: { message: 'Not found' } }),
      ),
    );
    await expect(showPackage('nope')).rejects.toThrow(/Not found/);
  });
});

// ─── Query building ───────────────────────────────────────────────────────────

describe('buildSearchQuery', () => {
  it('returns undefined when there is nothing to search on', () => {
    expect(buildSearchQuery({})).toBeUndefined();
    expect(buildSearchQuery({ variables: [] })).toBeUndefined();
  });

  it('quotes a single name as a phrase', () => {
    expect(buildSearchQuery({ name: 'soil moisture' })).toBe('"soil moisture"');
  });

  it('ORs multiple variables inside parentheses', () => {
    expect(buildSearchQuery({ variables: ['precipitation', 'temperature'] })).toBe(
      '("precipitation" OR "temperature")',
    );
  });

  it('does not parenthesise a lone variable', () => {
    expect(buildSearchQuery({ variables: ['precipitation'] })).toBe('"precipitation"');
  });

  it('ANDs a name together with the variable clause', () => {
    expect(buildSearchQuery({ name: 'ethiopia', variables: ['a', 'b'] })).toBe(
      '"ethiopia" AND ("a" OR "b")',
    );
  });

  it('escapes embedded quotes so Solr does not see an unbalanced phrase', () => {
    expect(buildSearchQuery({ name: 'say "hi"' })).toBe('"say \\"hi\\""');
  });

  it('drops empty variable entries', () => {
    expect(buildSearchQuery({ variables: ['', 'real'] })).toBe('"real"');
  });
});

// ─── Shaping helpers ──────────────────────────────────────────────────────────

describe('cleanString', () => {
  it('treats CKANs literal "None" as empty', () => {
    expect(cleanString('None')).toBe('');
  });

  it('maps null and undefined to empty', () => {
    expect(cleanString(null)).toBe('');
    expect(cleanString(undefined)).toBe('');
  });

  it('passes real values through', () => {
    expect(cleanString('1.0')).toBe('1.0');
    expect(cleanString(0)).toBe('0');
  });
});

describe('parseDate', () => {
  it('parses an ISO date', () => {
    expect(parseDate('2023-01-01')?.getUTCFullYear()).toBe(2023);
  });

  it('returns null for "None", empty, and unparseable input', () => {
    expect(parseDate('None')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('not-a-date')).toBeNull();
  });
});

describe('packageTimePeriod', () => {
  it('returns null when neither bound is present', () => {
    expect(packageTimePeriod({})).toBeNull();
  });

  it('returns a period when only one bound is present', () => {
    const period = packageTimePeriod({ temporal_coverage_start: '2023-01-01' });
    expect(period?.start_date).toBeInstanceOf(Date);
    expect(period?.end_date).toBeNull();
  });

  it('reads both bounds', () => {
    const period = packageTimePeriod({
      temporal_coverage_start: '2023-01-01',
      temporal_coverage_end: '2023-12-31',
    });
    expect(period?.start_date?.getUTCFullYear()).toBe(2023);
    expect(period?.end_date?.getUTCMonth()).toBe(11);
  });
});

describe('packageSpatialCoverage', () => {
  const polygon = JSON.stringify({
    type: 'Polygon',
    coordinates: [
      [
        [-97.7, 30.3],
        [-97.7, 30.4],
        [-97.6, 30.4],
        [-97.6, 30.3],
        [-97.7, 30.3],
      ],
    ],
  });

  it('unwraps the outer GeoJSON polygon ring', () => {
    const coverage = packageSpatialCoverage({ spatial: polygon });
    expect(coverage?.type).toBe('Polygon');
    // One level shallower than the GeoJSON nesting.
    expect(coverage?.coordinates?.[0]).toEqual([-97.7, 30.3]);
    expect(coverage?.coordinates).toHaveLength(5);
  });

  it('returns undefined when spatial is absent', () => {
    expect(packageSpatialCoverage({})).toBeUndefined();
  });

  it('returns undefined rather than throwing on malformed JSON', () => {
    expect(packageSpatialCoverage({ spatial: '{not json' })).toBeUndefined();
  });

  it('returns undefined when the geometry has no type', () => {
    expect(packageSpatialCoverage({ spatial: '{"coordinates":[]}' })).toBeUndefined();
  });
});

describe('packageTags', () => {
  it('extracts tag names and drops empty ones', () => {
    expect(packageTags({ tags: [{ name: 'climate' }, { name: '' }, {}] })).toEqual(['climate']);
  });

  it('returns an empty array when there are no tags', () => {
    expect(packageTags({})).toEqual([]);
  });
});

describe('packageExtraFlag', () => {
  it('is true only for the string "true"', () => {
    const pkg: CkanPackage = {
      extras: [
        { key: 'is_cached', value: 'true' },
        { key: 'dataset_repr', value: 'false' },
      ],
    };
    expect(packageExtraFlag(pkg, 'is_cached')).toBe(true);
    expect(packageExtraFlag(pkg, 'dataset_repr')).toBe(false);
    expect(packageExtraFlag(pkg, 'missing')).toBe(false);
  });

  it('is false when there are no extras', () => {
    expect(packageExtraFlag({}, 'is_cached')).toBe(false);
  });
});

describe('overlapsDateRange', () => {
  const pkg: CkanPackage = {
    temporal_coverage_start: '2023-01-01',
    temporal_coverage_end: '2023-12-31',
  };

  it('keeps everything when no window is requested', () => {
    expect(overlapsDateRange(pkg)).toBe(true);
  });

  it('keeps packages with no coverage rather than dropping them', () => {
    expect(overlapsDateRange({}, new Date('2020-01-01'), new Date('2020-12-31'))).toBe(true);
  });

  it('keeps an overlapping package', () => {
    expect(overlapsDateRange(pkg, new Date('2023-06-01'), new Date('2024-06-01'))).toBe(true);
  });

  it('drops a package entirely after the window', () => {
    expect(overlapsDateRange(pkg, new Date('2019-01-01'), new Date('2020-01-01'))).toBe(false);
  });

  it('drops a package entirely before the window', () => {
    expect(overlapsDateRange(pkg, new Date('2025-01-01'), new Date('2026-01-01'))).toBe(false);
  });

  it('treats a touching boundary as an overlap', () => {
    expect(overlapsDateRange(pkg, new Date('2023-12-31'), new Date('2024-06-01'))).toBe(true);
  });
});
