---
phase: 09-merge-modelconfiguration-setup-tables-and-migrate-thread-model-relationships
plan: "04"
subsystem: mint-ensemble-manager
tags:
  - graphql-migration
  - ensemble-manager
  - model-catalog-cleanup
dependency_graph:
  requires:
    - 09-01 (unified modelcatalog_configuration table)
  provides:
    - ensemble manager fully migrated to modelcatalog_configuration
    - no public.model inserts from ensemble manager
    - types.ts regenerated with Modelcatalog_Configuration type
  affects:
    - mint-ensemble-manager/src/classes/graphql/queries/
    - mint-ensemble-manager/src/classes/graphql/graphql_functions.ts
    - mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts
    - mint-ensemble-manager/src/classes/graphql/types.ts
    - mint-ensemble-manager/src/classes/mint/model-catalog-graphql-adapter.ts
    - mint-ensemble-manager/src/api/api-v1/services/
    - graphql_engine/metadata/tables.yaml
tech_stack:
  added: []
  patterns:
    - modelcatalog_configuration_id as FK in thread_model (replaces model_id intermediary)
    - modelIOFromCatalogGQL and modelParameterFromCatalogGQL as new mapping helpers
    - Direct thread_model creation bypassing public.model table
key_files:
  created: []
  modified:
    - mint-ensemble-manager/src/classes/graphql/queries/model/get.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/model/new.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/model/delete.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-configuration.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-setup.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/model_output/get.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/thread/get.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/fragments/model-info.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/emulator/model-types.graphql
    - mint-ensemble-manager/src/classes/graphql/graphql_functions.ts
    - mint-ensemble-manager/src/classes/mint/model-catalog-graphql-adapter.ts
    - mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts
    - mint-ensemble-manager/src/classes/graphql/types.ts
    - mint-ensemble-manager/src/api/api-v1/services/subTasksService.ts
    - mint-ensemble-manager/src/api/api-v1/services/threadsService.ts
    - graphql_engine/metadata/tables.yaml
decisions:
  - "modelIOFromCatalogGQL helper added alongside existing modelIOFromGQL to handle new catalog junction shape"
  - "Local interface types defined in useModelInputService/useModelParameterService instead of re-exporting from adapter"
  - "CatalogDatasetSpec replaced with any[] in SubtasksService interface (return type widened)"
metrics:
  duration: 25 minutes
  completed_date: "2026-04-05"
  tasks_completed: 3
  files_modified: 16
---

# Phase 09 Plan 04: Ensemble Manager Migration to modelcatalog_configuration Summary

Rewrote ensemble manager to eliminate all public.model table usage, removed 6 legacy adapter functions, updated all GraphQL queries to use modelcatalog_configuration directly, and regenerated GraphQL types reflecting the unified schema.

## What Was Built

### Task 1: GraphQL Query Updates

All GraphQL query files updated to use `modelcatalog_configuration` instead of `model` (public.model):

- `queries/model/get.graphql`: `model_by_pk` -> `modelcatalog_configuration_by_pk`
- `queries/model/new.graphql`: `insert_model` mutation removed (replaced with comment)
- `queries/model/delete.graphql`: Rewrote to delete `thread_model` rows by `modelcatalog_configuration_id`
- `queries/model/get-modelcatalog-configuration.graphql`: Updated to `modelcatalog_configuration_by_pk`
- `queries/model/get-modelcatalog-setup.graphql`: Updated to `modelcatalog_configuration_by_pk` (same unified table)
- `queries/model_output/get.graphql`: `model_by_pk` -> `modelcatalog_configuration_by_pk`
- `queries/thread/get.graphql`: `thread_models.model { ...model_info }` -> `thread_models.modelcatalog_configuration { ...model_info }`
- `queries/fragments/model-info.graphql`: Fragment rewritten on `modelcatalog_configuration` type with new field names
- `queries/emulator/model-types.graphql`: `distinct_on: model_id` -> `distinct_on: modelcatalog_configuration_id`

`graphql_functions.ts` updated:
- `setThreadModels`: `model_id` -> `modelcatalog_configuration_id` in thread_model insert input
- `getModel`: `result.data.model_by_pk` -> `result.data.modelcatalog_configuration_by_pk`
- `getModelOutput`: same fix
- `insertModel` function removed (no longer inserts into public.model)
- `Model_Insert_Input` import removed

### Task 2: Legacy Adapter Functions Removed

