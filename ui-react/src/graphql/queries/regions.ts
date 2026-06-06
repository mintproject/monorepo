import { gql } from '@apollo/client';

/**
 * Query for top-level regions (those with no parent).
 * Matches the legacy list-top.graphql query.
 */
export const LIST_TOP_REGIONS = gql`
  query ListTopRegions {
    region(where: { parent_region_id: { _is_null: true } }) {
      id
      name
      model_catalog_uri
      geometries {
        geometry
      }
    }
  }
`;
