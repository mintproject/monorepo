---
phase: quick
plan: 260326-uar
subsystem: model-catalog-api
tags: [bugfix, api, type-filtering]
dependency-graph:
  requires: []
  provides: [models-endpoint-returns-all-subtypes]
  affects: [model-catalog-api]
tech-stack:
  patterns: [array-based-graphql-filtering]
key-files:
  modified:
    - model-catalog-api/src/service.ts
  created:
    - model-catalog-api/src/__tests__/service-type-filter.test.ts
decisions:
  - "Models endpoint returns all 6 subclass types via _in operator; subtype endpoints unchanged with _eq"
metrics:
  duration: "3 minutes"
  completed: "2026-03-27"
---

# Quick Task 260326-uar: Fix /models endpoint missing subtypes Summary

Array-based type filtering for /models endpoint using GraphQL _in operator to return all Model subclass types (Model, EmpiricalModel, CoupledModel, Emulator, HybridModel, Theory-GuidedModel).

## What Changed

### model-catalog-api/src/service.ts

1. **Exported `getSoftwareTypeFilter`** for testability.
2. **Changed return type** from `string | null` to `string | string[] | null`.
3. **`models` key now returns array** of all 6 Model subclass URIs instead of single `sdm#Model` string.
4. **`list()` method branches on filter type**: uses `_in` operator with `[String!]!` GraphQL type for arrays, keeps `_eq` with `String!` for single strings.

### model-catalog-api/src/__tests__/service-type-filter.test.ts (new)

9 unit tests covering:
- `models` returns 6-element array with all subclass URIs
- Each individual subtype endpoint returns single string
- Non-software resources (softwares, persons) return null

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `92b93dc` | test | Add failing tests for getSoftwareTypeFilter |
| `4c07525` | fix | Return all Model subclass types from /models endpoint |

## Verification

- All 46 tests pass (9 new + 37 existing)
- TypeScript compiles with no errors (`tsc --noEmit`)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- All key files verified on disk
- All commit hashes verified in git log
