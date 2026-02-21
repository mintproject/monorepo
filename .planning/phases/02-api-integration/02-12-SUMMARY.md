---
phase: 02-api-integration
plan: 12
subsystem: api
tags: [graphql, hasura, junction-tables, field-selections]

# Dependency graph
requires:
  - phase: 02-api-integration
    provides: custom-handlers.ts with field selection constants and inline queries

provides:
  - SETUP_FIELDS with correct Hasura columns and junction traversal for modelcatalog_model_configuration_setup
  - SOFTWARE_FIELDS with correct Hasura columns and junction traversal for modelcatalog_software
  - CONFIGURATION_FIELDS with correct Hasura columns and junction traversal for modelcatalog_model_configuration
  - All inline GraphQL queries in custom-handlers.ts fixed to use junction traversal patterns
affects: [03-fuseki-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Junction traversal: inputs { input { id label } } not inputs { id label } for all junction table relationships"
    - "datasetspecifications_get queries junction tables directly; relationship names are 'input'/'output' (not 'dataset_specification')"

key-files:
  created: []
  modified:
    - model-catalog-api/src/custom-handlers.ts
    - model-catalog-api/src/__tests__/integration.test.ts
    - model-catalog-api/src/mappers/__tests__/response.test.ts

key-decisions:
  - "SETUP_FIELDS: removed has_documentation/date_created/date_modified (non-existent columns); added actual scalar columns from field-maps.ts"
  - "SOFTWARE_FIELDS: removed date_modified (non-existent); kept has_documentation/date_created which DO exist on modelcatalog_software"
  - "CONFIGURATION_FIELDS: removed has_documentation/date_created/date_modified (all non-existent on modelcatalog_model_configuration)"
  - "custom_datasetspecifications_get: junction rows use 'input'/'output' relationship names, not 'dataset_specification'; JS extraction updated accordingly"
  - "Tests updated to use renamed API field keys (hasVersion, hasInput, hasParameter) from previous resource-registry rename"

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 2 Plan 12: Custom Handler GraphQL Field Selection Fix Summary

**Fixed SETUP_FIELDS, SOFTWARE_FIELDS, CONFIGURATION_FIELDS and all inline queries in custom-handlers.ts to use valid Hasura columns and junction traversal patterns matching field-maps.ts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-21T17:06:42Z
- **Completed:** 2026-02-21T17:10:36Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Replaced all three field selection constants with valid columns from field-maps.ts
- Fixed all junction table relationships to use nested traversal (`inputs { input { ... } }` not `inputs { id label }`)
- Fixed 6 inline GraphQL queries for intervention, region, variable, and datasetspecification handlers
- Updated test assertions to reflect API field key renames introduced by prior resource-registry changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite SETUP_FIELDS, SOFTWARE_FIELDS, and CONFIGURATION_FIELDS** - `2e26d72` (fix)

## Files Created/Modified
- `model-catalog-api/src/custom-handlers.ts` - Rewrote all three field selection constants and fixed all inline GraphQL queries
- `model-catalog-api/src/__tests__/integration.test.ts` - Updated assertions to use hasVersion/hasInput/hasParameter API keys
- `model-catalog-api/src/mappers/__tests__/response.test.ts` - Updated assertion to use hasVersion API key

## Decisions Made
- `date_modified` removed from all field selections - does not exist on any modelcatalog table
- `has_documentation` only valid on `modelcatalog_software` - removed from SETUP_FIELDS and CONFIGURATION_FIELDS
- `date_created` only valid on `modelcatalog_software` and `modelcatalog_software_version` - removed from SETUP_FIELDS and CONFIGURATION_FIELDS
- Junction traversal pattern applied consistently throughout: `relationship_name { target_entity { id label ... } }` for all junction relationships

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale test assertions for renamed API field keys**
- **Found during:** Task 1 (verification - running vitest)
- **Issue:** 3 tests failed because they checked `result['versions']`, `setup.inputs`, `setup.parameters` but the resource-registry had been updated in a prior plan to rename those API keys to `hasVersion`, `hasInput`, `hasParameter`
- **Fix:** Updated test assertions to use the new API field key names
- **Files modified:** `src/__tests__/integration.test.ts`, `src/mappers/__tests__/response.test.ts`
- **Verification:** All 32 tests pass
- **Committed in:** `2e26d72` (included in task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Test fix was necessary for verification to pass. The test assertions were stale from a prior plan's resource-registry changes. No scope creep.

## Issues Encountered
- TypeScript compiled cleanly on first attempt (no type errors)
- 3 pre-existing test failures discovered during verification - caused by resource-registry API key renames from a prior plan that left test assertions stale. Fixed inline per deviation Rule 1.

## Next Phase Readiness
- UAT issue 7 resolved: custom handlers now request only valid Hasura columns and use correct junction traversal
- `GET /v2.0.0/custom/modelconfigurationsetups/{id}` should no longer return Hasura field errors
- `GET /v2.0.0/custom/modelconfigurations/{id}` should return correct nested shapes
- `GET /v2.0.0/custom/model/index` should return models with correct nested relationship shapes
- Ready for Phase 3 (Fuseki Migration and Cleanup)

## Self-Check: PASSED
- SUMMARY.md exists at .planning/phases/02-api-integration/02-12-SUMMARY.md
- Commit 2e26d72 exists in model-catalog-api repo

---
*Phase: 02-api-integration*
*Completed: 2026-02-21*
