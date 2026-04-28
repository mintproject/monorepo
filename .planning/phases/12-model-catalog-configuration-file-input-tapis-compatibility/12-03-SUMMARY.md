---
phase: 12-model-catalog-configuration-file-input-tapis-compatibility
plan: "03"
subsystem: mint-ensemble-manager
tags:
  - graphql
  - adapter
  - tdd
  - is_optional
  - codegen
dependency_graph:
  requires:
    - "12-01-PLAN.md"
  provides:
    - ModelIO.is_optional field for Wave 3 TapisJobService skip logic
  affects:
    - mint-ensemble-manager/src/classes/mint/mint-types.ts
    - mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts
    - mint-ensemble-manager/src/classes/graphql/graphql_adapter.test.ts
    - mint-ensemble-manager/src/classes/graphql/queries/fragments/model-info.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-configuration.graphql
    - mint-ensemble-manager/src/classes/graphql/types.ts
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN for adapter behavior verification
    - Junction-row level GraphQL field selection (is_optional before nested input block)
    - Codegen commit in same task as fragment edits
key_files:
  created: []
  modified:
    - mint-ensemble-manager/src/classes/mint/mint-types.ts
    - mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts
    - mint-ensemble-manager/src/classes/graphql/graphql_adapter.test.ts
    - mint-ensemble-manager/src/classes/graphql/queries/fragments/model-info.graphql
    - mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-configuration.graphql
    - mint-ensemble-manager/src/classes/graphql/types.ts
decisions:
  - "modelIOFromCatalogGQL signature changed from (io: any) to (junctionRow: any, entityKey?: string) so the junction-level is_optional field can be accessed alongside the nested input entity"
  - "output_files caller passes entityKey='output' so the entity is found at row.output; is_optional defaults to false for outputs (out of scope per D-14)"
  - "is_optional selected at inputs junction level (before nested input block) in both GraphQL fragments, not inside input{} which would resolve null"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-28"
  tasks_completed: 2
  files_modified: 6
---

# Phase 12 Plan 03: is_optional Flow from Hasura to ModelIO Summary

**One-liner:** Junction-row `is_optional` boolean flows from Hasura GraphQL through the adapter into `ModelIO` with TDD coverage and regenerated types.

## What Was Built

Updated `mint-ensemble-manager` so that the `is_optional` flag from the `modelcatalog_configuration_input` junction table flows end-to-end through the GraphQL query layer into the `ModelIO` interface that `TapisJobService` (Wave 3) consumes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add is_optional to ModelIO interface and GraphQL fragments | 60e6f2e | mint-types.ts, model-info.graphql, get-modelcatalog-configuration.graphql |
| 2 RED | Failing tests for modelIOFromCatalogGQL | 8f171c1 | graphql_adapter.test.ts |
| 2 GREEN | Update adapter + codegen | 0e765b1 | graphql_adapter.ts, types.ts, graphql.ts |
| bump | Submodule pointer bump in superproject | dfc13c9 | mint-ensemble-manager (submodule ref) |

## Key Changes

**ModelIO interface (`mint-types.ts`):**
- Added `is_optional?: boolean` field; optional so existing code needs no changes

**GraphQL fragments (both files):**
- Added `is_optional` at junction row level (before `input { }` block) in `model-info.graphql` and `get-modelcatalog-configuration.graphql`
- Correct placement: `modelcatalog_configuration_input.is_optional`, not inside the nested `modelcatalog_dataset_specification` entity

**Adapter (`graphql_adapter.ts`):**
- `modelIOFromCatalogGQL` signature changed from `(io: any)` to `(junctionRow: any, entityKey?: string)`
- Reads `junctionRow.is_optional ?? false` — defaults to `false` when absent
- `input_files` caller passes full row (junction row); `output_files` caller passes `(row, 'output')`

**Tests (`graphql_adapter.test.ts`):**
- Two new tests: `is_optional=true` reads through; absent flag defaults to `false`
- All 65 tests pass across 12 test suites

**Codegen (`types.ts`):**
- Regenerated after fragment edits; `is_optional: Scalars['Boolean']['output']` appears in the generated `modelcatalog_configuration_input` type

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED gate: commit `8f171c1` — `test(12-03): add failing tests for modelIOFromCatalogGQL is_optional behavior`
- GREEN gate: commit `0e765b1` — `feat(12-03): update modelIOFromCatalogGQL to read is_optional from junction row`

Both gates present and in correct order.

## Known Stubs

None — all data flows are wired. The `is_optional` field is populated from the live Hasura response. Wave 3 (TapisJobService skip logic) is the consumer — not yet implemented, but that is Plan 04 scope.

## Threat Flags

No new security-relevant surface introduced. The `is_optional` boolean is read from Hasura response (admin-secret-controlled write path), not user input. Accepted per T-12-07 and T-12-08 in plan threat model.

## Self-Check: PASSED

Files verified:
- `mint-ensemble-manager/src/classes/mint/mint-types.ts` — contains `is_optional?: boolean`
- `mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts` — contains `junctionRow.is_optional`
- `mint-ensemble-manager/src/classes/graphql/graphql_adapter.test.ts` — 4 references to `modelIOFromCatalogGQL`
- `mint-ensemble-manager/src/classes/graphql/queries/fragments/model-info.graphql` — `is_optional` on line 9 before `input {` on line 10
- `mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-configuration.graphql` — `is_optional` before `input {`
- `mint-ensemble-manager/src/classes/graphql/types.ts` — 7 matches for `is_optional`

Commits verified:
- `60e6f2e` (submodule) — Task 1
- `8f171c1` (submodule) — Task 2 RED
- `0e765b1` (submodule) — Task 2 GREEN
- `dfc13c9` (superproject) — submodule pointer bump

Test suite: 65 passed, 0 failed, 12 suites
Codegen: exited 0
