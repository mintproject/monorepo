---
phase: quick-260326-vn8
plan: 01
subsystem: api
tags: [model-catalog-api, hasura, graphql, type-uri, resource-registry]

requires: []
provides:
  - Default type URI assignment in POST /resources create method for all resource types
affects: [model-catalog-api, hasura-mutations, post-endpoints]

tech-stack:
  added: []
  patterns:
    - "Service layer sets input['type'] = resourceConfig.typeUri after toHasuraInput, ensuring canonical type URI is always stored"

key-files:
  created: []
  modified:
    - model-catalog-api/src/service.ts
    - model-catalog-api/src/mappers/__tests__/request.test.ts

key-decisions:
  - "Type defaulting belongs in the service layer (service.ts), not in toHasuraInput, because service.ts has access to resourceConfig"
  - "toHasuraInput correctly strips the type field from the request body (short name like 'Model'), and the service layer assigns the full URI"

patterns-established:
  - "Pattern: After toHasuraInput, always assign input['type'] = resourceConfig.typeUri in create()"

requirements-completed: [DEFAULT-TYPE]

duration: 5min
completed: 2026-03-26
---

# Quick Task 260326-vn8: Default Model Type Summary

**POST /resources create method now always writes the canonical type URI from resourceConfig.typeUri, fixing rows created with no type column value**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-26T22:51:00Z
- **Completed:** 2026-03-26T22:56:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `input['type'] = resourceConfig.typeUri` in `service.ts` create method after `toHasuraInput` returns
- All resource types (models, empiricalmodels, softwareversions, etc.) now have the canonical type URI stored on create
- Added 5 new tests in `request.test.ts` documenting the default type assignment contract
- Full test suite (61 tests across 4 test files) passes; TypeScript compiles cleanly

## Task Commits

1. **Task 1: Default type column to resourceConfig.typeUri in create method** - `9680fd8` (feat)
2. **Task 2: Full build and test suite verification** - no code changes, verification only

## Files Created/Modified

- `model-catalog-api/src/service.ts` - Added `input['type'] = resourceConfig.typeUri` in create() after toHasuraInput
- `model-catalog-api/src/mappers/__tests__/request.test.ts` - Added "default type assignment" test suite documenting the contract

## Decisions Made

- Type defaulting placed in service.ts (not toHasuraInput) because the service layer owns the resourceConfig and the full URI assignment
- Tests written in request.test.ts as contract documentation rather than mocking the full Hasura service layer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The `model-catalog-api` directory is a standalone nested git repository inside the monorepo (has its own `.git`). Commits were made directly inside `model-catalog-api` repo on its `main` branch.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All POST resource creation endpoints now write the canonical type URI to the database
- The fix is complete for all 46 resource types covered by the resource registry
- No follow-up work required for this task

---
*Phase: quick-260326-vn8*
*Completed: 2026-03-26*
