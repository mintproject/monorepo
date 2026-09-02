import { gql } from '@apollo/client';

/**
 * Catalog sizes for the landing page's Explore cards.
 *
 * Hand-authored alongside `regions.ts` rather than generated: the aggregate
 * fields only exist once `allow_aggregations: true` is applied for the
 * anonymous and user roles (graphql_engine/metadata/tables.yaml), and codegen
 * cannot see them before then.
 *
 * It is deliberately its own query. Before that metadata is applied the whole
 * document fails validation, and a missing count must cost a number on a card,
 * never the page.
 */
export const GET_CATALOG_COUNTS = gql`
  query GetCatalogCounts {
    modelcatalog_software_aggregate {
      aggregate {
        count
      }
    }
    region_aggregate {
      aggregate {
        count
      }
    }
    modelcatalog_standard_variable_aggregate {
      aggregate {
        count
      }
    }
  }
`;

type AggregateCount = { aggregate?: { count?: number | null } | null } | null;

export interface GetCatalogCountsData {
  modelcatalog_software_aggregate: AggregateCount;
  region_aggregate: AggregateCount;
  modelcatalog_standard_variable_aggregate: AggregateCount;
}
