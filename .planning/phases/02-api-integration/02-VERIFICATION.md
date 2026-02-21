---
phase: 02-api-integration
verified: 2026-02-21T09:30:00Z
status: gaps_found
score: 4/5 must-haves verified
re_verification: null
gaps:
  - truth: "New API at /v2.0.0/ returns data from PostgreSQL/Hasura for all 46 resource types and 13 custom endpoints"
    status: partial
    reason: "23 of 46 resource types have hasuraTable: null and return HTTP 501 (not implemented). The service correctly routes all 46 types but only 23 have working read/write paths. The 13 custom endpoints are fully implemented."
    artifacts:
      - path: "model-catalog-api/src/mappers/resource-registry.ts"
        issue: "23 resource types set hasuraTable: null — they return 501 for all CRUD operations. Affected types: catalogidentifiers, constraints, datatransformations, datatransformationsetups, equations, fundinginformations, geocoordinatess, geoshapes, numericalindexs, organizations, pointbasedgrids, samplecollections, sampleexecutions, sampleresources, softwareconfigurations, softwareimages, sourcecodes, spatialresolutions, spatiallydistributedgrids, standardvariables, units, variables, visualizations"
      - path: "model-catalog-api/src/custom-handlers.ts"
        issue: "custom_datasetspecifications_id_datatransformations_get returns [] stub with TODO comment (datatransformations table not in schema)"
    missing:
      - "Hasura views or tables for the 23 resource types with hasuraTable: null"
      - "Actual implementation for the datatransformations custom endpoint (currently returns empty array)"
  - truth: "Full CRUD (GET, POST, PUT, DELETE) works through Hasura GraphQL mutations"
    status: partial
    reason: "CRUD is fully wired for 23 resource types that have Hasura tables. However, username filtering uses 'user_id' column in WHERE clauses, but no modelcatalog table has a user_id column (schema uses author_id). This means any request with ?username= parameter will produce a Hasura runtime error."
    artifacts:
      - path: "model-catalog-api/src/service.ts"
        issue: "Line 64: whereConditions.push('user_id: { _eq: \\$username }') — user_id column does not exist in any modelcatalog_* table. The schema uses author_id (FK to person). This will cause a Hasura GraphQL error at runtime for all list queries with username filter."
    missing:
      - "Either remove username filtering (no user_id column exists) or rewrite as author_id lookup via person table join"
human_verification: null
---

# Phase 02: API Integration Verification Report

**Phase Goal:** New Node.js/TypeScript REST API serves identical responses at /v2.0.0/ from Hasura/PostgreSQL, while old FastAPI stays at /v1.8.0/ for parallel validation
**Verified:** 2026-02-21T09:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | New API at /v2.0.0/ returns data from PostgreSQL/Hasura for all 46 resource types and 13 custom endpoints | PARTIAL | 23/46 types functional (hasuraTable non-null); 23/46 return 501; 12/13 custom endpoints functional; 1 custom endpoint (datatransformations) returns [] stub |
| 2 | REST endpoint responses match the existing v1.8.0 API contract (same JSON structure, array wrapping, URI IDs) | VERIFIED | response.ts implements all v1.8.0 rules: scalar array-wrapping, type synthesis, null omission, camelCase keys, junction traversal. 32 tests pass confirming contract fidelity |
| 3 | All existing REST endpoints remain functional at /v1.8.0/ (old API untouched) | VERIFIED | model-catalog.yaml, ingress-model-catalog.yaml, and values.yaml model_catalog_api block unchanged. model_catalog_api: enabled=true, api_version=v1.8.0, image=mintproject/model-catalog-fastapi |
| 4 | Full CRUD (GET, POST, PUT, DELETE) works through Hasura GraphQL mutations | PARTIAL | CRUD wiring is complete for 23 entity-table resources; insert/update/delete Hasura permissions confirmed in tables.yaml (commit b579032). However, ?username= filtering uses non-existent user_id column — runtime error on filtered list queries |
| 5 | Helm chart deploys the new API alongside existing services | VERIFIED | model-catalog-api-v2.yaml + ingress-model-catalog-api-v2.yaml render Service + Deployment + Ingress. helm template produces 11 resources referencing model-catalog-api-v2. /v2.0.0 ingress path correctly routes separately from /v1.8.0/ |

