---
phase: 02-api-integration
verified: 2026-02-21T17:46:57Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Custom endpoint handlers (configurationsetups/{id} and modelconfigurationsetups/{id}) now apply fullId prefix for plain IDs — all five handler locations patched in commit 34627e8 (plan 02-13)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "GET /v2.0.0/custom/modelconfigurationsetups/hand_v6 returns 200 with deeply nested setup"
    expected: "200 response with SETUP_FIELDS data including inputs/outputs/parameters as junction-traversal shapes"
    why_human: "Requires live Hasura + populated DB to confirm end-to-end behavior; automated checks confirm correct fullId logic and field selections"
  - test: "GET /v2.0.0/softwares returns hasVersion (not versions) in relationship fields"
    expected: "Each software entry has hasVersion array containing nested version objects"
    why_human: "Requires live API against Hasura to confirm the renamed registry key propagates correctly through response transformer"
  - test: "GET /v2.0.0/softwares/1bade4cb-d924-4253-bfa9-4c02b461396a returns 200"
    expected: "Entity returned with idPrefix prepended to find the full URI"
    why_human: "Requires live Hasura; unit test confirms fullId logic exists but not end-to-end behavior with real DB"
---

# Phase 02: API Integration Verification Report

**Phase Goal:** New Node.js/TypeScript REST API serves identical responses at /v2.0.0/ from Hasura/PostgreSQL, while old FastAPI stays at /v1.8.0/ for parallel validation
**Verified:** 2026-02-21T17:46:57Z
**Status:** passed
**Re-verification:** Yes — after gap closure in plan 02-13. Previous verification (2026-02-21T17:16:52Z) found Truth 4 partial due to missing fullId prefix in custom handlers.

## Verification Context

Plan 02-13 (commits `34627e8` and `b78f752`) applied the fullId prefix pattern to all five custom handler locations that were previously passing raw decoded IDs to Hasura. This closes the last remaining gap from the previous verification.

