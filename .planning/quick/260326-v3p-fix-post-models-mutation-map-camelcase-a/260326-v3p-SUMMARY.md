---
phase: quick
plan: 260326-v3p
subsystem: model-catalog-api
tags: [request-mapper, hasura, camelcase, validation, tdd]
dependency_graph:
  requires: []
  provides: [column-aware-toHasuraInput]
  affects: [POST /models, POST /softwareversions, all resource POST/PUT endpoints]
tech_stack:
  added: []
  patterns: [scalar-column-whitelist, FIELD_SELECTIONS-parsing, set-based-lookup, module-level-cache]
key_files:
  created:
    - model-catalog-api/src/mappers/__tests__/request.test.ts
  modified:
    - model-catalog-api/src/mappers/request.ts
decisions:
  - "Parse FIELD_SELECTIONS strings to derive valid columns -- avoids duplicating column lists, single source of truth"
  - "Cache parsed column sets at module level -- FIELD_SELECTIONS is static, no need to re-parse per request"
  - "Drop unknown fields silently -- consistent with how type is handled, avoids exposing internals to callers"
metrics:
  duration: 5 min
  completed: 2026-03-26
  tasks_completed: 1
  files_changed: 2
---

# Quick Task 260326-v3p: Fix POST /models mutation map camelCase

**One-liner:** Column-aware `toHasuraInput` that validates against FIELD_SELECTIONS before sending fields to Hasura, silently dropping unknown and cross-resource fields.

## What Was Built

Modified `toHasuraInput` in `model-catalog-api/src/mappers/request.ts` to validate each snake_case field name against the known scalar columns for the target Hasura table before including it in the mutation input.

Added `getScalarColumns(tableName: string): Set<string>` helper that:
1. Reads the field selection string from `FIELD_SELECTIONS[tableName]`
2. Parses it line-by-line, keeping only plain identifier lines (no `{` or `}`)
3. Returns a `Set<string>` of valid column names
4. Caches results at module level (FIELD_SELECTIONS is static)

The `toHasuraInput` function now:
- Passes `id` through before column validation (always valid)
- Skips `type` field (unchanged)
- Skips known relationship fields (unchanged)
- Converts remaining camelCase keys to snake_case
- Checks `scalarColumns.has(snakeKey)` -- drops unknown fields silently
- Only unwraps and includes valid scalar columns

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add column validation to toHasuraInput and test | 7e0bf26 | request.ts, request.test.ts |

## Test Results

- 10 new tests added in `src/mappers/__tests__/request.test.ts`
- All 56 tests across the full test suite pass
- TypeScript compiles cleanly (`npx tsc --noEmit`)

Key test cases:
- `models` + `shortDescription` -> dropped (`short_description` not a column on `modelcatalog_software`)
- `models` + `hasModelCategory` -> dropped (not a relationship on models config, not a column either)
- `models` + `label`, `description` -> included (valid scalar columns)
- `models` + `id` -> included (id bypass before column check)
- `models` + `type` -> dropped (type field bypass unchanged)
- `softwareversions` + `shortDescription` -> included (`short_description` is a valid column on `modelcatalog_software_version`)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `model-catalog-api/src/mappers/request.ts` exists and modified
- [x] `model-catalog-api/src/mappers/__tests__/request.test.ts` exists and created
- [x] Commit 7e0bf26 exists in model-catalog-api repo
- [x] All 56 tests pass
- [x] No TypeScript errors
