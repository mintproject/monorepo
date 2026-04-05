---
phase: quick-260405-nrv
plan: 01
subsystem: ui
tags: [graphql, cleanup, dead-code, dynamo-v2]
dependency_graph:
  requires: [Phase 09 unified modelcatalog_configuration table]
  provides: [clean UI with no references to deleted model table]
  affects: [ui/src/screens/modeling/actions.ts, ui/src/util/graphql_adapter.ts]
tech_stack:
  added: []
  patterns: [no-op function preservation for call-signature compatibility]
key_files:
  created: []
  modified:
    - ui/src/screens/modeling/actions.ts
    - ui/src/util/graphql_adapter.ts
  deleted:
    - ui/src/queries/model/list-in.graphql
    - ui/src/queries/model/new.graphql
    - ui/src/queries/emulator/get-model-type-configs.graphql
decisions:
  - "cacheModelsFromCatalog preserved as no-op to avoid breaking callers in thread-expansion-models.ts and mint-models.ts"
metrics:
  duration: "~5 min"
  completed: "2026-04-05"
  tasks_completed: 3
  files_modified: 2
  files_deleted: 3
---

# Quick Task 260405-nrv: Fix GraphQL Query Referencing Old Model Table Summary

**One-liner:** Removed all references to the deleted `model` table by converting `cacheModelsFromCatalog` to a no-op and deleting three dead GraphQL query files.

## What Was Done

The `model` table was removed during DYNAMO v2.0 migration (Phase 09), but the UI was still sending GraphQL queries to it, causing a "field 'model' not found in type: 'query_root'" runtime error.

### Task 1: Neutralize cacheModelsFromCatalog and remove dead model-table code

- Replaced `cacheModelsFromCatalog` body with an early `return` (no-op), preserving the function signature so callers in `thread-expansion-models.ts` and `mint-models.ts` continue to compile without changes
- Removed imports of `listExistingModelsGQL` and `newModelsGQL` from `actions.ts`
- Removed `modelToGQL` and `threadModelsToGQL` from the `graphql_adapter` import block in `actions.ts`
- Removed `fetchModelsFromCatalog` import from `screens/models/actions`
- Deleted `threadModelsToGQL` function from `graphql_adapter.ts` (referenced deleted `model` table via `model_pkey` constraint)
- Deleted `modelToGQL` function from `graphql_adapter.ts` (built insert objects for the deleted `model` table)

**Commit:** 5665ef9

### Task 2: Delete dead GraphQL query files

- Deleted `src/queries/model/list-in.graphql` (queried deleted `model` table)
- Deleted `src/queries/model/new.graphql` (mutation for deleted `model` table)
- Deleted `src/queries/emulator/get-model-type-configs.graphql` (dead code, not imported anywhere)
- Removed now-empty `src/queries/model/` directory

**Commit:** 9c8aad8

### Task 3: Verify build compiles without errors

- Confirmed no references to deleted .graphql files or removed functions remain in `ui/src/`
- TypeScript compilation via `npx tsc --noEmit` shows no errors in modified files (`actions.ts`, `graphql_adapter.ts`)
- Pre-existing TS errors in unrelated files (jsonwebtoken types, Apollo React SSR, weightless) were present before this task and are out of scope

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `ui/src/screens/modeling/actions.ts` — exists and modified
- `ui/src/util/graphql_adapter.ts` — exists and modified
- `src/queries/model/list-in.graphql` — confirmed deleted
- `src/queries/model/new.graphql` — confirmed deleted
- `src/queries/emulator/get-model-type-configs.graphql` — confirmed deleted
- Commit 5665ef9 — exists in ui submodule
- Commit 9c8aad8 — exists in ui submodule
