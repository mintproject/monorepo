import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/msw/server';
import { discoverDatasets } from '../discovery';

const CKAN_HOST = 'https://ckan.example.org';
const SEMANTIC_HOST = 'https://semantic.example.org';

afterEach(() => {
  delete (window as { __MINT_CONFIG__?: unknown }).__MINT_CONFIG__;
});

describe('discoverDatasets', () => {
  it('resolves a natural-language query through SVO search before matching CKAN annotations', async () => {
    const semanticUrls: URL[] = [];
    server.use(
      http.get('*/search', ({ request }) => {
        semanticUrls.push(new URL(request.url));
        return HttpResponse.json({
          results: [
            {
              id: 'https://w3id.org/okn/i/mint/rainfall',
              label: 'rainfall',
              score: 0.92,
            },
          ],
        });
      }),
      http.get('*/api/3/action/package_search', () =>
        HttpResponse.json({
          success: true,
          result: {
            count: 2,
            results: [
              {
                id: 'dataset-1',
                name: 'rainfall-observations',
                title: 'Rainfall observations',
                resources: [
                  {
                    id: 'resource-1',
                    format: 'CSV',
                    mint_standard_variables: 'https://w3id.org/okn/i/mint/rainfall',
                  },
                ],
              },
              {
                id: 'dataset-2',
                name: 'rainfall-report',
                title: 'Rainfall report',
                notes: 'A report that mentions rainfall but has no SVO annotation.',
                resources: [{ id: 'resource-2', format: 'PDF', mint_standard_variables: '' }],
              },
            ],
          },
        }),
      ),
    );
    window.__MINT_CONFIG__ = {
      DATA_CATALOG_API: CKAN_HOST,
      SEMANTIC_SEARCH_API: SEMANTIC_HOST,
    } as never;

    const result = await discoverDatasets({ query: 'rainfall observations' });

    expect(semanticUrls).toHaveLength(1);
    expect(semanticUrls[0]?.searchParams.get('q')).toBe('rainfall observations');
    expect(semanticUrls[0]?.searchParams.get('target')).toBe('svo');
    expect(result.datasets.map((dataset) => dataset.id)).toEqual(['rainfall-observations']);
    expect(result.datasets[0]?.matched_variables).toEqual(['rainfall']);
    expect(result.datasets[0]?.semantic_score).toBe(0.92);
  });
});
