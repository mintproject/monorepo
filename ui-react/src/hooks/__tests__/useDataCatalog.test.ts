/**
 * Tests for useDataCatalogDatasets hook.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useDataCatalogDatasets } from '../useDataCatalog';

const mockResponse = {
  result: 'success',
  datasets: [
    {
      dataset_id: 'ds-001',
      dataset_name: 'Test Dataset',
      dataset_metadata: {
        dataset_description: 'A test dataset',
        version: '1.0',
        limitations: '',
        source: 'Test Source',
        source_url: 'https://test.example.com',
        source_type: 'remote',
        category_tags: ['climate'],
        resource_count: 5,
        datatype: 'NetCDF',
        temporal_coverage: {
          start_time: '2023-01-01',
          end_time: '2023-12-31',
        },
      },
    },
  ],
};

describe('useDataCatalogDatasets', () => {
  beforeEach(() => {
    server.use(
      http.post('*/datasets/find', () => {
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
      http.post('*/datasets/find', () => {
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
