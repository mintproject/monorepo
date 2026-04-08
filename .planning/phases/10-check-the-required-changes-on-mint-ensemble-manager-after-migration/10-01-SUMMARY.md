---
phase: 10-check-the-required-changes-on-mint-ensemble-manager-after-migration
plan: "01"
subsystem: mint-ensemble-manager
tags: [graphql, adapter, migration, modelcatalog_configuration]
dependency_graph:
  requires: []
  provides:
    - "Execution fragment selecting modelcatalog_configuration_id"
    - "Emulator queries using modelcatalog_configuration relationship"
    - "executionToGQL/executionFromGQL using modelcatalog_configuration_id column"
  affects:
    - "mint-ensemble-manager/src/classes/graphql/queries/fragments/execution-info.graphql"
    - "mint-ensemble-manager/src/classes/graphql/queries/execution/increment-registered-runs-by-execution-id.graphql"
    - "mint-ensemble-manager/src/classes/graphql/queries/emulator/model-executions.graphql"
    - "mint-ensemble-manager/src/classes/graphql/queries/emulator/thread-executions.graphql"
    - "mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts"
tech_stack:
  added: []
  patterns:
    - "GraphQL queries traverse modelcatalog_configuration relationship from execution table"
    - "executionToGQL writes modelcatalog_configuration_id; executionFromGQL reads it"
key_files:
  created: []
  modified:
    - "mint-ensemble-manager/src/classes/graphql/queries/fragments/execution-info.graphql"
    - "mint-ensemble-manager/src/classes/graphql/queries/execution/increment-registered-runs-by-execution-id.graphql"
    - "mint-ensemble-manager/src/classes/graphql/queries/emulator/model-executions.graphql"
    - "mint-ensemble-manager/src/classes/graphql/queries/emulator/thread-executions.graphql"
    - "mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts"
decisions:
  - "model-executions query rewritten to start from execution table (not dropped model table) using modelcatalog_configuration relationship"
  - "thread-executions query replaces model { id, name, model_name, ... } with modelcatalog_configuration { id, label }"
  - "TypeScript Execution.modelid field name preserved; only the GraphQL column key changes"
metrics:
  duration_minutes: 4
  completed_date: "2026-04-07"
  tasks_completed: 2
  files_modified: 5
---

# Phase 10 Plan 01: Fix Ensemble Manager Execution GraphQL Queries and Adapters Summary

Fixed all breaking GraphQL queries and TypeScript adapters in mint-ensemble-manager that referenced the dropped `public.model` table or legacy `execution.model_id` column, replacing them with `modelcatalog_configuration_id` and the `modelcatalog_configuration` relationship.

## Tasks Completed

| # | Task | Commit | Files Modified |
|---|------|--------|----------------|
| 1 | Update execution GraphQL queries to use modelcatalog_configuration_id | 82debfb | execution-info.graphql, increment-registered-runs.graphql, model-executions.graphql, thread-executions.graphql |
| 2 | Update executionToGQL and executionFromGQL adapter functions | 56aaa63 | graphql_adapter.ts |

## Changes Made

### Task 1: GraphQL Query Files

**execution-info.graphql**: Replaced `model_id` with `modelcatalog_configuration_id` on the fragment selection set. This is the fragment used by all execution queries.

**increment-registered-runs-by-execution-id.graphql**: Changed the `thread_model` filter from `model_id: { _eq: $modelId }` to `modelcatalog_configuration_id: { _eq: $modelId }`. Variable name unchanged (it now carries a configuration ID value).

**model-executions.graphql**: Complete rewrite. The old query started from `model(where:{model_name:...})` which references the dropped `public.model` table. The new query starts from `execution` table with filters on `modelcatalog_configuration.label` and `thread_model_executions` path, using `distinct_on: modelcatalog_configuration_id`. Selects `modelcatalog_configuration { id, label, description, has_software_image, has_component_location }` plus thread, aggregate, parameter, and data binding data.

**thread-executions.graphql**: Replaced `model { id, name, model_name, model_version, model_configuration }` with `modelcatalog_configuration { id, label }` in the `thread_models` block.

### Task 2: TypeScript Adapter Functions

**executionToGQL** (line 606): Changed `model_id: ex.modelid` to `modelcatalog_configuration_id: ex.modelid`. The Execution interface field `modelid` is unchanged.

**executionFromGQL** (line 643): Changed `modelid: ex.model_id` to `modelid: ex.modelcatalog_configuration_id`. Now reads the correct column from the GQL response.

## Verification Results

- `model_id` in execution-info.graphql: 0 matches
- `modelcatalog_configuration_id` in execution-info.graphql: 1 match
- `model(` in model-executions.graphql: 0 matches
- `modelcatalog_configuration_id: ex.modelid` in graphql_adapter.ts: 1 match
- `modelid: ex.modelcatalog_configuration_id` in graphql_adapter.ts: 1 match

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- execution-info.graphql: FOUND (modelcatalog_configuration_id present, model_id absent)
- increment-registered-runs-by-execution-id.graphql: FOUND (modelcatalog_configuration_id filter present)
- model-executions.graphql: FOUND (modelcatalog_configuration relationship present, model table absent)
- thread-executions.graphql: FOUND (modelcatalog_configuration present, model table absent)
- graphql_adapter.ts: FOUND (both adapter functions updated)
- Commits: 82debfb (task 1), 56aaa63 (task 2) confirmed in submodule
