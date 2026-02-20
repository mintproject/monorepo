# Phase 2: API Integration - Research

**Researched:** 2026-02-20
**Domain:** FastAPI backend migration (SPARQL → Hasura/PostgreSQL), Ensemble Manager GraphQL integration, REST contract testing
**Confidence:** HIGH

## Summary

Phase 2 rewires two consumers of model catalog data away from Apache Fuseki (RDF triplestore) and toward the PostgreSQL/Hasura GraphQL stack built in Phase 1. The FastAPI application (`model-catalog-fastapi`) currently routes all read queries through an `obasparql.QueryManager` that fires SPARQL queries at Fuseki and converts results via JSON-LD contexts into Pydantic model instances. The Ensemble Manager (`mint-ensemble-manager`) currently calls the FastAPI REST endpoints via `@mintproject/modelcatalog_client` (an auto-generated TypeScript SDK) to fetch `ModelConfiguration` and `ModelConfigurationSetup` data during ensemble execution setup.

There are 47 API endpoint files in FastAPI covering ~40 distinct entity types. The contract (JSON response shape) is defined by auto-generated Pydantic models that use camelCase `Field(alias=...)` mappings — the output format uses camelCase property names where every scalar value is wrapped in a list (e.g., `"label": ["PIHM"]`). This array-of-scalars convention is an artifact of how RDF triples were serialized and must be preserved exactly to avoid breaking API consumers.

The Ensemble Manager already uses Apollo Client querying a Hasura GraphQL endpoint for its own persistence layer. It has GraphQL codegen configured to generate TypeScript types from Hasura schema. The model-catalog integration work is isolated to `src/classes/mint/model-catalog-functions.ts`, which makes `rp.get()` HTTP calls to the FastAPI. Redirecting those calls to GraphQL queries against the `modelcatalog_*` tables in Hasura is achievable without touching execution, thread, or problem-statement logic.

**Primary recommendation:** In FastAPI, introduce a new `HasuraQueryManager` class that replaces `obasparql.QueryManager` — it sends HTTP POST requests to the Hasura `/v1/graphql` endpoint and maps results back to the same Pydantic models. Wire it via FastAPI's `dependency_overrides` for clean switchover. In Ensemble Manager, add GraphQL queries for `modelcatalog_model_configuration` and `modelcatalog_model_configuration_setup` using the existing `gql` codegen infrastructure, then update `model-catalog-functions.ts` to call those instead of the REST SDK.

## Standard Stack

### Core (FastAPI migration)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gql | 3.5.x (stable) | Python GraphQL client for Hasura queries | Official Python GraphQL client with sync and async transports; `RequestsHTTPTransport` works in FastAPI sync handlers |
| requests | 2.28.x (already present) | HTTP transport for gql | Already in requirements.txt; `RequestsHTTPTransport` in gql uses requests |
| httpx | 0.23.x+ | Alternative async transport for gql | Better for async FastAPI routes; `AIOHTTPTransport` also works |
| pytest | latest | Test runner | Already in use; 47 test files exist for all entity APIs |
| syrupy | 4.x | Snapshot/golden file testing | Pytest plugin for JSON snapshot comparison to verify contract preservation |

### Core (Ensemble Manager migration)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @apollo/client | ^3.7.1 (already present) | GraphQL client | Already configured in `src/config/graphql.ts`; used for all existing Hasura queries |
| @graphql-codegen/cli | ^5.0.7 (already present) | Type generation from GraphQL schema | Already configured in `codegen.ts`; generates `src/classes/graphql/types.ts` |
| @graphql-codegen/client-preset | ^4.8.2 (already present) | Type-safe document nodes | Already in use for all other GraphQL queries |
| graphql | ^15.10.1 (already present) | GraphQL language parser | Already present |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fastapi-cache2 | 0.1.9 (already present) | Redis caching layer | Keep existing cache decorators; replace the underlying query, not the cache |
| pydantic | 1.10.x (already present) | Response validation | Keep existing Pydantic models unchanged; they define the contract |
| syrupy | 4.x | Golden file test assertions | Use for contract test: capture current SPARQL response as snapshot, verify Hasura response matches |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gql client in FastAPI | Raw `requests.post()` to Hasura | `gql` adds query parsing and type safety; raw requests works fine too since Hasura just accepts JSON POST |
| gql client in FastAPI | psycopg2 direct SQL | Direct SQL bypasses Hasura permission layer; overkill given Hasura is already running |
| Snapshot testing with syrupy | Manual JSON deep-diff | Syrupy integrates with pytest natively; golden files are auto-updated with `--snapshot-update` flag |
| Apollo Client in Ensemble Manager | Fetch API directly | Apollo Client already configured and used for all other Hasura queries in the codebase |

