---
phase: 10-check-the-required-changes-on-mint-ensemble-manager-after-migration
plan: "02"
subsystem: mint-ensemble-manager
tags: [cleanup, dead-code, graphql, tests, ensemble-manager]
dependency_graph:
  requires: ["10-01"]
  provides: ["clean-adapter-no-dead-code", "adapter-unit-tests"]
  affects: ["mint-ensemble-manager/src/classes/graphql", "mint-ensemble-manager/src/api"]
tech_stack:
  added: []
  patterns: ["TDD unit tests for adapter functions", "Dead code removal"]
key_files:
  created:
    - mint-ensemble-manager/src/classes/graphql/graphql_adapter.test.ts
  modified:
    - mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts
    - mint-ensemble-manager/src/classes/mint/model-catalog-graphql-adapter.ts
    - mint-ensemble-manager/src/api/api-v1/services/threadsService.ts
  deleted:
    - mint-ensemble-manager/src/classes/graphql/queries/model/new.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/model/list-in.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-setup.graphql
decisions:
  - "Deleted modelIOToGQL, getModelIOFixedBindings, getVariableData helper chain (only called by modelToGQL chain, all dead)"
  - "Pre-existing test failures in ExecutionCreation.test.ts and TACC_CKAN_Datacatalog.integration.test.ts are out of scope (existed before this plan)"
metrics:
  duration: "8 minutes"
  completed: "2026-04-07"
  tasks_completed: 3
  files_modified: 7
---

# Phase 10 Plan 02: Dead Code Removal and Adapter Tests Summary

Post-migration cleanup of mint-ensemble-manager: removed all dead code referencing the dropped `model` table, deleted 3 obsolete GraphQL files, and added 4 unit tests verifying the `modelcatalog_configuration_id` mapping in `executionToGQL`/`executionFromGQL`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove dead code and consolidate duplicate GraphQL files | ae2c96a | graphql_adapter.ts, model-catalog-graphql-adapter.ts, threadsService.ts, 3 deleted .graphql files |
| 2 | Add unit tests for executionToGQL and executionFromGQL | 9aff8bc | graphql_adapter.test.ts |
| 3 | Verify build succeeds and no remaining stale references | — | No files changed (validation only) |

## What Was Done

**Task 1 — Dead code removal:**
- Deleted `queries/model/new.graphql` (placeholder comment file)
- Deleted `queries/model/list-in.graphql` (queried dropped `model` table)
- Deleted `queries/model/get-modelcatalog-setup.graphql` (duplicate of get-modelcatalog-configuration.graphql)
- Removed `threadModelsToGQL`, `modelIOFromGQL`, `getNamespacedId`, `modelToGQL`, `modelInputOutputToGQL`, `modelParameterToGQL` from graphql_adapter.ts
- Also removed the private `modelIOToGQL`, `getModelIOFixedBindings`, `getVariableData` helpers (only called by deleted chain)
- Removed `convertW3IdToApiUrl` from model-catalog-graphql-adapter.ts (not imported anywhere)
- Updated threadsService.ts import from `get-modelcatalog-setup.graphql` to `get-modelcatalog-configuration.graphql`

**Task 2 — Unit tests:**
- Created `graphql_adapter.test.ts` with 4 tests covering executionToGQL/executionFromGQL
- All 4 tests pass

**Task 3 — Build and audit:**
- `npm run build` exits 0 (webpack compiled successfully)
- No stale constraint references (`model_pkey`, `model_input_pkey`, etc.) in src/ outside of valid `thread_model_pkey`
- No imports of deleted files anywhere in src/
- Wings code has no broken references (clean)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deleted helper chain alongside modelToGQL**
- **Found during:** Task 1
- **Issue:** `modelIOToGQL`, `getModelIOFixedBindings`, `getVariableData` were private helpers only called by `modelInputOutputToGQL` which was only called by `modelToGQL` (also dead). Plan listed `modelInputOutputToGQL` and `modelParameterToGQL` but not the deeper helpers.
- **Fix:** Removed the full dead helper chain to avoid TypeScript unused variable warnings
- **Files modified:** `src/classes/graphql/graphql_adapter.ts`
- **Commit:** ae2c96a

## Verification Results

- `npm run build`: PASS (webpack compiled successfully in 4499ms)
- `npm test` (new tests): PASS — 4/4 adapter tests pass
- No `modelToGQL` in graphql_adapter.ts: PASS
- No `convertW3IdToApiUrl` in model-catalog-graphql-adapter.ts: PASS
- No `get-modelcatalog-setup` in threadsService.ts: PASS
- Deleted files do not exist on disk: PASS
- graphql_adapter.test.ts exists with passing tests: PASS

**Pre-existing test failures (out of scope):**
- `ExecutionCreation.test.ts` — 1 test failing (TypeError in modelFromGQL on mock data)
- `TACC_CKAN_Datacatalog.integration.test.ts` — integration test suite fails (requires live CKAN endpoint)
Both failures existed before this plan and are unrelated to our changes.

## Known Stubs

None — all changes remove code rather than add placeholder implementations.

## Self-Check: PASSED
