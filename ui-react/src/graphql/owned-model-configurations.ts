import { gql } from '@apollo/client';

export interface OwnedModelConfigurationsData {
  modelcatalog_configuration: Array<{
    id: string;
    child_configurations: Array<{ id: string }>;
  }>;
}

/**
 * Ownership operations are kept inline until Hasura's schema snapshot is
 * regenerated after the ownership migration is applied. They intentionally
 * return only IDs (and child IDs), never the owner's identity.
 */
export const GET_OWNED_MODEL_CONFIGURATIONS = gql`
  query GetOwnedModelConfigurations($ownerUsername: String!) {
    modelcatalog_configuration(
      where: { owner_username: { _eq: $ownerUsername }, model_configuration_id: { _is_null: true } }
      order_by: { label: asc }
      limit: 500
    ) {
      id
      child_configurations {
        id
      }
    }
  }
`;

export const CREATE_OWNED_MODEL_CONFIGURATION = gql`
  mutation CreateOwnedModelConfiguration(
    $id: String!
    $label: String!
    $description: String
    $softwareVersionId: String
    $componentLocation: String
    $ownerUsername: String!
  ) {
    insert_modelcatalog_configuration_one(
      object: {
        id: $id
        label: $label
        description: $description
        software_version_id: $softwareVersionId
        has_component_location: $componentLocation
        owner_username: $ownerUsername
      }
    ) {
      id
      label
      software_version_id
      has_component_location
    }
  }
`;

export const DELETE_MODEL_CONFIGURATION = gql`
  mutation DeleteModelConfiguration($id: String!) {
    delete_modelcatalog_configuration_by_pk(id: $id) {
      id
    }
  }
`;
