---
phase: 03-fk-migration-and-cleanup
plan: 03
subsystem: api
tags: [typescript, graphql, model-catalog, sdk-removal, hasura, ensemble-manager]

# Dependency graph
requires:
  - phase: 01-schema-and-data-migration
    provides: modelcatalog_model_configuration, modelcatalog_model_configuration_setup, modelcatalog_parameter, modelcatalog_dataset_specification tables
  - phase: 03-fk-migration-and-cleanup
    provides: "03-01: FK migration SQL + Hasura metadata (modelcatalog_* relationship names in tables.yaml)"
provides:
  - SDK dependency (@mintproject/modelcatalog_client) removed from package.json
  - model-catalog-functions.ts deleted (fetch-and-copy REST pattern removed)
  - model-catalog-graphql-adapter.ts rewritten with inline types matching GraphQL flat scalar shapes
  - Two new GraphQL query files for direct Hasura lookups of modelcatalog_model_configuration_setup and modelcatalog_model_configuration by PK
  - All service files updated to use direct Hasura GraphQL instead of REST API fetch
  - convertApiUrlToW3Id utility moved to model-catalog-graphql-adapter.ts
affects: [03-04, future-model-catalog-api-removal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Direct Hasura GraphQL lookup of modelcatalog_* tables via get-modelcatalog-setup.graphql and get-modelcatalog-configuration.graphql
    - Inline TypeScript interfaces matching flat scalar GraphQL response shapes (no array-unwrapping)
    - GraphQL client queries (GraphQL.instanceUsingAccessToken) replace REST API fetch calls in service layer
    - Junction table traversal pattern: model.inputs[].input / model.parameters[].parameter / model.outputs[].output

key-files:
  created:
    - mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-setup.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-configuration.graphql
  modified:
    - mint-ensemble-manager/package.json
    - mint-ensemble-manager/src/classes/mint/model-catalog-graphql-adapter.ts
    - mint-ensemble-manager/src/classes/mint/mint-types.ts
    - mint-ensemble-manager/src/classes/graphql/graphql_functions.ts
    - mint-ensemble-manager/src/api/api-v1/services/subTasksService.ts
    - mint-ensemble-manager/src/api/api-v1/services/threadsService.ts
    - mint-ensemble-manager/src/api/api-v1/services/useModelService/useModelInputService.ts
    - mint-ensemble-manager/src/api/api-v1/services/useModelService/useModelParameterService.ts
    - mint-ensemble-manager/src/api/api-v1/services/useModelService/useModelParameterService.test.ts
    - mint-ensemble-manager/src/api/api-v1/services/useModelService/useModelInputService.test.ts
  deleted:
    - mint-ensemble-manager/src/classes/mint/model-catalog-functions.ts
    - mint-ensemble-manager/src/classes/mint/__tests__/model-catalog-functions.test.ts

key-decisions:
  - "Hasura relationship names in GraphQL queries use 'parameters', 'inputs', 'outputs' (array rels on modelcatalog_model_configuration/setup) then 'parameter', 'input', 'output' (object rels on junction tables) -- NOT the plan's assumed setup_parameters/setup_inputs pattern"
  - "convertApiUrlToW3Id and convertW3IdToApiUrl moved to model-catalog-graphql-adapter.ts as the canonical utility location"
  - "threadsService.ts createThread (legacy endpoint) updated to use flat GraphQL shape; hasPresentation variables become empty array since modelcatalog_dataset_specification has no variable presentation data"
  - "useModelParameterService uses has_fixed_value (scalar string) instead of SDK hasFixedValue (string[])"
  - "useModelInputService: all inputs from Hasura treated as non-fixed (hasFixedResource=[] in compatibility shape) because modelcatalog_dataset_specification has no has_fixed_resource column"
  - "Tests updated to mock GraphQL Apollo client instead of fetchCustomModelConfigurationOrSetup REST function"

patterns-established:
  - "GraphQL queries for modelcatalog_* use two-level traversal: parent.{inputs/outputs/parameters}[].{input/output/parameter}.{fields}"
  - "Inline interfaces (CatalogModelConfigurationSetup, CatalogModelConfiguration, CatalogParameter, CatalogDatasetSpec) define the shape of Hasura GraphQL responses"
  - "Service files query Hasura directly via GraphQL.instanceUsingAccessToken(access_token) for authenticated model catalog lookups"

# Metrics
duration: 13min
completed: 2026-02-21
---

# Phase 3 Plan 03: SDK Removal and Adapter Rewrite Summary

**@mintproject/modelcatalog_client SDK removed from Ensemble Manager; fetch-and-copy REST pattern deleted; adapter rewritten with flat GraphQL types; all services now query modelcatalog_* tables directly via Hasura**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-02-21T21:14:51Z
- **Completed:** 2026-02-21T21:27:55Z
- **Tasks:** 2
- **Files modified:** 10 (modified) + 2 created + 2 deleted

## Accomplishments

- Removed `@mintproject/modelcatalog_client` SDK dependency from package.json
- Deleted `model-catalog-functions.ts` (the fetch-and-copy REST pattern with `request-promise-native` HTTP calls) and its test file
- Created two new GraphQL query files (`get-modelcatalog-setup.graphql`, `get-modelcatalog-configuration.graphql`) using correct Hasura relationship names derived from tables.yaml inspection
- Rewrote `model-catalog-graphql-adapter.ts` with inline TypeScript interfaces matching flat scalar fields from Hasura (no `?.[0]` array unwrapping)
- Updated all 6 service files (subTasksService, threadsService, useModelInputService, useModelParameterService) and 2 test files to use direct GraphQL queries instead of REST API calls

## Task Commits

Each task was committed atomically (in `mint-ensemble-manager` submodule):

1. **Task 1: Remove SDK, delete model-catalog-functions.ts, create new GraphQL queries** - `65c08c0` (feat)
2. **Task 2: Rewrite adapter and update all SDK import files** - `9c7ca0f` (feat)

## Files Created/Modified

- `mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-setup.graphql` - Direct Hasura lookup of modelcatalog_model_configuration_setup_by_pk with parameters/inputs/outputs traversal
- `mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-configuration.graphql` - Direct Hasura lookup of modelcatalog_model_configuration_by_pk with parameters/inputs/outputs traversal
- `mint-ensemble-manager/src/classes/mint/model-catalog-graphql-adapter.ts` - Rewritten with CatalogModelConfiguration, CatalogModelConfigurationSetup, CatalogParameter, CatalogDatasetSpec interfaces; convertApiUrlToW3Id utility; no array-unwrapping patterns
- `mint-ensemble-manager/src/classes/mint/mint-types.ts` - Removed model_catalog_api from MintPreferences interface
- `mint-ensemble-manager/src/classes/graphql/graphql_functions.ts` - Removed ModelConfigurationSetup SDK import; added inline CatalogModelSetup interface; setThreadModels accepts `Array<{id:string}>` instead of SDK type
- `mint-ensemble-manager/src/api/api-v1/services/subTasksService.ts` - addModels uses GraphQL queries instead of fetchModelConfiguration/fetchModelConfigurationSetup REST calls
- `mint-ensemble-manager/src/api/api-v1/services/threadsService.ts` - createThread (legacy) uses GraphQL setup lookup instead of fetchModelFromCatalog; hasInput/hasParameter loops updated for flat schema
- `mint-ensemble-manager/src/api/api-v1/services/useModelService/useModelInputService.ts` - Replaced SDK types and REST fetch with GraphQL client; fetchModelByW3Id tries configuration then setup
- `mint-ensemble-manager/src/api/api-v1/services/useModelService/useModelParameterService.ts` - Replaced SDK types and REST fetch with GraphQL client; uses has_fixed_value scalar field
- `mint-ensemble-manager/src/api/api-v1/services/useModelService/useModelParameterService.test.ts` - Updated mocks and fixtures for new GraphQL client and flat schema shape
- `mint-ensemble-manager/src/api/api-v1/services/useModelService/useModelInputService.test.ts` - Updated mocks for new GraphQL client
- `mint-ensemble-manager/package.json` - Removed @mintproject/modelcatalog_client dependency
- ~~`mint-ensemble-manager/src/classes/mint/model-catalog-functions.ts`~~ - Deleted
- ~~`mint-ensemble-manager/src/classes/mint/__tests__/model-catalog-functions.test.ts`~~ - Deleted

## Decisions Made

- **Hasura relationship names**: The plan assumed `setup_parameters`, `setup_inputs`, `setup_outputs` as relationship names on the setup table. After inspecting tables.yaml, the correct names on `modelcatalog_model_configuration_setup` and `modelcatalog_model_configuration` are `parameters`, `inputs`, `outputs` (array relationships to junction tables). The junction tables have `parameter`, `input`, `output` object relationships to the actual entities. GraphQL queries use this two-level traversal.
- **convertApiUrlToW3Id relocation**: Moved to `model-catalog-graphql-adapter.ts` as the canonical home for model catalog utility functions.
- **threadsService.ts legacy endpoint**: The `createThread` POST /threads endpoint accesses `model.hasInput` and `model.hasParameter` with SDK-style fields. Updated to use new flat shape from Hasura (`model.inputs[].input`, `model.parameters[].parameter`). `hasPresentation` variables unavailable; empty string array passed to queryDatasetDetails.
- **has_fixed_resource not in schema**: `modelcatalog_dataset_specification` table has no `has_fixed_resource` column, so all inputs from Hasura are treated as non-fixed (empty `hasFixedResource` array in compatibility shape).
- **Test mocking strategy**: Tests now mock `GraphQL.instance` and `GraphQL.instanceUsingAccessToken` at the Apollo client level, returning mock objects with `.query()`. This is more architecturally correct than mocking individual REST fetch functions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GraphQL query relationship names corrected to match actual Hasura metadata**
- **Found during:** Task 1 (Create new GraphQL queries)
- **Issue:** Plan specified `setup_parameters`, `setup_inputs`, `setup_outputs` as relationship names in the GraphQL queries. Inspection of tables.yaml revealed the actual names on `modelcatalog_model_configuration_setup` and `modelcatalog_model_configuration` are `parameters`, `inputs`, `outputs` (array relationships to junction tables).
- **Fix:** Used `parameters { parameter { ... } }`, `inputs { input { ... } }`, `outputs { output { ... } }` traversal pattern matching actual Hasura metadata.
- **Files modified:** Both .graphql files
- **Verification:** Names verified against tables.yaml entries for both configuration and setup tables.
- **Committed in:** `65c08c0` (Task 1 commit)

**2. [Rule 1 - Bug] Added convertApiUrlToW3Id export to model-catalog-graphql-adapter.ts**
- **Found during:** Task 2 (Update all SDK import files)
- **Issue:** Multiple service files imported `convertApiUrlToW3Id` from the deleted `model-catalog-functions.ts`. A replacement location was needed.
- **Fix:** Added `convertApiUrlToW3Id` and `convertW3IdToApiUrl` as exports in `model-catalog-graphql-adapter.ts`.
- **Files modified:** `model-catalog-graphql-adapter.ts`
- **Committed in:** `9c7ca0f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs in plan assumptions)
**Impact on plan:** Both fixes were required for correctness. No scope creep.

## Issues Encountered

- Node modules not installed in mint-ensemble-manager, so TypeScript compilation via `tsc --noEmit` could not be run. All imports verified by inspection of actual file paths and existing usage patterns.
- `GraphQL.instance()` requires a `User` argument (not zero-argument). Service files updated to use `GraphQL.instanceUsingAccessToken(access_token)` since these operations are user-authenticated.

## User Setup Required

None - no external service configuration required. The SDK removal does not require any infrastructure changes; it will take effect when dependencies are reinstalled with `npm install`.

## Next Phase Readiness

- SDK removal is complete; plan 03-04 can proceed with any remaining Ensemble Manager cleanup
- No imports of `@mintproject/modelcatalog_client` remain in the source tree
- The new GraphQL queries will need to be tested against a live Hasura instance (with the FK migrations from 03-01 applied) to validate the relationship traversal
- Potential issue: `modelcatalog_dataset_specification` `position` column - if it doesn't exist in the actual table, the GraphQL queries may need adjustment

---
*Phase: 03-fk-migration-and-cleanup*
*Completed: 2026-02-21*