**Installation (FastAPI only — Ensemble Manager needs no new packages):**
```bash
pip install gql[requests] syrupy
```

## Architecture Patterns

### Recommended Project Structure for FastAPI Migration

```
model-catalog-fastapi/
├── src/openapi_server/
│   ├── backends/
│   │   ├── __init__.py
│   │   └── hasura.py          # HasuraBackend class (replaces connector.py's QueryManager)
│   ├── connector.py           # Keep existing; swap query_manager to HasuraBackend
│   ├── apis/                  # NO CHANGES to any *_api.py files
│   └── models/                # NO CHANGES to any model files
└── tests/
    ├── golden/                # Captured JSON responses from current SPARQL backend
    │   ├── models_get.json
    │   ├── modelconfigurationsetups_get.json
    │   └── ...
    └── test_contract_model_api.py   # New contract tests
```

```
mint-ensemble-manager/src/classes/
├── graphql/
│   └── queries/
│       └── modelcatalog/            # New directory for model catalog GraphQL queries
│           ├── get-configuration.graphql
│           └── get-setup.graphql
└── mint/
    └── model-catalog-functions.ts   # Replace rp.get() calls with GraphQL queries
```

### Pattern 1: HasuraBackend as Drop-in Replacement

**What:** Create `HasuraBackend` that implements the same interface FastAPI API handlers expect from `query_manager` — specifically `get_resource()` and `delete_resource()` — but executes GraphQL against Hasura instead of SPARQL against Fuseki.

**When to use:** For all read-path endpoints (GET /models, GET /models/{id}, GET /modelconfigurationsetups, etc.)

**Key insight:** The API handlers call `query_manager.get_resource(rdf_type_uri=..., rdf_type_name=..., kls=Model, ...)`. The `kls` parameter is the Pydantic class. The return value must be an instance of `kls` (or a list of instances). The Pydantic models have `Field(alias="camelCaseName")` — they can be initialized with snake_case keys if `allow_population_by_field_name = True` (which is set in their `Config`), or with camelCase keys using the alias. Use snake_case from the DB and map explicitly.

**Critical contract detail:** Every scalar property in the existing API responses is a list, even when there is only one value. For example, `"label": ["PIHM v2.4"]` not `"label": "PIHM v2.4"`. This is because `obasparql` returns all RDF object values as lists. The Pydantic models define all scalar fields as `Optional[List[str]]`. The `HasuraBackend` MUST wrap single values in lists when constructing the response.

**Example:**
```python
# Source: inferred from obasparql behavior and Pydantic model definitions
# File: src/openapi_server/backends/hasura.py

from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport
import os
from typing import List, Type, TypeVar, Optional

T = TypeVar("T")

HASURA_URL = os.environ.get("HASURA_ENDPOINT", "http://graphql.mint.local/v1/graphql")
HASURA_SECRET = os.environ.get("HASURA_SECRET", "")

def _get_gql_client() -> Client:
    transport = RequestsHTTPTransport(
        url=HASURA_URL,
        headers={"X-Hasura-Admin-Secret": HASURA_SECRET},
        verify=True,
        retries=3,
    )
    return Client(transport=transport, fetch_schema_from_transport=False)


class HasuraBackend:
    """
    Replaces obasparql.QueryManager for GET operations.
    Returns Pydantic model instances matching the existing API contract.
    """

    def get_resource(self, rdf_type_name: str, kls: Type[T], **kwargs) -> T | List[T]:
        """
        Dispatch based on rdf_type_name to the correct Hasura table.
        Returns single instance if 'id' in kwargs, list otherwise.
        """
        table = TYPE_TO_TABLE[rdf_type_name]  # see mapping below
        if "id" in kwargs:
            return self._get_one(table, kwargs["id"], kls)
        else:
            return self._get_all(table, kls, kwargs.get("username"), kwargs.get("label"))

    def _get_one(self, table: str, resource_id: str, kls: Type[T]) -> Optional[T]:
        # Extract the short ID from the URI (after the last slash)
        short_id = resource_id.split("/")[-1] if "/" in resource_id else resource_id
        query = gql(f"""
            query GetOne($id: String!) {{
                {table}(where: {{id: {{_ilike: $id}}}}, limit: 1) {{
                    {TABLE_FIELD_FRAGMENTS[table]}
                }}
            }}
        """)
        client = _get_gql_client()
        result = client.execute(query, variable_values={"id": f"%{short_id}%"})
        rows = result.get(table, [])
        if not rows:
            return None
        return _row_to_pydantic(rows[0], kls, table)

    def _get_all(self, table: str, kls: Type[T], username: str = None, label: str = None) -> List[T]:
        query = gql(f"""
            query GetAll($label: String) {{
                {table}(where: {{label: {{_ilike: $label}}}}) {{
                    {TABLE_FIELD_FRAGMENTS[table]}
                }}
            }}
        """)
        client = _get_gql_client()
        variables = {"label": f"%{label}%" if label else "%"}
        result = client.execute(query, variable_values=variables)
        return [_row_to_pydantic(row, kls, table) for row in result.get(table, [])]
```

