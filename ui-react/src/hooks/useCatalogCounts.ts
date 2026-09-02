import { useEffect, useState } from 'react';

import { useQuery } from '@apollo/client';

import { GET_CATALOG_COUNTS, type GetCatalogCountsData } from '@/graphql/queries/catalog-counts';
import { countPackages } from '@/lib/datasets/ckan';

import type { ExploreKey } from '@/components/home/explore-destinations';

/**
 * How big each part of the catalog is, for the landing page's Explore cards.
 *
 * Every count is optional and independent. Three come from one Hasura
 * aggregate query; datasets come from CKAN, which is a different service
 * entirely. Either source can be unavailable -- the aggregate fields need
 * `allow_aggregations: true` in the Hasura metadata, and the data catalog is a
 * separate deployment -- so a count that cannot be had is simply absent, and
 * the card renders without a number rather than not at all.
 */
export type CatalogCounts = Partial<Record<ExploreKey, number>>;

export function useCatalogCounts(): CatalogCounts {
  const { data } = useQuery<GetCatalogCountsData>(GET_CATALOG_COUNTS, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-first',
  });

  const datasets = useDatasetCount();

  const counts: CatalogCounts = {};
  const models = data?.modelcatalog_software_aggregate?.aggregate?.count;
  const regions = data?.region_aggregate?.aggregate?.count;
  const variables = data?.modelcatalog_standard_variable_aggregate?.aggregate?.count;

  if (typeof models === 'number') counts.models = models;
  if (typeof regions === 'number') counts.regions = regions;
  if (typeof variables === 'number') counts.variables = variables;
  if (typeof datasets === 'number') counts.datasets = datasets;

  return counts;
}

/**
 * The data catalog's package total. CKAN is not Apollo, so this is a plain
 * fetch; a failure resolves to no count at all.
 */
function useDatasetCount(): number | undefined {
  const [count, setCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();

    countPackages({ signal: controller.signal })
      .then((total) => setCount(total))
      .catch(() => {
        // The data catalog is a separate service; the landing page does not
        // depend on it being up.
      });

    return () => controller.abort();
  }, []);

  return count;
}
