"""Thin async Hasura GraphQL client.

Reads use the admin secret. Writes triggered by an end user forward that user's
bearer token (JWT), matching the model-catalog-api convention:
  - read operations use admin secret
  - write operations forward the user's JWT
"""
from __future__ import annotations

from typing import Any

import httpx

from .config import settings


class HasuraError(RuntimeError):
    pass


def get_client(bearer_token: str | None = None):
    """Return the metadata client: the in-memory demo store when demo_mode is on,
    otherwise a real Hasura GraphQL client. Both expose ``execute``."""
    if settings.demo_mode:
        from .store import InMemoryHasura
        return InMemoryHasura(bearer_token)
    return HasuraClient(bearer_token)


class HasuraClient:
    def __init__(self, bearer_token: str | None = None) -> None:
        self._bearer = bearer_token

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if settings.hasura_admin_secret:
            # Adapter schema tables have no user-level Hasura permissions; always
            # use admin secret so all adapter.* queries succeed.  Bearer token
            # forwarding is a future hook for row-level security once permissions
            # are defined on the adapter tables.
            headers["x-hasura-admin-secret"] = settings.hasura_admin_secret
        elif self._bearer:
            headers["Authorization"] = f"Bearer {self._bearer}"
        return headers

    async def execute(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = {"query": query, "variables": variables or {}}
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            resp = await client.post(
                settings.hasura_graphql_url, json=payload, headers=self._headers()
            )
        resp.raise_for_status()
        body = resp.json()
        if "errors" in body:
            raise HasuraError(str(body["errors"]))
        return body["data"]


# ---------------------------------------------------------------------------
# Queries the planner relies on. The model-input requirement is read straight
# from the existing model catalog tables; the data-object contract from the
# adapter schema.
# ---------------------------------------------------------------------------

# Reads a DatasetSpecification + its variable presentation(s) so the planner can
# build the *target contract*. Names verified against the live Hasura schema:
#   dataset_specification.presentations -> junction -> .presentation
#   variable_presentation.has_standard_variable is a scalar URI (object rel: standard_variable)
#   variable_presentation.uses_unit is a scalar (object rel: unit)
#   has_dimensionality is an Int.
MODEL_INPUT_REQUIREMENT_QUERY = """
query ModelInputRequirement($ds_id: String!) {
  modelcatalog_dataset_specification(where: {id: {_eq: $ds_id}}) {
    id
    label
    has_format
    has_dimensionality
    presentations {
      presentation {
        id
        label
        has_standard_variable
        standard_variable { id label }
        uses_unit
        unit { id label }
      }
    }
  }
}
"""

# Lists all registered data objects (for the UI source picker + as model-run sources).
LIST_DATA_OBJECTS_QUERY = """
query ListDataObjects {
  adapter_data_object {
    id label resource_uri format source_catalog
    variables { standard_variable_uri local_name unit spatial_type crs }
  }
}
"""

# Reads a registered data object + its variable contract(s) from adapter schema.
DATA_OBJECT_CONTRACT_QUERY = """
query DataObjectContract($id: String!) {
  adapter_data_object(where: {id: {_eq: $id}}) {
    id label resource_uri format extension mime_type source_catalog
    variables {
      id standard_variable_uri local_name unit dimensionality
      spatial_type crs grid_id grid_description temporal_resolution schema_json
    }
  }
}
"""

# Reads the transform registry (specs + their input/output contracts) so the
# planner can search for a path. For a large registry this would be filtered.
TRANSFORM_REGISTRY_QUERY = """
query TransformRegistry {
  adapter_transform_spec {
    id name version transform_type is_lossy method tapis_app_id app_version
    container_image parameters_schema_json
    stage env_from_args file_inputs
    mint_model_config_id mint_synced_at
    contracts {
      id role standard_variable_uri format unit dimensionality
      spatial_type crs_requirement temporal_resolution schema_requirement_json
      metadata_json
    }
  }
}
"""

# Upsert a single transform_spec row from the MINT sync. ON CONFLICT on
# mint_model_config_id: update all mutable fields. Contracts are deleted and
# re-inserted via the nested insert so the set is always authoritative.
UPSERT_TRANSFORM_SPEC_MUTATION = """
mutation UpsertMintSyncSpec($obj: adapter_transform_spec_insert_input!) {
  insert_adapter_transform_spec_one(
    object: $obj
    on_conflict: {
      constraint: transform_spec_mint_model_config_id_key
      update_columns: [
        name description transform_type method tapis_app_id app_version
        stage env_from_args file_inputs mint_synced_at
      ]
    }
  ) { id mint_model_config_id }
}
"""

# Delete spec rows whose mint_model_config_id is NOT in the live MINT set.
# Rows with null mint_model_config_id (hand-created or legacy) are untouched.
DELETE_OBSOLETE_MINT_SPECS_MUTATION = """
mutation DeleteObsoleteMintSpecs($live_ids: [String!]!) {
  delete_adapter_transform_spec(
    where: {
      _and: [
        { mint_model_config_id: { _is_null: false } }
        { mint_model_config_id: { _nin: $live_ids } }
      ]
    }
  ) { affected_rows }
}
"""

# Returns all mint_model_config_ids currently stored so sync can track
# create vs update for the SyncResult counters.
GET_MINT_SPEC_IDS_QUERY = """
query GetMintSpecIds {
  adapter_transform_spec(where: { mint_model_config_id: { _is_null: false } }) {
    mint_model_config_id
  }
}
"""

# Lists ModelConfigurations with their full I/O + parameter tree for the MINT sync.
# Paginated; caller increments offset until an empty page is returned.
LIST_MINT_CONFIGURATIONS_QUERY = """
query ListMintConfigurations($limit: Int!, $offset: Int!) {
  modelcatalog_configuration(limit: $limit, offset: $offset) {
    id
    label
    description
    has_software_image
    tapis_app_id
    tapis_app_version
    inputs {
      is_optional
      input {
        id
        label
        has_format
        presentations {
          presentation {
            id
            standard_variable { id label }
            unit { id label }
          }
        }
      }
    }
    outputs {
      output {
        id
        label
        has_format
        presentations {
          presentation {
            id
            standard_variable { id label }
            unit { id label }
          }
        }
      }
    }
    parameters {
      parameter {
        id
        label
        has_data_type
        has_fixed_value
        has_default_value
      }
    }
  }
}
"""

# Returns summary fields for GET /admin/sync-status.
GET_SYNC_STATUS_QUERY = """
query GetSyncStatus {
  all: adapter_transform_spec_aggregate { aggregate { count } }
  synced: adapter_transform_spec_aggregate(
    where: { mint_model_config_id: { _is_null: false } }
  ) { aggregate { count } }
  function_tasks: adapter_transform_spec_aggregate(
    where: {
      _and: [
        { mint_model_config_id: { _is_null: false } }
        { tapis_app_id: { _is_null: true } }
      ]
    }
  ) { aggregate { count } }
  last_sync: adapter_transform_spec(
    where: { mint_synced_at: { _is_null: false } }
    order_by: { mint_synced_at: desc }
    limit: 1
  ) { mint_synced_at }
}
"""