`model-catalog-graphql-adapter.ts` stripped to utility-only file:
- Removed: `modelConfigurationToGraphQL`, `modelConfigurationSetupToGraphQL`, `modelInputToGraphQL`, `modelOutputToGraphQL`, `modelParameterToGraphQL`, `modelParametersToGraphQL`
- Removed: `CatalogModelConfiguration`, `CatalogModelConfigurationSetup`, `CatalogDatasetSpec`, `CatalogParameter`, and all junction row interfaces
- Kept: `convertApiUrlToW3Id`, `convertW3IdToApiUrl`

`graphql_adapter.ts` updated:
- `modelFromGQL`: Rewritten to map from `modelcatalog_configuration` shape (uses `label`, `has_component_location`, `has_software_image`, junction traversals)
- Added `modelIOFromCatalogGQL` and `modelParameterFromCatalogGQL` helper functions
- `threadFromGQL`: Uses `tm.modelcatalog_configuration` instead of `tm.model`

`subTasksService.ts`:
- Removed `insertModel`, `modelConfigurationToGraphQL`, `modelConfigurationSetupToGraphQL` imports and calls
- `addModels` now: verify config exists via `modelcatalog_configuration_by_pk`, then call `setThreadModels` directly

`threadsService.ts`:
- Removed `insertModel`, `modelConfigurationSetupToGraphQL` imports and calls
- Thread creation now calls `setThreadModels` directly with `modelcatalog_configuration_id`

### Task 3: GraphQL Types Regenerated

Applied pending DB migrations (10000, 11000, 12000) and updated Hasura metadata before running codegen:
- `types.ts`: Contains `Modelcatalog_Configuration` type (26 occurrences)
- `Thread_Model`: Has `modelcatalog_configuration_id` field and `modelcatalog_configuration` object relationship
- Old `Model_Insert_Input` type (for public.model) removed from generated types
- `npx tsc --noEmit` compiles with zero source errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration index name collision**
- **Found during:** Task 3 (applying migrations before codegen)
- **Issue:** `idx_mc_config_author` already existed on `modelcatalog_model_configuration`; migration 10000 tried to create same-named index on new `modelcatalog_configuration` table
- **Fix:** Renamed new indexes to `idx_mc_configuration_sv`, `idx_mc_configuration_parent`, `idx_mc_configuration_author`
- **Files modified:** `graphql_engine/migrations/1771200010000_merge_configuration_tables/up.sql`
- **Note:** Another parallel agent (09-01) also committed the same fix; changes were identical

**2. [Rule 1 - Bug] Migration FK constraint blocks table drop**
- **Found during:** Task 3 (applying migration 11000)
- **Issue:** `execution_modelcatalog_setup_id_fkey` and `thread_model_modelcatalog_setup_id_fkey` prevented dropping `modelcatalog_model_configuration_setup` in migration 11000; migration 12000 was supposed to remove them but runs after
- **Fix:** Added explicit `ALTER TABLE ... DROP CONSTRAINT IF EXISTS` statements in migration 11000 SECTION 5 before the DROP TABLE statements
- **Files modified:** `graphql_engine/migrations/1771200011000_merge_junction_tables/up.sql`
- **Note:** Same parallel agent also committed this fix

**3. [Rule 1 - Bug] Hasura metadata referenced dropped tables**
- **Found during:** Task 3 (metadata apply failed)
- **Issue:** `metadata/tables.yaml` still had entries for `model`, `model_input`, `model_output`, `model_parameter`, and a relationship in `modelcatalog_software_version` pointing to `modelcatalog_model_configuration`
- **Fix:** Removed all 4 table entries, removed `model_inputs`/`model_outputs` array relationships from `model_io`, updated `configurations` relationship to reference `modelcatalog_configuration`
- **Files modified:** `graphql_engine/metadata/tables.yaml`
- **Commit:** 32cedad

**4. [Rule 1 - Bug] TypeScript source errors from removed types**
- **Found during:** Task 3 (tsc --noEmit)
- **Issue:** Multiple files imported `CatalogDatasetSpec`, `CatalogModelConfiguration`, `CatalogModelConfigurationSetup`, `CatalogParameter` which were removed from adapter; `executions/index.ts` referenced `tm.model` and `binding.model_parameter.name` which no longer exist in generated types
- **Fix:**
  - `executions/index.ts`: `binding.model_parameter.name` -> `binding.model_parameter_id`; `threadModel.model?.id` -> `threadModel.modelcatalog_configuration?.id`
  - `subTasksService.ts`: `CatalogDatasetSpec[]` return type -> `any[]`
  - `useModelInputService.ts`: defined local interface types, updated query data access to `modelcatalog_configuration_by_pk`
  - `useModelParameterService.ts`: defined local interface types, updated query data access to `modelcatalog_configuration_by_pk`
- **Commits:** cb8560e

## Self-Check: PASSED

All files verified to exist. Commits verified in git log.