**Commits added by plan 02-13:**
- `34627e8` — feat(02-13): add fullId prefix logic to all five custom handler locations
- `b78f752` — test(02-13): add integration tests for custom handler plain-ID resolution

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | New API at /v2.0.0/ returns data from PostgreSQL/Hasura for all 46 resource types and 13 custom endpoints | VERIFIED | 49 registry entries (24 null + 25 non-null including alias). Null-table reads return 200 []; non-null proceed to GraphQL. 13 custom handlers all present. TypeScript compiles; 36/36 tests pass. |
| 2 | REST endpoint responses match the existing v1.8.0 API contract (same JSON structure, array wrapping, URI IDs) | VERIFIED | response.ts implements all v1.8.0 rules: scalar array-wrapping, type synthesis, null omission, camelCase, junction traversal. resource-registry.ts uses v1.8.0 OWL property names (hasVersion, hasConfiguration, hasInput, hasOutput, hasParameter, hasSetup, hasModelCategory, hasProcess, hasGrid, hasCausalDiagram, hasOutputTimeInterval, hasRegion, calibratedVariable, calibrationTargetVariable, hasPart, hasIntervention). 36 tests pass. |
| 3 | All existing REST endpoints remain functional at /v1.8.0/ (old API untouched) | VERIFIED | values.yaml: model_catalog_api block has enabled=true, api_version=v1.8.0, image=mintproject/model-catalog-fastapi. model_catalog_api_v2 block separate with enabled=false safe default. No modifications to FastAPI codebase. |
| 4 | Full CRUD (GET, POST, PUT, DELETE) works through Hasura GraphQL mutations | VERIFIED | Generic CRUD (service.ts): fullId prefix at lines 130, 230, 297 for getById/update/deleteResource. Custom handlers: ALL FIVE handler locations now apply fullId/fullCfgId prefix. custom_configurationsetups_id_get (line 349), custom_modelconfigurationsetups_id_get (line 377), custom_modelconfigurations_id_get (line 405), custom_configuration_id_inputs_get (line 557) use `variables: { id: fullId }`. custom_datasetspecifications_get (line 488-489) uses `{ cfgId: fullCfgId }`. Zero instances of `variables: { id }` (raw). TypeScript compiles. 36/36 tests pass including 3 new tests for custom handler plain-ID resolution. |
| 5 | Helm chart deploys the new API alongside existing services | VERIFIED | model-catalog-api-v2.yaml + ingress-model-catalog-api-v2.yaml present. values.yaml has model_catalog_api_v2 block at line 374. /v2.0.0 ingress path routing confirmed. Deployment uses app.ts prefix: 'v2.0.0'. |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `model-catalog-api/src/app.ts` | Fastify app with /v2.0.0 prefix and /health endpoint | VERIFIED | v2.0.0 prefix at line 138; /health at line 119 |
| `model-catalog-api/src/service.ts` | CatalogService with CRUD, fullId prefix, null-table empty responses | VERIFIED | fullId logic at lines 130, 230, 297; null-table 200[] at line 52; user_id absent |
| `model-catalog-api/src/hasura/client.ts` | Apollo Client for Hasura | VERIFIED | Present; wired via readClient.query in service.ts and custom-handlers.ts |
| `model-catalog-api/src/mappers/resource-registry.ts` | 46-entry registry with v1.8.0 OWL relationship keys | VERIFIED | 49 entries (25 non-null + 24 null + alias); 25+ relationship key renames confirmed |
| `model-catalog-api/src/mappers/response.ts` | v1.8.0 response transformer | VERIFIED | 141 lines; uses apiFieldName (registry key) as output JSON key; array-wrap, type synthesis, null omission all implemented |
| `model-catalog-api/src/mappers/request.ts` | Hasura input transformer | VERIFIED | Present; wired via toHasuraInput in service.ts create/update |
| `model-catalog-api/src/hasura/field-maps.ts` | GraphQL field selections including type for modelcatalog_software | VERIFIED | type field at line 43 of modelcatalog_software selection |
| `model-catalog-api/src/custom-handlers.ts` | 13 custom endpoint handlers with valid field selections AND fullId prefix in all five ID-resolving locations | VERIFIED | 13 handlers present; SETUP_FIELDS and CONFIGURATION_FIELDS fixed (02-12); all 5 ID locations use fullId/fullCfgId (02-13). `grep -c 'variables: { id }' custom-handlers.ts` returns 0; `grep -c 'variables: { id: fullId }' custom-handlers.ts` returns 4; `grep -c 'fullCfgId' custom-handlers.ts` returns 2. |
| `model-catalog-api/src/security.ts` | BearerAuth security handler | VERIFIED | Present; BearerAuth method at line 15 |
| `model-catalog-api/Dockerfile` | Multi-stage node:20-alpine build | VERIFIED | FROM node:20-alpine AS builder; production stage present |
| `model-catalog-api/.github/workflows/ci.yml` | CI with test gate + Docker Hub push | VERIFIED | vitest run + docker push in workflow |
| `graphql_engine/migrations/1771105512000_modelcatalog_software_type/` | up.sql + down.sql for type column | VERIFIED | up.sql: ALTER TABLE modelcatalog_software ADD COLUMN type TEXT + UPDATE backfill |
| `helm-charts/charts/mint/templates/model-catalog-api-v2.yaml` | Service + Deployment | VERIFIED | Present |
| `helm-charts/charts/mint/templates/ingress-model-catalog-api-v2.yaml` | Ingress for /v2.0.0 | VERIFIED | Present; uses model_catalog_api_v2 values block |
| `helm-charts/charts/mint/values.yaml` | model_catalog_api_v2 block + model_catalog_api v1.8.0 block | VERIFIED | model_catalog_api at line 343 (enabled=true, v1.8.0, fastapi); model_catalog_api_v2 at line 374 (enabled=false) |
| `graphql_engine/metadata/tables.yaml` | All 39 modelcatalog tables with insert/delete permissions; type in modelcatalog_software | VERIFIED | 39 tables; insert/delete permissions; type in column selections |
| `etl/extract.py` | rdf:type SPARQL extraction for software subtypes | VERIFIED | type_query and entity['type'] set |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/service.ts` | Hasura GraphQL API | `readClient.query` with fullId, no user_id | WIRED | fullId at lines 130, 230, 297; user_id absent from grep |
| `src/service.ts` | `src/mappers/resource-registry.ts` | `getResourceConfig()` + hasuraTable null check | WIRED | null-table early return at lines 50-54 and 123-127 |
| `src/custom-handlers.ts` | Hasura GraphQL API | GraphQL queries with correct field selections | WIRED | SETUP_FIELDS, CONFIGURATION_FIELDS, SOFTWARE_FIELDS all use valid columns and junction traversal |
| `src/custom-handlers.ts` | Hasura _by_pk with plain IDs | fullId prefix for all four custom path-param endpoints | WIRED | Lines 349, 377, 405, 557: all use `startsWith('https://')` guard then `variables: { id: fullId }`. Zero raw `variables: { id }` remain. |
| `src/custom-handlers.ts` | Hasura _where filter on configurationid | fullCfgId prefix for custom_datasetspecifications_get query param | WIRED | Lines 488-489: `fullCfgId` declared and used in `innerVars: { cfgId: fullCfgId }` |
| `src/mappers/response.ts` | v1.8.0 OWL property names | `result[apiFieldName]` at line 71 | WIRED | Registry keys (hasVersion, hasInput, etc.) drive JSON output field names |
| `etl/extract.py` | `etl/load.py` | `entity['type']` in software dicts | WIRED | type set at line 152 of extract.py |
| `graphql_engine/migrations/*/up.sql` | `modelcatalog_software` | `ALTER TABLE ADD COLUMN type TEXT` | WIRED | Migration file exists; type in tables.yaml permissions |
| `src/hasura/field-maps.ts` | `modelcatalog_software` GraphQL queries | `type` in field selection | WIRED | type at line 43 of field-maps.ts |

---

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| API-01: New API at /v2.0.0/ returns data from Hasura for all 46 resource types | SATISFIED | All types handled; 36 tests pass |
| API-02: REST responses match v1.8.0 JSON contract | SATISFIED | response.ts + registry key renames + 36 tests |
| API-03: All v1.8.0 endpoints remain functional | SATISFIED | values.yaml + helm templates unchanged for FastAPI |
| Phase 2 Success Criterion 4: Full CRUD through Hasura | SATISFIED | Generic CRUD + all five custom handler locations now apply fullId prefix; 36/36 tests pass |
| Phase 2 Success Criterion 5: Helm chart deploys alongside existing services | SATISFIED | Both service blocks in values.yaml; both helm templates present |

---

## Anti-Patterns Found

None. The previously-flagged anti-patterns (raw `id` usage in custom handlers at lines 348-359 and 376-386) have been resolved by plan 02-13. `grep -c 'variables: { id }' custom-handlers.ts` returns 0.

---

## Human Verification Required

### 1. Custom Setup Detail Endpoint with Plain ID

**Test:** `curl http://localhost:3000/v2.0.0/custom/modelconfigurationsetups/hand_v6`
**Expected:** 200 response with full nested setup object including inputs, outputs, parameters as nested objects
**Why human:** Requires live Hasura + populated DB. Automated checks confirm fullId prefix logic and field name correctness; end-to-end behavior depends on actual DB content and Hasura schema alignment.

### 2. Relationship Field Names in Live Response

**Test:** `curl http://localhost:3000/v2.0.0/softwares | jq '.[0] | keys'`
**Expected:** Keys include `hasVersion` (not `versions`), `id`, `label`, `description`, `type`, `author`, etc.
**Why human:** Registry key rename is verified in code; live end-to-end confirmation confirms the transformer produces correct v1.8.0 output against a real Hasura instance.

### 3. Plain UUID Lookup via Generic Endpoint

**Test:** `curl http://localhost:3000/v2.0.0/softwares/1bade4cb-d924-4253-bfa9-4c02b461396a`
**Expected:** 200 with software entity (fullId prefix logic prepends `https://w3id.org/okn/i/mint/`)
**Why human:** Unit test (Test 9 in integration.test.ts) confirms fullId logic in mock; real Hasura needed for end-to-end validation.

---

## Gap Closure Summary

**Gap from previous verification:** Custom endpoint handlers (`custom_configurationsetups_id_get` and `custom_modelconfigurationsetups_id_get`) did not apply `idPrefix` for plain IDs, passing raw decoded IDs directly to Hasura `_by_pk`.

**Resolution (plan 02-13, commits `34627e8` and `b78f752`):**
- All five ID-resolving handler locations in `custom-handlers.ts` now apply the `startsWith('https://')` guard pattern before Hasura queries
- Handler 1 (`custom_configurationsetups_id_get`, line 349): uses `resourceConfig.idPrefix` from configurationsetups
- Handler 2 (`custom_modelconfigurationsetups_id_get`, line 377): uses `resourceConfig.idPrefix` from modelconfigurationsetups
- Handler 3 (`custom_modelconfigurations_id_get`, line 405): uses `resourceConfig.idPrefix` from modelconfigurations
- Handler 4 (`custom_configuration_id_inputs_get`, line 557): uses `mcConfig.idPrefix` from modelconfigurations (correct — queries modelcatalog_model_configuration table)
- Handler 5 (`custom_datasetspecifications_get`, line 488-489): uses `mcConfig.idPrefix` from modelconfigurations for `configurationid` query param
- Three new integration tests (Test 10 describe block) verify plain-ID expansion and full-URI passthrough
- All 36 tests pass; TypeScript compiles cleanly; `variables: { id }` (raw) count is 0 in custom-handlers.ts

**Phase 2 all 5 success criteria are now fully satisfied.**

---

_Verified: 2026-02-21T17:46:57Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification of: 2026-02-21T17:16:52Z verification (previous status: gaps_found, 4/5 — custom handler plain-ID gap now closed by plan 02-13)_