**Important note on field fragments:** Each table needs a pre-defined field fragment listing the columns to SELECT. These should be pre-built strings covering all fields that map to the Pydantic model properties. Start with `modelcatalog_model_configuration_setup` (most complex, has nested relationships used by Ensemble Manager) and `modelcatalog_software` (simplest).

### Pattern 2: Pydantic Model Mapping (RDF-to-Relational)

**What:** Convert flat PostgreSQL rows (with FK IDs for nested objects) to the nested Pydantic structures the existing models expect. The existing Pydantic models expect nested objects (e.g., `hasGrid: List[Grid]` where `Grid` is itself a Pydantic model).

**Critical issue:** The existing Pydantic `Model` type expects `hasGrid: Optional[List[Grid]]` — a list of full `Grid` objects, not just IDs. However, the GraphQL query can fetch nested data via Hasura relationships. Use Hasura's nested query syntax to include related objects in a single query.

**Example mapping approach:**
```python
# Source: derived from Pydantic model structure in openapi_server/models/

def _row_to_pydantic(row: dict, kls: Type[T], table: str) -> T:
    """
    Map a Hasura result row to a Pydantic model instance.

    Key rules:
    1. Scalar strings must be wrapped in lists: row["label"] -> ["label value"]
    2. Nested objects come as lists from Hasura relationships
    3. The 'id' field is a full URI, not the short local name
    4. None values must remain None (not empty lists)
    """
    mapped = {}

    # scalar fields - wrap in list
    if row.get("label"):
        mapped["label"] = [row["label"]]
    if row.get("description"):
        mapped["description"] = [row["description"]]
    if row.get("id"):
        mapped["id"] = row["id"]   # id is NOT wrapped in list in Pydantic models

    # nested relationships from Hasura - these arrive as lists of objects
    # e.g., row["inputs"] = [{"input_id": {...dataset_specification...}}]

    return kls(**mapped)
```

### Pattern 3: Ensemble Manager GraphQL Query for Model Catalog

**What:** Add new `.graphql` query files that query the `modelcatalog_*` tables in Hasura, then update `model-catalog-functions.ts` to call those GraphQL queries instead of `rp.get()` HTTP calls.

**When to use:** For `fetchModelFromCatalog`, `fetchModelConfigurationSetup`, `fetchModelConfiguration`, and related functions in `model-catalog-functions.ts`.

**Critical constraint:** The Ensemble Manager uses `ModelConfigurationSetup` and `ModelConfiguration` from `@mintproject/modelcatalog_client` TypeScript types. The GraphQL result must be mapped to these types. Introduce a mapping function `setupFromGraphQL(row) -> ModelConfigurationSetup`.

**Example:**
```typescript
// Source: pattern from existing src/classes/graphql/queries/model/get.graphql

// File: src/classes/graphql/queries/modelcatalog/get-setup.graphql
query GetModelConfigurationSetup($id: String!) {
    modelcatalog_model_configuration_setup(
        where: { id: { _eq: $id } }
        limit: 1
    ) {
        id
        label
        description
        has_component_location
        has_software_image
        model_configuration {
            id
            label
            software_version {
                id
                software {
                    id
                    label
                }
            }
        }
        inputs {
            input {
                id
                label
                has_format
                has_dimensionality
                position
            }
        }
        outputs {
            output {
                id
                label
                has_format
                has_dimensionality
                position
            }
        }
        parameters {
            parameter {
                id
                label
                description
                has_data_type
                has_default_value
                has_minimum_accepted_value
                has_maximum_accepted_value
                has_fixed_value
                position
            }
        }
    }
}
```

