/**
 * Hand-authored mutation for the model-registration region picker.
 *
 * The picker reads regions via the generated `useListRegionsByCategoryQuery`
 * (same query the /regions pages use, so it shares the `parent_region_id IS NOT
 * NULL` leaf filter). Only this upsert is hand-authored: it has no generated
 * counterpart and would otherwise need a codegen run against a live Hasura.
 */
import { gql } from '@apollo/client';

/** The region shape the picker map/list needs (a subset of the generated type). */
export interface PickerRegion {
  id: string;
  name: string;
  geometries: Array<{ id: number; geometry: string | GeoJSON.Geometry }>;
}

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