**Score:** 3 fully verified / 2 partially verified / 5 truths total

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `model-catalog-api/src/app.ts` | Fastify app with openapi-glue and /health endpoint | VERIFIED | Full implementation: spec pre-processing, AJV config, cors, swagger, openapi-glue with prefix 'v2.0.0', /health endpoint with Hasura probe |
| `model-catalog-api/src/service.ts` | CatalogService Proxy with 5 generic CRUD handlers | VERIFIED | 420 lines; Proxy with has()+get() traps; 5 CRUD methods; customHandlers dispatch; isHandledOperationId() |
| `model-catalog-api/src/hasura/client.ts` | Apollo Client for Hasura (read + write) | VERIFIED | readClient (admin secret, no-cache) + getWriteClient(token) factory; HASURA_GRAPHQL_URL from env |
| `model-catalog-api/src/mappers/resource-registry.ts` | 46-entry resource registry | VERIFIED | Exactly 46 entries confirmed; 23 with hasuraTable, 23 with null; all entries have typeUri, typeArray, relationships |
| `model-catalog-api/src/mappers/response.ts` | v1.8.0 response transformer | VERIFIED | Full implementation with all 7 rules; junction traversal via junctionRelName; depth guard at 2 |
| `model-catalog-api/src/mappers/request.ts` | Hasura input transformer | VERIFIED | camelToSnake, unwrapValue, relationship-field skipping, type-field omission |
| `model-catalog-api/src/hasura/field-maps.ts` | GraphQL field selections for 16 entity tables | VERIFIED | All 16 entity tables covered with full scalar + relationship field lists |
| `model-catalog-api/src/custom-handlers.ts` | 13 custom endpoint handlers | VERIFIED | All 13 handlers exported; 12 functional (GraphQL queries with JS post-filtering); 1 stub (datatransformations returns []) |
| `model-catalog-api/src/security.ts` | BearerAuth security handler | VERIFIED | Checks Authorization header presence, stores token on req, forwards to Hasura |
| `model-catalog-api/Dockerfile` | Multi-stage node:20-alpine build | VERIFIED | builder stage: npm ci + tsc; production stage: production deps only + dist/ + openapi.yaml; PORT=3000, CMD node dist/index.js |
| `model-catalog-api/.github/workflows/ci.yml` | CI with test gate + Docker Hub push | VERIFIED | test job (tsc + vitest) gates build-and-push; pushes mintproject/model-catalog-api:{sha}+:latest on main |
| `helm-charts/charts/mint/templates/model-catalog-api-v2.yaml` | Service + Deployment with /health probes | VERIFIED | Conditional on enabled; Service port 80->3000; Deployment with liveness/readiness probes at /health; HASURA_GRAPHQL_URL env var |
| `helm-charts/charts/mint/templates/ingress-model-catalog-api-v2.yaml` | Ingress for /v2.0.0 path routing | VERIFIED | Routes /v2.0.0 path prefix to model-catalog-api-v2 service; separate from v1.8.0 ingress |
| `helm-charts/charts/mint/values.yaml` | model_catalog_api_v2 component block | VERIFIED | Present: enabled=false (safe default), image=mintproject/model-catalog-api, hasura_graphql_url env key, ingress path=/v2.0.0 |
| `graphql_engine/metadata/tables.yaml` | Mutation permissions for modelcatalog tables | VERIFIED | Commit b579032 in graphql_engine submodule; insert_permissions (74), update_permissions (44), delete_permissions (60) entries; user role on all modelcatalog entity + junction tables |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app.ts` | `src/service.ts` | `serviceHandlers: CatalogService` | WIRED | openapiGlue registration imports and passes CatalogService proxy |
| `src/app.ts` | `src/security.ts` | `securityHandlers: SecurityHandler` | WIRED | Imported and passed to openapiGlue registration |
| `src/app.ts` | `src/hasura/client.ts` | `readClient` health check | WIRED | readClient imported and used in /health endpoint |
| `src/service.ts` | `src/hasura/client.ts` | `readClient`, `getWriteClient`, `gql` | WIRED | All three imported and used in CRUD handlers |
| `src/service.ts` | `src/mappers/resource-registry.ts` | `getResourceConfig` | WIRED | Imported and called in all 5 CRUD methods |
| `src/service.ts` | `src/mappers/response.ts` | `transformRow`, `transformList` | WIRED | Both imported and called with query results |
| `src/service.ts` | `src/mappers/request.ts` | `toHasuraInput` | WIRED | Imported and called in create/update handlers |
| `src/service.ts` | `src/hasura/field-maps.ts` | `getFieldSelection` | WIRED | Imported and called for all list/getById/update queries |
| `src/service.ts` | `src/custom-handlers.ts` | `customHandlers` dispatch | WIRED | customHandlers imported; handleCustom dispatches by operationId key |
| `helm-charts/.../model-catalog-api-v2.yaml` | `helm-charts/.../values.yaml` | Helm template values | WIRED | `.Values.components.model_catalog_api_v2` referenced throughout; helm template renders 11 resources |
| `helm-charts/.../model-catalog-api-v2.yaml` | `model-catalog-api/Dockerfile` | Docker image reference | WIRED | Template uses `mintproject/model-catalog-api` matching Dockerfile CI push target |

---

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| New API at /v2.0.0/ returns data for all 46 resource types | PARTIAL | 23 types return 501; no Hasura tables for them |
| REST responses match v1.8.0 JSON contract | SATISFIED | 32 tests confirm array-wrapping, type synthesis, null omission, camelCase, junction traversal |
| All v1.8.0 endpoints remain functional | SATISFIED | model-catalog.yaml + values unchanged; v1.8.0 FastAPI untouched |
| Full CRUD through Hasura GraphQL | PARTIAL | CRUD wired for 23 types; username filtering broken (user_id column missing) |
| Helm chart deploys alongside existing services | SATISFIED | Templates render correctly; /v2.0.0 path routing verified with helm template |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/custom-handlers.ts` | 464 | `// TODO: datatransformations table does not exist` + `return []` stub | Warning | /custom/datasetspecifications/{id}/datatransformations always returns empty array; incorrect response for any real dataset spec |
| `src/service.ts` | 64 | `whereConditions.push('user_id: { _eq: $username }')` — user_id column does not exist | Blocker | Any ?username= query parameter on list endpoints will cause a Hasura GraphQL validation error at runtime (unknown column user_id) |
| `src/mappers/resource-registry.ts` | 643-848 | 23 entries with `hasuraTable: null` | Warning | 23/46 resource types return 501 Not Implemented for all operations |

