/**
 * Hand-authored GraphQL operations for the model-registration region picker.
 *
 * These intentionally live outside the codegen pipeline (`generated/graphql.ts`)
 * so the picker can read the geographic `region` table (categories + hierarchy)
 * and mirror selections into `modelcatalog_region` without requiring a live
 * Hasura introspection to regenerate types. Consumed via Apollo's `useQuery` /
 * `useMutation`; exported documents are reused by tests for MockedProvider.
 */
import { gql } from '@apollo/client';

export interface PickerRegion {
  id: string;
  name: string;
  category_id: string | null;
}

/** Regions whose category is one of the given categories (or their subcategories). */
export const REGIONS_BY_CATEGORIES = gql`
  query RegionsByCategories($categoryIds: [String!]!) {
    region(where: { category_id: { _in: $categoryIds } }, order_by: { name: asc }) {
      id
      name
      category_id
    }
  }
`;

/**
 * Mirror a chosen geographic region into the model catalog so the
 * configuration↔region junction (which FKs `modelcatalog_region`) can reference
 * it. Idempotent: re-selecting the same region across models reuses one row.
 */
export const UPSERT_MODELCATALOG_REGION = gql`
  mutation UpsertModelcatalogRegion($id: String!, $label: String!) {
    insert_modelcatalog_region_one(
      object: { id: $id, label: $label }
      on_conflict: { constraint: modelcatalog_region_pkey, update_columns: [] }
    ) {
      id
    }
  }
`;