```typescript
// File: src/classes/mint/model-catalog-functions.ts (updated)
import { GraphQL } from "@/config/graphql";
import getSetupGQL from "@/classes/graphql/queries/modelcatalog/get-setup.graphql";

export const fetchModelConfigurationSetup = async (
    url: string
): Promise<CustomModelConfigurationSetup> => {
    const shortId = url.split("/").pop();
    const APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    const result = await APOLLO_CLIENT.query({
        query: getSetupGQL,
        variables: { id: shortId },
        fetchPolicy: "no-cache"
    });
    const row = result.data.modelcatalog_model_configuration_setup[0];
    if (!row) throw new Error(`Model configuration setup not found: ${shortId}`);
    return setupFromGraphQL(row);
};
```

### Anti-Patterns to Avoid

- **Modifying API handler files (`*_api.py`):** All 47 API handlers call `query_manager.get_resource(...)`. The correct approach is to swap the `query_manager` object, not edit each handler file.
- **Changing Pydantic model field definitions:** The model contract (camelCase aliases, List wrapping) is what API consumers depend on. Do not unwrap lists or change aliases.
- **Hardcoding GraphQL queries as strings inline:** Use `gql()` function to parse query strings — it validates syntax. Better: pre-define fragments for each entity type.
- **Making the Ensemble Manager query through the FastAPI REST API:** The goal is to bypass the REST layer entirely and query Hasura directly via GraphQL. Do not add another HTTP hop.
- **Removing `obasparql` dependency immediately:** Keep the SPARQL connector working during migration so tests can compare old vs new responses. Remove only after contract tests pass.
- **Using the `username` parameter for data isolation in PostgreSQL:** The existing SPARQL backend isolated data by named graph per user. In Hasura, all data is shared (ETL loaded the public graph). The `username` query parameter exists on all endpoints but the Hasura backend should ignore it for reads (all data is public per Phase 1 decisions).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GraphQL query execution in Python | Custom HTTP POST with json payload | `gql` library | Query validation, variable handling, error parsing |
| Snapshot comparison for contract testing | Custom JSON diff script | `syrupy` pytest plugin | Auto-generates golden files, handles pytest lifecycle, shows clear diffs |
| TypeScript types for new GraphQL queries | Hand-written interfaces | `@graphql-codegen/cli` (already configured) | Run `npm run codegen` to regenerate `types.ts` after adding new queries |
| FastAPI dependency injection for backend swap | Complex module-level patching | `app.dependency_overrides` | FastAPI's built-in mechanism for replacing dependencies per-route in tests |

**Key insight:** The FastAPI `connector.py` already uses a module-level `query_manager` singleton. The cleanest swap is to make `query_manager` into a FastAPI dependency that can be overridden for tests. If refactoring to dependency injection is too much scope, the fallback is a simple environment variable switch: `if HASURA_ENDPOINT: use HasuraBackend else: use original QueryManager`.

## Common Pitfalls

### Pitfall 1: Array-of-scalars Convention

**What goes wrong:** The new Hasura backend returns `"label": "PIHM v2.4"` (a plain string) but the existing contract expects `"label": ["PIHM v2.4"]` (a list with one element). API consumers receive a string where they expect a list, causing `TypeError` on `.join()` or list indexing.

**Why it happens:** The RDF model stores every predicate value as a potentially multi-valued set. `obasparql` always returns scalar values as Python lists. Pydantic models define all scalar fields as `Optional[List[str]]`. The Hasura result returns plain scalars from PostgreSQL columns.

**How to avoid:** In the `_row_to_pydantic()` mapper, always wrap scalar string values in a list: `mapped["label"] = [row["label"]] if row.get("label") else None`. The `id` field is the exception — it is `Optional[str]`, not `Optional[List[str]]`, in the Pydantic models.

**Warning signs:** `test_models_get` response has `label` as a string instead of `["string"]`.

### Pitfall 2: URI vs Short ID

**What goes wrong:** The FastAPI endpoint receives `id` as a short name like `PIHM-V2.4_cfg1` (stripped from URL path). The `obasparql` backend reconstructs the full URI: `https://w3id.org/okn/i/mint/PIHM-V2.4_cfg1`. The PostgreSQL IDs stored are full URIs. A query `WHERE id = 'PIHM-V2.4_cfg1'` finds nothing.

