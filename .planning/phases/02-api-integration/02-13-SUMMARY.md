---
phase: 02-api-integration
plan: 13
subsystem: api
tags: [graphql, hasura, custom-handlers, plain-uuid, id-resolution]

# Dependency graph
requires:
  - phase: 02-api-integration
    provides: plan 02-11 fullId prefix pattern in service.ts and resourceConfig.idPrefix
provides:
  - fullId prefix logic in all four custom _by_pk handlers
  - fullCfgId prefix logic in custom_datasetspecifications_get configurationid query param handler
  - 3 integration tests verifying custom handler plain-ID resolution
affects: [03-fuseki-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "startsWith('https://') guard before prepending idPrefix: same pattern as service.ts 02-11"
    - "mcConfig = getResourceConfig('modelconfigurations') for handlers that query modelcatalog_model_configuration but are registered under a different resource type"

key-files:
  created: []
  modified:
    - model-catalog-api/src/custom-handlers.ts
    - model-catalog-api/src/__tests__/integration.test.ts

key-decisions:
  - "Handler 4 (custom_configuration_id_inputs_get) uses mcConfig.idPrefix from modelconfigurations (not its own datasetspecifications resourceConfig) because the _by_pk query targets modelcatalog_model_configuration"
  - "Handler 5 (custom_datasetspecifications_get) uses mcConfig.idPrefix from modelconfigurations for configurationid query param since the filter is on model_configuration_id"

patterns-established:
  - "Plain ID expansion: id.startsWith('https://') ? id : resourceConfig.idPrefix + id"
  - "Cross-resource idPrefix: when handler's resourceConfig type differs from queried table, fetch the correct config explicitly"

# Metrics
duration: 1.5min
completed: 2026-02-21
---

# Phase 2 Plan 13: Custom Handler Plain-ID Resolution Summary

**fullId prefix pattern applied to all five custom handler locations so plain UUIDs/short names are expanded to full URIs before Hasura _by_pk and configurationid filter queries**

## Performance

- **Duration:** ~88 seconds
- **Started:** 2026-02-21T17:42:49Z
- **Completed:** 2026-02-21T17:44:17Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Applied fullId prefix logic to all four custom _by_pk path-param handlers (configurationsetups, modelconfigurationsetups, modelconfigurations, configuration inputs)
- Applied fullCfgId prefix logic to configurationid query param in custom_datasetspecifications_get
- Added 3 integration tests verifying plain-ID expansion and full-URI passthrough
- All 36 tests pass; TypeScript compiles cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fullId prefix logic to all five custom handler locations** - `34627e8` (feat)
2. **Task 2: Add integration tests for custom handler plain-ID resolution** - `b78f752` (test)

## Files Created/Modified
- `model-catalog-api/src/custom-handlers.ts` - Added fullId/fullCfgId prefix logic in 5 handler locations
- `model-catalog-api/src/__tests__/integration.test.ts` - Added Test 10 describe block with 3 new tests

## Decisions Made
- Handler 4 uses `mcConfig = getResourceConfig('modelconfigurations')` to get the correct idPrefix, since the handler is registered as a datasetspecifications resource but the path-param filters against the modelcatalog_model_configuration table
- Handler 5 (configurationid query param) similarly uses mcConfig from modelconfigurations because the filter field model_configuration_id is a modelconfigurations primary key

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All five custom handler locations now expand plain IDs to full URIs before Hasura queries
- Phase 2 Truth 4 gap fully closed: plain UUIDs and short names resolve correctly in both generic service.ts and all custom handlers
- Phase 3 (Fuseki Migration) can proceed with full confidence that ID resolution works end-to-end

## Self-Check: PASSED

- FOUND: model-catalog-api/src/custom-handlers.ts
- FOUND: model-catalog-api/src/__tests__/integration.test.ts
- FOUND: .planning/phases/02-api-integration/02-13-SUMMARY.md
- FOUND commit 34627e8 (Task 1: feat)
- FOUND commit b78f752 (Task 2: test)
- 36 tests pass, TypeScript compiles cleanly

---
*Phase: 02-api-integration*
*Completed: 2026-02-21*
