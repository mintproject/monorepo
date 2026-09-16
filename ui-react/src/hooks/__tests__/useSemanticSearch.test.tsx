import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSemanticSearchUrl, useSemanticSearch } from '@/hooks/useSemanticSearch';

describe('useSemanticSearch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('builds explicit targets and repeated hard-filter parameters', () => {
    const url = new URL(
      buildSemanticSearchUrl('water table', {
        target: 'model_configuration',
        baseUrl: 'https://semantic.example.test/',
        filters: {
          regionIds: ['r1', 'r2'],
          categoryIds: ['c1'],
          outputVariableIds: ['v1'],
        },
      }),
    );

    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('target')).toBe('model_configuration');
    expect(url.searchParams.getAll('region_id')).toEqual(['r1', 'r2']);
    expect(url.searchParams.getAll('category_id')).toEqual(['c1']);
    expect(url.searchParams.getAll('output_variable_id')).toEqual(['v1']);
  });

  it('does not let an older request overwrite a newer query', async () => {
    const resolvers: Array<(body: unknown) => void> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push((body) => resolve({ ok: true, json: async () => body } as Response));
        }),
    );

    const { result, rerender } = renderHook(
      ({ query }) => useSemanticSearch(query, { target: 'svo' }),
      { initialProps: { query: 'first' } },
    );
    await waitFor(() => expect(resolvers).toHaveLength(1));

    rerender({ query: 'second' });
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () => {
      resolvers[1]!({ results: [{ id: 'new', label: 'New' }] });
      await Promise.resolve();
    });
    expect(result.current.results).toEqual([{ id: 'new', label: 'New' }]);

    await act(async () => {
      resolvers[0]!({ results: [{ id: 'old', label: 'Old' }] });
      await Promise.resolve();
    });
    expect(result.current.results).toEqual([{ id: 'new', label: 'New' }]);
  });
});
