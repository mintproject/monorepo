// @vitest-environment jsdom
/**
 * The counts come from two independent, optional sources. What matters is that
 * either one going missing costs a number and nothing else -- the live TACC
 * Hasura still answers `field 'modelcatalog_software_aggregate' not found`
 * until the `allow_aggregations` metadata is applied.
 */
import type { MockedResponse } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing';
import { renderHook, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET_CATALOG_COUNTS } from '@/graphql/queries/catalog-counts';
import { useCatalogCounts } from '@/hooks/useCatalogCounts';

const countPackages = vi.hoisted(() => vi.fn());
vi.mock('@/lib/datasets/ckan', () => ({ countPackages }));

const countsMock: MockedResponse = {
  request: { query: GET_CATALOG_COUNTS, variables: {} },
  result: {
    data: {
      modelcatalog_software_aggregate: { aggregate: { count: 42 } },
      region_aggregate: { aggregate: { count: 7 } },
      modelcatalog_standard_variable_aggregate: { aggregate: { count: 1204 } },
    },
  },
};

/** What the anonymous role returns today, before the metadata is applied. */
const aggregatesUnavailableMock: MockedResponse = {
  request: { query: GET_CATALOG_COUNTS, variables: {} },
  result: {
    errors: [
      new GraphQLError("field 'modelcatalog_software_aggregate' not found in type: 'query_root'"),
    ],
  },
};

function renderCounts(mocks: MockedResponse[]) {
  return renderHook(() => useCatalogCounts(), {
    wrapper: ({ children }) => <MockedProvider mocks={mocks}>{children}</MockedProvider>,
  });
}

describe('useCatalogCounts', () => {
  beforeEach(() => {
    countPackages.mockReset();
  });

  it('reports every count when both sources answer', async () => {
    countPackages.mockResolvedValue(211);
    const { result } = renderCounts([countsMock]);

    await waitFor(() => {
      expect(result.current).toEqual({ models: 42, regions: 7, variables: 1204, datasets: 211 });
    });
  });

  it('still reports the dataset count when Hasura rejects the aggregates', async () => {
    countPackages.mockResolvedValue(211);
    const { result } = renderCounts([aggregatesUnavailableMock]);

    await waitFor(() => {
      expect(result.current).toEqual({ datasets: 211 });
    });
  });

  it('still reports the Hasura counts when the data catalog is down', async () => {
    countPackages.mockRejectedValue(new Error('ECONNREFUSED'));
    const { result } = renderCounts([countsMock]);

    await waitFor(() => {
      expect(result.current).toEqual({ models: 42, regions: 7, variables: 1204 });
    });
  });

  it('reports nothing at all rather than throwing when both sources fail', async () => {
    countPackages.mockRejectedValue(new Error('ECONNREFUSED'));
    const { result } = renderCounts([aggregatesUnavailableMock]);

    await waitFor(() => {
      expect(result.current).toEqual({});
    });
  });
});