---

## Gaps Summary

**Gap 1: 23 resource types unimplemented (hasuraTable: null)**

23 of 46 API resource types return HTTP 501 for all CRUD operations because no Hasura table exists for them. The affected types include: `catalogidentifiers`, `constraints`, `datatransformations`, `datatransformationsetups`, `equations`, `fundinginformations`, `geocoordinatess`, `geoshapes`, `numericalindexs`, `organizations`, `pointbasedgrids`, `samplecollections`, `sampleexecutions`, `sampleresources`, `softwareconfigurations`, `softwareimages`, `sourcecodes`, `spatialresolutions`, `spatiallydistributedgrids`, `standardvariables`, `units`, `variables`, `visualizations`.

The phase goal states "all 46 resource types" must be served. 23 are not yet served. This may be acceptable if the phase scope was intentionally scoped to the 23 entity tables present in the migrated schema, but it does not match the stated success criterion of "all 46 resource types."

Additionally, the `custom_datasetspecifications_id_datatransformations_get` handler returns `[]` with a TODO comment (datatransformations table absent from schema).

**Gap 2: username filtering broken (user_id column missing)**

The `list()` method in `service.ts` adds `user_id: { _eq: $username }` to the WHERE clause when `?username=` is provided. No `modelcatalog_*` table has a `user_id` column — the schema uses `author_id` (FK to `modelcatalog_person`). This is a runtime error: Hasura will reject the query with a field-not-found error. The SUMMARY acknowledged this issue was discovered during plan 05 but it was not fixed.

This affects all 23 implemented resource types when a username filter is requested — a common use pattern for the model catalog API (the v1.8.0 API uses username filtering heavily).

---

_Verified: 2026-02-21T09:30:00Z_
_Verifier: Claude (gsd-verifier)_