**Why it happens:** The original `build_instance_uri()` function in `utils/request.py` prepends the URI prefix. The ETL loaded full URI IDs into PostgreSQL. The API endpoint receives only the trailing segment.

**How to avoid:** In `HasuraBackend._get_one()`, reconstruct the full URI before querying: `full_uri = f"https://w3id.org/okn/i/mint/{short_id}"`, or use a `_ilike` query with `%{short_id}` suffix match. The ENDPOINT_RESOURCE_PREFIX env var (`PREFIX`) holds the base URI.

**Warning signs:** GET `/models/{id}` returns 404 for valid IDs.

### Pitfall 3: Nested Object vs Stub Object

**What goes wrong:** The existing SPARQL backend for `GET /models` returns nested objects — e.g., `hasGrid: [{"id": "...", "label": "...", "type": "..."}]` — because the SPARQL query constructs a full JSON-LD sub-graph. The Hasura `_get_all` query may only return the junction table `grid_id` unless the GraphQL query explicitly joins the nested table.

**Why it happens:** Hasura only returns what you query. The SPARQL query was constructed to return full sub-graphs. The PostgreSQL schema uses junction tables, so nested data requires explicit `inputs { input { id label } }` in the GraphQL query.

**How to avoid:** For every nested relationship (inputs, outputs, parameters, regions, grids), include the full subfield list in the Hasura GraphQL query. Test `GET /modelconfigurationsetups/{id}` specifically because it is the most field-rich type.

**Warning signs:** Nested objects appear as `null` or `[]` in the API response where they should have data.

### Pitfall 4: Hasura Permission Layer

**What goes wrong:** Hasura queries with `X-Hasura-Admin-Secret` header always succeed. But if the Hasura backend later uses JWT tokens (user role), some `modelcatalog_*` tables might not have `user` role select permissions, causing empty results or permission errors.

**Why it happens:** Phase 1 set up `anonymous` and `user` role select permissions. The FastAPI backend should use the admin secret (not user tokens) for service-to-service calls.

**How to avoid:** Always use `X-Hasura-Admin-Secret` in the `HasuraBackend` HTTP calls. This is appropriate for server-to-server communication where FastAPI is a trusted backend.

**Warning signs:** Queries return `{}` or `null` in production but work in testing.

### Pitfall 5: GraphQL Codegen Scope in Ensemble Manager

**What goes wrong:** After adding new `.graphql` query files for `modelcatalog_*` queries, running `npm run codegen` fails because the codegen config points to `http://graphql.mint.local/v1/graphql` which requires the Hasura service to be running locally.

**Why it happens:** `codegen.ts` fetches the schema from the live Hasura endpoint. The `modelcatalog_*` tables only exist in the running database.

**How to avoid:** Run `npm run codegen` with Hasura running in Docker. Commit the generated `types.ts` alongside the new query files. This is the existing pattern — `types.ts` is already a committed generated file.

**Warning signs:** `npm run codegen` exits with connection refused or schema fetch error.

### Pitfall 6: Ensemble Manager Model ID Format

**What goes wrong:** `model-catalog-functions.ts` converts between W3ID URIs (`https://w3id.org/okn/i/mint/PIHM_cfg1`) and REST API URLs (`http://api.models.mint.local/v1.8.0/modelconfigurations/PIHM_cfg1`). The GraphQL query needs neither format — it needs the plain `id` stored in PostgreSQL which is the full W3ID URI.

**Why it happens:** The existing code was built around REST URLs with query parameters. GraphQL uses the stored primary key directly.

**How to avoid:** When the input is a REST API URL, extract the trailing segment (e.g., `PIHM_cfg1`) and query `WHERE id LIKE '%PIHM_cfg1'`. When the input is a W3ID URI, use it directly as `WHERE id = $w3id_uri`. Add a helper function `resolveToW3Id(urlOrW3Id: string): string`.

## Code Examples

Verified patterns from official sources and project codebase:

### GQL Client Sync Pattern (for FastAPI sync handlers)
```python
# Source: https://gql.readthedocs.io/en/stable/transports/requests.html
from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport

transport = RequestsHTTPTransport(
    url="http://graphql.mint.local/v1/graphql",
    headers={"X-Hasura-Admin-Secret": "CHANGEME"},
    verify=True,
    retries=3,
)

client = Client(transport=transport, fetch_schema_from_transport=False)

query = gql("""
    query GetSoftware($id: String!) {
        modelcatalog_software(where: {id: {_eq: $id}}) {
            id
            label
            description
            keywords
        }
    }
""")

result = client.execute(query, variable_values={"id": "https://w3id.org/okn/i/mint/PIHM"})
rows = result["modelcatalog_software"]
```

