---
phase: 02-api-integration
plan: 09
subsystem: api
tags: [fastify, hasura, graphql, typescript, rest-api, model-catalog]

# Dependency graph
requires:
  - phase: 02-api-integration
    plan: 08
    provides: username param no-op (user_id filtering removed from service and custom handlers)
provides:
  - list() returns 200 [] for all 23 null-table resource types
  - getById() returns 404 for all 23 null-table resource types
  - write operations (create/update/delete) still return 501 for null-table resource types
  - datatransformations custom handler comment updated, no TODO remains
affects:
  - 02-VERIFICATION.md (closes the "all 46 resource types return 200" gap)
  - Phase 3 (Fuseki migration may add tables for some null-table types in future)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "null-table read: return empty results (not 501) to match v1.8.0 named-graph behavior"
    - "null-table write: keep 501 since there is genuinely no backing store"

key-files:
  created: []
  modified:
    - model-catalog-api/src/service.ts
    - model-catalog-api/src/custom-handlers.ts

key-decisions:
  - "null-table resource types return 200 [] for list and 404 for get-by-id (matches v1.8.0 behavior for empty named graphs)"
  - "write operations on null-table types continue returning 501 (no backing store, writes cannot proceed)"

patterns-established:
  - "hasuraTable null check: reads return empty/404, writes return 501"

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 02 Plan 09: Null-Table Resource Types Return Empty Read Responses Summary

**23 null-table resource types now return 200 [] for list and 404 for get-by-id instead of 501, matching v1.8.0 behavior for empty named graphs**

## Performance

- **Duration:** 69s
- **Started:** 2026-02-21T10:34:53Z
- **Completed:** 2026-02-21T10:36:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `list()` in service.ts returns `200 []` for resources where `hasuraTable` is null
- `getById()` in service.ts returns `404` for resources where `hasuraTable` is null
- Write operations (`create`, `update`, `deleteResource`) continue returning `501` for null-table types
- TODO comment removed from `custom_datasetspecifications_id_datatransformations_get` handler, replaced with accurate explanation
- All 32 existing tests pass unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Return empty read responses for null-table resource types** - `5dd0e62` (feat)
2. **Task 2: Clean up datatransformations TODO stub in custom-handlers.ts** - `6dcb570` (chore)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `model-catalog-api/src/service.ts` - Modified `list()` and `getById()` null-hasuraTable branches to return 200/404 instead of 501
- `model-catalog-api/src/custom-handlers.ts` - Comment-only: replaced TODO with accurate explanation about no PostgreSQL table

## Decisions Made
- null-table resource types return empty results for reads (not 501): matches v1.8.0 behavior where queries against empty named graphs return empty arrays
- write operations remain 501 for null-table types: correct because there is genuinely no backing store to write to
- TODO comment removal: the TODO implied future work within this phase, which was misleading; the actual situation (no table by design) needed a clear comment

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 46 API resource types now return HTTP 200 (not 501) for GET list requests
- All 46 API resource types now return 200 or 404 (not 501) for GET by-id requests
- Closes the "all 46 resource types" gap identified in 02-VERIFICATION.md
- Phase 2 verification gaps should now be substantially reduced
- Phase 3 (Fuseki Migration and Cleanup) can proceed

## Self-Check: PASSED

- service.ts: FOUND
- custom-handlers.ts: FOUND
- 02-09-SUMMARY.md: FOUND
- Commit 5dd0e62 (feat: empty read responses for null-table): FOUND
- Commit 6dcb570 (chore: datatransformations TODO removed): FOUND
- TypeScript: compiles with no errors
- Tests: 32/32 passing
- TODO grep in custom-handlers.ts: 0 matches

---
*Phase: 02-api-integration*
*Completed: 2026-02-21*
