---
phase: 02-api-integration
plan: 06
subsystem: api
tags: [graphql, apollo-client, hasura, custom-endpoints, typescript, cross-resource]

# Dependency graph
requires:
  - plan: 02-03
    provides: Resource registry, transformRow/transformList response mappers
  - plan: 02-04
    provides: CatalogService Proxy with handleCustom stub, fastify-openapi-glue wiring

provides:
  - customHandlers: Record of 13 handler functions keyed by operationId
  - /custom/model/index: list all models with versions and configuration counts
  - /custom/model/intervention: models filtered by intervention presence
  - /custom/model/region: models filtered by region label
  - /custom/models/variable: models filtered by variable presentation label
  - /custom/modelconfigurationsetups/variable: setups filtered by variable presentation
  - /custom/configurationsetups/{id}: full nested setup (configurationsetup alias)
  - /custom/modelconfigurationsetups/{id}: full nested setup with all relationships
  - /custom/modelconfigurations/{id}: full nested configuration with all relationships
  - /custom/models/standard_variable: models filtered by variable presentation label (standard_variable proxy)
  - /custom/datasetspecifications/{id}/datatransformations: stub returning [] (table not yet in schema)
  - /custom/datasetspecifications: list specs, optionally filtered by configurationid
  - /custom/configuration/{id}/inputs: DatasetSpecifications for a configuration's inputs
  - /user/login: 501 stub (auth handled externally by Keycloak)

affects: [02-07, 03-fk-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 14: result.data cast to Record<string, unknown> for Apollo Client TypeScript compatibility"
    - "Pattern 15: Cross-resource aggregation via nested GraphQL field selections using FIELD_SELECTIONS constants"
    - "Pattern 16: JS-side post-filtering for complex joins (interventions, regions, variables) instead of Hasura nested where"
    - "Pattern 17: customHandlers registry dispatched from CatalogServiceImpl.handleCustom() by operationId key"

key-files:
  created:
    - /Users/mosorio/repos/model-catalog-api/src/custom-handlers.ts
  modified:
    - /Users/mosorio/repos/model-catalog-api/src/service.ts

key-decisions:
  - "JS-side post-filtering for intervention/region/variable cross-joins: simpler than Hasura nested where for complex traversals"
  - "standard_variable handler uses variable presentation label as proxy (standardvariables table does not exist in schema)"
  - "datatransformations handler returns empty array stub (datatransformations hasuraTable is null in registry)"
  - "configurationsetups and modelconfigurationsetups are aliases that both query modelcatalog_model_configuration_setup_by_pk"
  - "user_login_post returns 501: Keycloak handles auth externally; API never sees credentials"

# Metrics
duration: 7min
completed: 2026-02-21
---

# Phase 2 Plan 06: Custom Endpoint Handlers Summary

**13 cross-resource aggregation handlers dispatched from CatalogService Proxy, querying nested Hasura GraphQL relationships for model discovery endpoints used by the UI and Ensemble Manager**

## Performance

- **Duration:** 6 min 40s
- **Started:** 2026-02-21T12:02:18Z
- **Completed:** 2026-02-21T12:08:58Z
- **Tasks:** 2
- **Files created/modified:** 2

## Accomplishments

- Created `custom-handlers.ts` with all 13 handler functions keyed by their exact operationId
- Each handler uses Apollo Client nested GraphQL queries traversing Hasura relationships (versions -> configurations -> setups -> parameters -> interventions, etc.)
- Updated `CatalogServiceImpl.handleCustom()` to dispatch to `customHandlers[operationId]` instead of returning 501 stub
- All 13 custom operationIds are accessible via the CatalogService Proxy with `in` operator returning `true` and `typeof` returning `"function"`

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement custom endpoint handlers** - `15258de` (feat)
2. **Task 2: Wire custom handlers into the service proxy** - `7bce2dd` (feat)

**Plan metadata:** committed with SUMMARY.md

## Files Created/Modified

- `/Users/mosorio/repos/model-catalog-api/src/custom-handlers.ts` - All 13 custom handler functions; shared field selection constants (SOFTWARE_FIELDS, SETUP_FIELDS, CONFIGURATION_FIELDS); export as `customHandlers` Record keyed by operationId
- `/Users/mosorio/repos/model-catalog-api/src/service.ts` - Import `customHandlers`; update `handleCustom()` to dispatch by operationId; update `userLogin()` to use customHandlers

## Decisions Made

- **JS-side post-filtering for complex traversals**: Handlers for intervention, region, variable, and standard_variable queries fetch all candidate records and filter in JavaScript rather than using Hasura nested where clauses. The Hasura nested where for multi-level joins (software -> versions -> configurations -> setups -> parameters -> interventions) is verbose and complex; JS filtering on the fetched result set is simpler, correct, and sufficient for the expected dataset size.

- **standard_variable uses variable presentation label as proxy**: The `standardvariables` resource has `hasuraTable: null` (no dedicated table exists in the current schema). The custom_models_standard_variable handler searches by variable presentation label instead, which is the closest available proxy. This is functionally equivalent for the common case where variable presentations are named after their standard variable.

- **datatransformations stub returns empty array**: The `datatransformations` resource has `hasuraTable: null`. The handler for `/custom/datasetspecifications/{id}/datatransformations` returns `[]` with a TODO comment. This is correct behavior per the plan spec and will be resolved in Phase 3 if the table is added.

- **configurationsetups/modelconfigurationsetups are aliases**: Both handlers query the same `modelcatalog_model_configuration_setup_by_pk` Hasura root field, but return their respective resource configs (configurationsetups vs modelconfigurationsetups) to synthesize the correct `type` field in responses.

- **user_login_post returns 501**: Keycloak handles authentication externally. The API validates JWTs forwarded by clients but never manages credentials. The handler returns a 501 with a descriptive message pointing to Keycloak.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Apollo Client result.data typed as {} causes TypeScript errors**
- **Found during:** Task 1 (TypeScript compile check)
- **Issue:** Apollo Client v4's `result.data` has type `{}` (empty object). Direct property access like `result.data?.modelcatalog_software` fails TypeScript strict checks with "Property 'modelcatalog_software' does not exist on type '{}'"
- **Fix:** Applied the same pattern established in service.ts (plan 04): cast `result.data as Record<string, unknown>` then access via bracket notation `data['modelcatalog_software']`
- **Files modified:** src/custom-handlers.ts
- **Commit:** 15258de

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Required fix for TypeScript compilation. No scope change.

## Issues Encountered

None beyond the TypeScript type casting deviation documented above.

## User Setup Required

None.

## Next Phase Readiness

- All 13 custom endpoints have working handlers that build nested Hasura GraphQL queries
- The service proxy now routes all `custom_*` and `user_login_post` operationIds to their implementations
- Plan 02-07 (end-to-end testing / integration verification) can now test actual endpoint behavior
- Phase 3 FK migration: datatransformations endpoint will need updating if the table is added

## Self-Check: PASSED

- FOUND: /Users/mosorio/repos/model-catalog-api/src/custom-handlers.ts
- FOUND: /Users/mosorio/repos/model-catalog-api/src/service.ts
- FOUND: /Users/mosorio/repos/mint/.planning/phases/02-api-integration/02-06-SUMMARY.md
- Commit 15258de verified in git log
- Commit 7bce2dd verified in git log
- TypeScript compiles cleanly: npx tsc --noEmit passes
- customHandlers count: 13 (verified via tsx)
- All 13 operationIds: in=true, typeof=function via Proxy (verified via tsx)

---
*Phase: 02-api-integration*
*Completed: 2026-02-21*