### Hasura Nested Query Pattern
```graphql
# Source: verified against Hasura metadata tables.yaml relationships
# Queries the setup with its inputs, outputs, parameters, and author
query GetModelConfigurationSetup($id: String!) {
    modelcatalog_model_configuration_setup(
        where: { id: { _eq: $id } }
        limit: 1
    ) {
        id
        label
        description
        has_component_location
        has_software_image
        author { id name }
        inputs {
            input {
                id
                label
                has_format
                has_dimensionality
                position
            }
        }
        outputs {
            output {
                id
                label
                has_format
                has_dimensionality
            }
        }
        parameters {
            parameter {
                id
                label
                description
                has_data_type
                has_default_value
                has_minimum_accepted_value
                has_maximum_accepted_value
                has_fixed_value
                position
            }
        }
        model_configuration {
            id
            label
            software_version {
                id
                label
                software {
                    id
                    label
                }
            }
        }
    }
}
```

### Syrupy Snapshot Contract Test Pattern
```python
# Source: https://github.com/syrupy-project/syrupy
# File: tests/test_contract_model_configuration_api.py
import pytest
from fastapi.testclient import TestClient
from openapi_server.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_modelconfigurationsetups_get_contract(client, snapshot):
    """Golden file comparison: Hasura backend must return same structure as SPARQL backend."""
    response = client.get("/modelconfigurationsetups", params={"page": 1, "per_page": 5})
    assert response.status_code == 200
    data = response.json()
    # Verify structural contract (not exact values which may differ by data loaded)
    assert isinstance(data, list)
    if data:
        item = data[0]
        assert "id" in item
        # label must be a list, not a string
        if "label" in item and item["label"] is not None:
            assert isinstance(item["label"], list), f"label must be List[str], got {type(item['label'])}"
    # Snapshot for full structure comparison
    assert data == snapshot
```

### FastAPI Dependency Override Pattern for Backend Swap
```python
# Source: https://fastapi.tiangolo.com/advanced/testing-dependencies/
# connector.py - make query_manager a dependency

from functools import lru_cache
from openapi_server.backends.hasura import HasuraBackend

@lru_cache
def get_query_manager():
    endpoint = os.environ.get("HASURA_ENDPOINT")
    if endpoint:
        return HasuraBackend(endpoint=endpoint, secret=os.environ.get("HASURA_SECRET", ""))
    else:
        # fallback to original obasparql for gradual migration
        from obasparql import QueryManager
        return QueryManager(...)

# In each API handler, use Depends(get_query_manager) instead of the global connector
```

