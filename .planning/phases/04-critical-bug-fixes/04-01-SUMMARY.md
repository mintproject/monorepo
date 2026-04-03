---
phase: 04-critical-bug-fixes
plan: 01
subsystem: graphql_engine, model-catalog-api, mint-ensemble-manager
tags: [bug-fix, schema, hasura, graphql, typescript]
dependency_graph:
  requires: []
  provides:
    - has_accepted_values TEXT[] column migration for modelcatalog_parameter
    - Hasura permission tracking for has_accepted_values (user and anonymous roles)
    - Correct configuration_id WHERE clause in datasetspecifications custom handler
    - CatalogParameter string[] | null type for has_accepted_values
  affects:
    - graphql_engine/migrations
    - graphql_engine/metadata/tables.yaml
    - model-catalog-api field selections and custom handlers
    - mint-ensemble-manager adapter interface and mapping
tech_stack:
  added: []
  patterns:
    - Hasura YAML anchor (&id006/*id006) pattern for shared column permissions
    - Anonymous role explicit column list maintained separately from anchor alias
key_files:
  created:
    - graphql_engine/migrations/1771200002000_modelcatalog_parameter_accepted_values/up.sql
    - graphql_engine/migrations/1771200002000_modelcatalog_parameter_accepted_values/down.sql
  modified:
    - graphql_engine/metadata/tables.yaml
    - /Users/mosorio/repos/model-catalog-api/src/hasura/field-maps.ts
    - /Users/mosorio/repos/model-catalog-api/src/custom-handlers.ts
    - /Users/mosorio/repos/model-catalog-api/src/__tests__/integration.test.ts
    - mint-ensemble-manager/src/classes/mint/model-catalog-graphql-adapter.ts
decisions:
  - Anonymous role in tables.yaml has explicit inline column list (not alias); must be updated independently of &id006 anchor
  - Regression test uses callArgs.query?.loc?.source?.body to extract the query string from gql template literal
metrics:
  duration: 193s
  completed: 2026-03-15
  tasks: 2
  files: 7
---

# Phase 04 Plan 01: Critical Bug Fixes — has_accepted_values Column and configuration_id WHERE Fix

**One-liner:** Added has_accepted_values TEXT[] migration with full Hasura permission tracking and fixed wrong column name (model_configuration_id -> configuration_id) in datasetspecifications WHERE clause.

## What Was Done

### Task 1: has_accepted_values column migration and Hasura metadata

Created Hasura migration to add `has_accepted_values TEXT[]` to `modelcatalog_parameter`. Updated `tables.yaml` to include the column in both the `&id006` YAML anchor block (which propagates to user role insert/select/update permissions via alias) and the anonymous role's explicit inline `select_permissions` column list. Updated all three locations in `field-maps.ts` where `modelcatalog_parameter` fields are selected.

### Task 2: Fix configuration_id column name and adapter type

Fixed the WHERE clause bug in `custom-handlers.ts` at lines 494 and 497 — changed `model_configuration_id` to `configuration_id` for both `modelcatalog_configuration_input` and `modelcatalog_configuration_output` queries. The SETUP_FIELDS reference on line 51 (`model_configuration_id`) was correctly left untouched as it selects from a different table.

Updated `CatalogParameter` interface in the adapter: `has_accepted_values` type changed from `string` to `string[] | null`. Fallback in the mapping changed from `""` to `[]`.

Added regression test to `integration.test.ts` asserting query body contains `configuration_id` and does not contain `model_configuration_id`.

## Verification

- Migration files: `up.sql` (ADD COLUMN) and `down.sql` (DROP COLUMN IF EXISTS) present
- `tables.yaml` has 2 occurrences of `has_accepted_values` (anchor + anonymous explicit list)
- `field-maps.ts` has 3 occurrences of `has_accepted_values` (two parameter sub-blocks + standalone list)
- `custom-handlers.ts` has exactly 1 `model_configuration_id` (SETUP_FIELDS select only)
- Adapter types `string[] | null` with `[]` fallback confirmed
- TypeScript compiles clean: `npx tsc --noEmit` exits 0
- All 37 tests pass: `npx vitest run` (2 test files, 37 tests)

## Commits

**graphql_engine submodule:**
- `eb4fd01` feat(04-01): add has_accepted_values TEXT[] column to modelcatalog_parameter

**model-catalog-api:**
- `53c1c92` feat(04-01): add has_accepted_values to modelcatalog_parameter field selections
- `4b5d296` fix(04-01): use configuration_id in datasetspecifications WHERE clauses and add regression test

**mint-ensemble-manager submodule:**
- `224e7ea` fix(04-01): type has_accepted_values as string[] | null with [] fallback

**mint repo (submodule pointer updates):**
- `68033d1` chore(04-01): update graphql_engine submodule with has_accepted_values migration
- `f5a43e2` chore(04-01): update mint-ensemble-manager submodule with adapter type fix

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

All key files present. All commits verified in git log.
