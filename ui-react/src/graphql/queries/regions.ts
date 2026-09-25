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

/**
 * Registered boundary geometries used by spatial selection. These are the
 * same region records managed from the /regions pages; adapter layer sources
 * remain available as a fallback when a source has not been registered yet.
 */
export const LIST_REGISTERED_BOUNDARY_REGIONS = gql`
  query ListRegisteredBoundaryRegions($categoryIds: [String!]!) {
    region(
      where: {
        parent_region_id: { _is_null: false }
        _or: [
          { category_id: { _in: $categoryIds } }
          {
            region_category: { category_trees: { region_category_parent_id: { _eq: "hydrology" } } }
          }
        ]
      }
      order_by: { name: asc }
    ) {
      id
      name
      category_id
      region_category {
        id
        name
      }
      geometries {
        geometry
      }
    }
  }
`;
