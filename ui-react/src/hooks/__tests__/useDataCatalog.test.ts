/**
 * Tests for useDataCatalogDatasets hook.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useDataCatalogDatasets } from '../useDataCatalog';

/** A CKAN package_search envelope, matching the live ckan.tacc.utexas.edu shape. */
const mockResponse = {
  success: true,
  result: {
    count: 1,
    results: [
      {
        id: '85a6781e-5ee6-41cc-957b-9eb7678454f1',
        name: 'ds-001',
        title: 'Test Dataset',
        notes: 'A test dataset',
        version: '1.0',
        url: 'https://test.example.com',
        license_title: '',
        num_resources: 5,
        organization: { name: 'test-source', title: 'Test Source' },
        tags: [{ name: 'climate' }],
        temporal_coverage_start: '2023-01-01',
        temporal_coverage_end: '2023-12-31',
        resources: [
          {
            id: 'r-1',
            name: 'part-1',
            url: 'https://test.example.com/1',
            format: 'NetCDF',
            // The annotation is what the lookup matches on — a package whose
            // resources carry none is not a hit, however well its prose reads.
            mint_standard_variables: 'precipitation__daily',
          },
        ],
      },
    ],
  },
};

describe('useDataCatalogDatasets', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/3/action/package_search', () => {
        return HttpResponse.json(mockResponse);
      }),
    );
  });

  it('returns empty array and not loading initially when skip=true', async () => {
    const { result } = renderHook(() =>
      useDataCatalogDatasets({
        variableNames: ['precipitation__daily'],
        skip: true,
      }),
    );

    expect(result.current.datasets).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('returns empty array when no variable names provided', async () => {
    const { result } = renderHook(() =>
      useDataCatalogDatasets({
        variableNames: [],
      }),
    );

    expect(result.current.datasets).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('fetches datasets when variable names are provided', async () => {
    const { result } = renderHook(() =>
      useDataCatalogDatasets({
        variableNames: ['precipitation__daily'],
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.datasets).toHaveLength(1);
    expect(result.current.datasets[0]?.name).toBe('Test Dataset');
    expect(result.current.datasets[0]?.id).toBe('ds-001');
  });

  it('returns an error when the fetch fails', async () => {
    server.use(
      http.get('*/api/3/action/package_search', () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const { result } = renderHook(() =>
      useDataCatalogDatasets({
        variableNames: ['precipitation__daily'],
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('exposes a reload function', () => {
    const { result } = renderHook(() =>
      useDataCatalogDatasets({
        variableNames: ['precipitation__daily'],
        skip: true,
      }),
    );

    expect(typeof result.current.reload).toBe('function');
  });
});