### Ensemble Manager - fetchModelConfigurationSetup via GraphQL
```typescript
// Source: pattern from existing src/classes/graphql/graphql_functions.ts
// File: src/classes/mint/model-catalog-functions.ts

import { GraphQL } from "@/config/graphql";
import { KeycloakAdapter } from "@/config/keycloak-adapter";
import getSetupGQL from "@/classes/graphql/queries/modelcatalog/get-setup.graphql";

const W3_ID_PREFIX = "https://w3id.org/okn/i/mint/";

function resolveToW3Id(urlOrW3Id: string): string {
    if (urlOrW3Id.startsWith("https://w3id.org/")) return urlOrW3Id;
    // REST API URL: extract trailing segment
    const segment = urlOrW3Id.split("?")[0].split("/").pop();
    return W3_ID_PREFIX + segment;
}

export const fetchModelConfigurationSetup = async (
    url: string
): Promise<CustomModelConfigurationSetup> => {
    const w3Id = resolveToW3Id(url);
    const APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    const result = await APOLLO_CLIENT.query({
        query: getSetupGQL,
        variables: { id: w3Id },
        fetchPolicy: "no-cache"
    });
    const rows = result.data?.modelcatalog_model_configuration_setup ?? [];
    if (rows.length === 0) {
        throw new Error(`ModelConfigurationSetup not found: ${w3Id}`);
    }
    return setupFromGraphQL(rows[0]);
};

function setupFromGraphQL(row: any): CustomModelConfigurationSetup {
    return {
        id: row.id,
        label: row.label ? [row.label] : [],
        description: row.description ? [row.description] : [],
        hasComponentLocation: row.has_component_location ? [row.has_component_location] : [],
        hasSoftwareImage: row.has_software_image ? [{ id: row.has_software_image }] : [],
        hasInput: (row.inputs ?? []).map((ji) => ({
            id: ji.input.id,
            label: ji.input.label ? [ji.input.label] : [],
            hasFormat: ji.input.has_format ? [ji.input.has_format] : [],
            hasDimensionality: ji.input.has_dimensionality != null ? [ji.input.has_dimensionality] : [],
            position: ji.input.position != null ? [ji.input.position] : []
        })),
        hasOutput: (row.outputs ?? []).map((jo) => ({
            id: jo.output.id,
            label: jo.output.label ? [jo.output.label] : [],
        })),
        hasParameter: (row.parameters ?? []).map((jp) => ({
            id: jp.parameter.id,
            label: jp.parameter.label ? [jp.parameter.label] : [],
            description: jp.parameter.description ? [jp.parameter.description] : [],
            hasDataType: jp.parameter.has_data_type ? [jp.parameter.has_data_type] : [],
            hasDefaultValue: jp.parameter.has_default_value ? [jp.parameter.has_default_value] : [],
            hasFixedValue: jp.parameter.has_fixed_value ? [jp.parameter.has_fixed_value] : [],
            hasMinimumAcceptedValue: jp.parameter.has_minimum_accepted_value ? [jp.parameter.has_minimum_accepted_value] : [],
            hasMaximumAcceptedValue: jp.parameter.has_maximum_accepted_value ? [jp.parameter.has_maximum_accepted_value] : [],
            position: jp.parameter.position != null ? [jp.parameter.position] : []
        }))
    } as CustomModelConfigurationSetup;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SPARQL query via obasparql | GraphQL query via Hasura | Phase 2 (now) | Same Pydantic response models, different data source |
| JSON-LD context-based field mapping | Direct column-to-field mapping | Phase 2 (now) | Simpler mapping code; must preserve List wrapping manually |
| Named graph isolation per user (`?username=` param) | Shared public tables | Phase 1 (done) | `username` param becomes a no-op for reads |
| REST API HTTP calls in Ensemble Manager | Direct GraphQL to Hasura | Phase 2 (now) | Removes one network hop; Ensemble Manager already has Apollo Client |

**Deprecated/outdated:**
- `obasparql.QueryManager`: Still used in Phase 2 as fallback; deprecated once contract tests pass. Remove in Phase 3 cleanup.
- `@mintproject/modelcatalog_client` (REST SDK) in Ensemble Manager: Used in `model-catalog-functions.ts` for `fetchModelConfigurationSetup` etc. Replaced by direct GraphQL in this phase. The package itself may still be used elsewhere — do not remove the package, only the specific function calls.
- SPARQL `.rq` query files in `model-catalog-fastapi/queries/`: Still needed while SPARQL backend exists. Mark as deprecated in Phase 2, remove in cleanup.
- `request-promise-native` (`rp`) in Ensemble Manager `model-catalog-functions.ts`: Replace with GraphQL Apollo Client calls for model catalog functions specifically.

## Open Questions

1. **Which FastAPI entity types have data in PostgreSQL?**
   - What we know: Phase 1 loaded Software, SoftwareVersion, ModelConfiguration, ModelConfigurationSetup, DatasetSpecification, Parameter, Person, ModelCategory, Region, Process, TimeInterval, CausalDiagram, Image, VariablePresentation, Intervention, Grid (16 types). The remaining ~25 entity types tracked by FastAPI (e.g., `Emulator`, `HybridModel`, `CoupledModel`, `Equation`) likely have no data in PostgreSQL.
   - What's unclear: Should endpoints for entity types with no PostgreSQL data return 404 or empty list?
   - Recommendation: Return empty list (matching what a real SPARQL query against an empty named graph would return). Log a warning. Document which entity types are populated vs. empty.

2. **Scope of `username` parameter in Hasura backend**
   - What we know: Every FastAPI GET endpoint accepts `?username=` to query a user-specific named graph in Fuseki. In PostgreSQL, all data is in a single table (no per-user partition).
   - What's unclear: Are there any callers that pass a `username` and expect to get user-specific data (i.e., data they created via POST/PUT)?
   - Recommendation: For Phase 2 (read-only migration), ignore `username` in the Hasura backend. Write operations (POST, PUT, DELETE) are out of scope and still need to be wired later.

3. **Custom query endpoints and their Hasura equivalents**
   - What we know: There are custom SPARQL queries like `custom_model_index.rq`, `custom_model_standard_variable.rq`, `custom_modelconfigurationsetups_variable.rq` that perform filtered searches (e.g., by standard variable label). These are called by the Ensemble Manager's `fetchModelFromCatalog`.
   - What's unclear: Do these custom endpoints need to be fully reimplemented for Phase 2, or only the ones called by Ensemble Manager?
   - Recommendation: For Plan 02-01, implement the standard CRUD endpoints first. For Plan 02-02 (Ensemble Manager), implement only `custom/modelconfigurationsetups/variable` (used by `fetchModelFromCatalog`) and `custom/modelconfigurationsetups/{id}` (used by `fetchModelConfigurationSetup`).

4. **Relationship names in Hasura metadata for queries**
   - What we know: `tables.yaml` defines relationship names (e.g., `inputs`, `outputs`, `parameters`, `author`, `versions`, `configurations`, `setups`). These were set in Phase 1.
   - What's unclear: The exact GraphQL field names for all junction relationships need to be confirmed against the running Hasura instance (e.g., is it `inputs { input { ... } }` or `inputs { dataset_specification { ... } }`?).
   - Recommendation: The GraphQL examples in this document are based on `tables.yaml` relationship definitions. Verify by running the Hasura console or introspecting the schema before writing queries. The `inputs` array relationship on `modelcatalog_model_configuration` uses `foreign_key_constraint_on.column: configuration_id` on table `modelcatalog_configuration_input`, which has an object relationship to `modelcatalog_dataset_specification` named based on the FK column name.

## Sources

### Primary (HIGH confidence)
- Codebase: `model-catalog-fastapi/src/openapi_server/connector.py` — obasparql usage pattern
- Codebase: `model-catalog-fastapi/src/openapi_server/models/model.py` — Pydantic model contract (camelCase aliases, List fields)
- Codebase: `model-catalog-fastapi/src/openapi_server/utils/request.py` — URI construction, get_resource flow
- Codebase: `mint-ensemble-manager/src/classes/mint/model-catalog-functions.ts` — REST API call sites to migrate
- Codebase: `mint-ensemble-manager/src/config/graphql.ts` — existing Apollo Client setup
- Codebase: `mint-ensemble-manager/src/classes/graphql/graphql_functions.ts` — existing GraphQL query pattern
- Codebase: `mint-ensemble-manager/codegen.ts` — GraphQL codegen configuration
- Codebase: `graphql_engine/metadata/tables.yaml` — Hasura relationship names for all modelcatalog_* tables
- Codebase: `mint-ensemble-manager/src/classes/graphql/queries/fragments/model-info.graphql` — Existing model GraphQL fragment pattern
- Codebase: `model-catalog-fastapi/requirements.txt` — existing Python dependencies (fastapi 0.85.1, pydantic 1.10.2)
- FastAPI official docs — `app.dependency_overrides` for testing

### Secondary (MEDIUM confidence)
- [gql stable docs](https://gql.readthedocs.io/en/stable/) — Python GraphQL client, `RequestsHTTPTransport` sync pattern, latest stable 3.5.x
- [syrupy GitHub](https://github.com/syrupy-project/syrupy) — Snapshot testing plugin for pytest, JSON extension support
- [FastAPI testing docs](https://fastapi.tiangolo.com/advanced/testing-dependencies/) — dependency_overrides for backend swap

### Tertiary (LOW confidence)
- WebSearch: gql 4.x is in beta (4.3.0b0 as of early 2026); stable is 3.5.x. Use 3.5.x for this migration.
- WebSearch: obasparql return format is always List[dict] from JSON-LD context expansion

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing codebase is the primary source; no new external libraries needed for Ensemble Manager, only `gql` and `syrupy` are additions for FastAPI
- Architecture patterns: HIGH — based on direct code analysis of both projects; URI/List wrapping pitfalls verified in Pydantic model definitions
- Pitfalls: HIGH — URI vs short ID issue directly observed in `utils/request.py:build_instance_uri()`; array-of-scalars observed in all Pydantic model field definitions; Hasura permission verified in `tables.yaml`
- Open questions: MEDIUM — entity type coverage and custom query scope require runtime verification against the loaded database

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable stack; Hasura and gql APIs change slowly)
