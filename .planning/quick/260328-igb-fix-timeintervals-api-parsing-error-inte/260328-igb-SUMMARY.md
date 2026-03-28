---
phase: quick-260328-igb
plan: 01
subsystem: model-catalog-api
tags: [bugfix, api, parsing, timeintervals, hasura]
dependency_graph:
  requires: []
  provides: [FIX-TIMEINTERVAL-PARSE]
  affects: [model-catalog-api/src/mappers/request.ts]
tech_stack:
  added: []
  patterns: [TDD red-green, object sanitization guard]
key_files:
  created:
    - model-catalog-api/src/__tests__/request-mapper.test.ts
  modified:
    - model-catalog-api/src/mappers/request.ts
decisions:
  - Reject non-primitive (object) values in unwrapValue rather than letting them pass to Hasura
  - Filter objects from multi-element arrays rather than rejecting the entire array
metrics:
  duration: 4 minutes
  completed: 2026-03-28
  tasks_completed: 2
  files_changed: 2
---

# Phase quick-260328-igb Plan 01: Fix TimeIntervals API Parsing Error Summary

**One-liner:** Patched `unwrapValue` to reject object values like `[{}]` before they reach Hasura Text columns, preventing the 500 "parsing Text failed" error on POST /timeintervals.

## What Was Done

Fixed a bug in `model-catalog-api/src/mappers/request.ts` where the `unwrapValue` function would unwrap `[{}]` to `{}` and pass the empty object to Hasura for storage in a Text column. Hasura cannot coerce an Object to String, causing a 500 error.

The fix adds a type guard after unwrapping: if the resulting value is a non-null object (not a primitive), it is treated as null and omitted from the Hasura input. This covers the exact failure case (`intervalUnit:[{}]`) and generalizes to any scalar column receiving an object value.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add failing tests (RED) | 99b8d57 | model-catalog-api/src/__tests__/request-mapper.test.ts |
| 2 | Fix unwrapValue (GREEN) | 947426b | model-catalog-api/src/mappers/request.ts |

## Test Results

- 8 new tests added in `request-mapper.test.ts` covering:
  - `intervalUnit:[{}]` -> field omitted
  - `intervalUnit:[{nested}]` -> field omitted
  - `intervalUnit:["seconds"]` -> `interval_unit: "seconds"` preserved
  - `intervalUnit:[]` -> field omitted
  - Full request body matching the bug report
  - Full valid request body
- All 76 tests pass (5 test files)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- model-catalog-api/src/__tests__/request-mapper.test.ts: FOUND
- model-catalog-api/src/mappers/request.ts: FOUND (modified)
- Commits 99b8d57 and 947426b verified in submodule git log
