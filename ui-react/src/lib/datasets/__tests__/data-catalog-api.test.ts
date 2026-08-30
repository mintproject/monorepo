/**
 * Tests for the CKAN-backed data catalog client.
 *
 * The behaviour under test is what `/datasets/search` asks of it. Standard
 * variable names cannot be searched through CKAN's `q` — Solr does not index
 * `mint_standard_variables` and tokenises the names on `_` — so the client must
 * read the catalog and match the annotation itself. See the header of ./ckan.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { searchDatasets } from '../data-catalog-api';
import type { CkanPackage } from '../ckan';

const CKAN_HOST = 'https://ckan.example.org';

/** Every `package_search` URL the client asked for, in order. */
let requestedUrls: URL[] = [];

/**
 * Serve `packages` from `package_search`, honouring `rows`/`start` so that a
 * client which fails to page sees a truncated catalog, exactly as CKAN does.
 */
function stubCatalog(packages: CkanPackage[]) {
  server.use(
    http.get('*/api/3/action/package_search', ({ request }) => {
      const url = new URL(request.url);
      requestedUrls.push(url);
      const start = Number(url.searchParams.get('start') ?? 0);
      const rows = Number(url.searchParams.get('rows') ?? 100);
      return HttpResponse.json({
        success: true,
        result: { count: packages.length, results: packages.slice(start, start + rows) },
      });
    }),
  );
}

/** A package carrying `variables` on its single resource. */
function annotated(name: string, ...variables: string[]): CkanPackage {
  return {
    id: name,
    name,
    title: name,
    resources: [{ id: `${name}-r1`, format: 'CSV', mint_standard_variables: variables.join(',') }],
  };
}

beforeEach(() => {
  requestedUrls = [];
  window.__MINT_CONFIG__ = { DATA_CATALOG_API: CKAN_HOST } as never;
});

afterEach(() => {
  delete (window as { __MINT_CONFIG__?: unknown }).__MINT_CONFIG__;
});

describe('searchDatasets — variable name search', () => {
  const catalog: CkanPackage[] = [
    annotated('gam-heads', 'groundwater__initial_head'),
    annotated('gam-transmissivity', 'aquifer__transmissivity'),
    annotated('nlp-corpus', 'corpus_nlp'),
    {
      // Reads as groundwater in prose, carries no annotation at all.
      id: 'groundwater-report',
      name: 'groundwater-report',
      title: 'Groundwater report',
      notes: 'A report on groundwater across the basin.',
      resources: [{ id: 'gr-r1', format: 'PDF' }],
    },
  ];

  it('matches the annotation rather than prose', async () => {
    stubCatalog(catalog);
    const results = await searchDatasets({ variableSubstring: 'groundwater' });
    expect(results.map((d) => d.id)).toEqual(['gam-heads']);
  });

  it('finds an underscored variable name that a Solr q cannot', async () => {
    stubCatalog(catalog);
    const results = await searchDatasets({ variableSubstring: 'corpus_nlp' });
    expect(results.map((d) => d.id)).toEqual(['nlp-corpus']);
  });

  it('never sends the variable term to CKAN as a query', async () => {
    stubCatalog(catalog);
    await searchDatasets({ variableSubstring: 'groundwater' });
    for (const url of requestedUrls) {
      expect(url.searchParams.get('q')).toBeNull();
    }
  });

  it('matches on a fragment of the name, not just the whole name', async () => {
    stubCatalog(catalog);
    const results = await searchDatasets({ variableSubstring: 'transmiss' });
    expect(results.map((d) => d.id)).toEqual(['gam-transmissivity']);
  });

  it('ignores case', async () => {
    stubCatalog(catalog);
    const results = await searchDatasets({ variableSubstring: 'AQUIFER' });
    expect(results.map((d) => d.id)).toEqual(['gam-transmissivity']);
  });

  it('reports the variables the dataset actually carries', async () => {
    stubCatalog([annotated('multi', 'soil__porosity', 'soil__water_content')]);
    const [ds] = await searchDatasets({ variableSubstring: 'porosity' });
    expect(ds?.variables).toEqual(['soil__porosity', 'soil__water_content']);
  });

  it('lists the whole catalog when no term is given', async () => {
    stubCatalog(catalog);
    const results = await searchDatasets({});
    expect(results).toHaveLength(catalog.length);
  });
});

describe('searchDatasets — paging', () => {
  /** More packages than CKAN's per-request default of 100. */
  const big: CkanPackage[] = Array.from({ length: 215 }, (_, i) =>
    annotated(`pkg-${i}`, i % 2 === 0 ? 'soil__porosity' : 'soil__water_content'),
  );

  it('reads past the 100-row default when listing every dataset', async () => {
    stubCatalog(big);
    const results = await searchDatasets({});
    expect(results).toHaveLength(215);
  });

  it('reads the whole catalog before matching variables, not just the first page', async () => {
    stubCatalog(big);
    const results = await searchDatasets({ variableSubstring: 'porosity' });
    expect(results).toHaveLength(108);
  });

  it('reads past the 100-row default for a name search too', async () => {
    stubCatalog(big);
    const results = await searchDatasets({ name: '*pkg*' });
    expect(results).toHaveLength(215);
    expect(requestedUrls[0]?.searchParams.get('q')).toBe('"*pkg*"');
  });
});
