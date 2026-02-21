---
phase: 02-api-integration
plan: 03
subsystem: api
tags: [mappers, response-transform, request-transform, resource-registry, vitest, typescript]

# Dependency graph
requires:
  - phase: 01-schema-and-data-migration
    provides: Hasura schema with modelcatalog tables and relationship metadata
  - plan: 02-02
    provides: Project scaffold with TypeScript, Fastify, ESM module setup
provides:
  - Resource registry (RESOURCE_REGISTRY) mapping all 46 API resource types to Hasura metadata
  - response.ts: transformRow() and transformList() for Hasura row -> v1.8.0 JSON
  - request.ts: toHasuraInput() for v1.8.0 request body -> Hasura mutation input
  - 24 passing tests covering all transformation rules
affects: [02-04, 02-05, 02-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 4: scalar values wrapped in single-element arrays in responses (v1.8.0 contract)"
    - "Pattern 5: id field is NOT array-wrapped -- it stays as URI string"
    - "Pattern 6: type field synthesized from resourceConfig.typeArray (not stored in Hasura)"
    - "Pattern 7: null/undefined fields omitted entirely from responses"
    - "Pattern 8: snake_case <-> camelCase conversion at mapper boundary"
    - "Pattern 9: object_relationships array-wrapped as [nested_obj]; array_relationships as [obj1, obj2]"

key-files:
  created:
    - /Users/mosorio/repos/model-catalog-api/src/mappers/resource-registry.ts
    - /Users/mosorio/repos/model-catalog-api/src/mappers/response.ts
    - /Users/mosorio/repos/model-catalog-api/src/mappers/request.ts
    - /Users/mosorio/repos/model-catalog-api/src/mappers/__tests__/response.test.ts
  modified: []

key-decisions:
  - "Object relationships (single related object) are also array-wrapped in v1.8.0: author becomes [{id, type, ...}]"
  - "23 of 46 API types have null hasuraTable -- they need views or alternative query strategies in future plans"
  - "6 software subtypes (models, emulators, hybridmodels, etc.) share modelcatalog_software table with type discriminator"
  - "configurationsetups is an alias for modelconfigurationsetups (same Hasura table, different type URI)"
  - "Relationship fields are skipped in toHasuraInput -- caller handles FK extraction from nested objects"
  - "Recursion depth guard of 2 prevents infinite nesting when relationships reference circular types"

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 2 Plan 03: Response/Request Mappers and Resource Registry Summary

**Resource registry covering all 46 API types, bidirectional Hasura data transformers (row->v1.8.0 and v1.8.0->Hasura input), and 24 passing vitest tests**

## Performance

- **Duration:** 3min 54s
- **Started:** 2026-02-21T11:34:45Z
- **Completed:** 2026-02-21T11:38:39Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `RESOURCE_REGISTRY` with all 46 API resource types, their Hasura table names, OWL type URIs, type arrays, and relationship configs (Hasura rel names, object/array type, junction table names, target resource)
- Built `transformRow()` and `transformList()` in `response.ts` implementing the complete v1.8.0 transform: array wrapping, null omission, type synthesis, camelCase conversion, recursive nested object handling
- Built `toHasuraInput()` in `request.ts` as the inverse: array unwrapping, snake_case conversion, type field omission, relationship field skipping
- 24 tests covering all rules: scalar wrapping, null omission, camelCase/snake_case conversion, nested object/array relationships, round-trip fidelity, empty array/null relationship handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create resource registry mapping all 46 API types to Hasura tables** - `493214d` (feat)
2. **Task 2: Create response and request mappers with tests** - `34787ec` (feat)

**Plan metadata:** committed with SUMMARY.md

## Files Created/Modified

- `/Users/mosorio/repos/model-catalog-api/src/mappers/resource-registry.ts` - 46-entry registry with ResourceConfig and RelationshipConfig interfaces; getResourceConfig() and getResourceByTable() helpers
- `/Users/mosorio/repos/model-catalog-api/src/mappers/response.ts` - transformRow() and transformList() with snakeToCamel() utility
- `/Users/mosorio/repos/model-catalog-api/src/mappers/request.ts` - toHasuraInput() with camelToSnake() utility
- `/Users/mosorio/repos/model-catalog-api/src/mappers/__tests__/response.test.ts` - 24 tests covering all transform rules and round-trip behavior

## Decisions Made

- **Object relationships wrapped in arrays**: The v1.8.0 contract wraps even single related objects in arrays. An `author` object_relationship becomes `[{id, type, label: [...]}]`, not a bare object. This is confirmed by live API inspection patterns documented in 02-RESEARCH.md.

- **23 types without dedicated tables**: `catalogidentifiers`, `constraints`, `datatransformations`, `datatransformationsetups`, `equations`, `fundinginformations`, `geocoordinatess`, `geoshapes`, `numericalindexs`, `organizations`, `pointbasedgrids`, `samplecollections`, `sampleexecutions`, `sampleresources`, `softwareconfigurations`, `softwareimages`, `sourcecodes`, `spatialresolutions`, `spatiallydistributedgrids`, `standardvariables`, `units`, `variables`, `visualizations` have `hasuraTable: null`. Plan 04 or 05 will need to decide on view-based or skip strategy for these.

- **Software subtypes share table**: `models`, `emulators`, `hybridmodels`, `coupledmodels`, `empiricalmodels`, `theory-guidedmodels` all map to `modelcatalog_software`. Service handlers will need to add type discriminator filters when querying these sub-endpoints.

- **Relationship fields skipped in toHasuraInput**: The request mapper skips camelCase relationship field names (as defined in resourceConfig.relationships). The caller (service handler) is responsible for extracting IDs from nested objects and handling FK column updates. This keeps the mapper simple and single-responsibility.

- **Depth guard at 2**: `transformRow` accepts a `depth` parameter (default 0) and stops recursing at depth 2. This prevents stack overflow for circular relationship types while still supporting two levels of nesting (common in ModelConfigurationSetup -> ModelConfiguration -> SoftwareVersion queries).

## Deviations from Plan

None - plan executed exactly as written. All transformation rules, mapper signatures, and test cases matched the plan spec. TypeScript compiles cleanly with strict mode.

## Issues Encountered

None beyond the design decisions documented above.

## User Setup Required

None.

## Next Phase Readiness

- Mapper layer is complete; plan 04 (service handlers) can import `transformRow`, `transformList`, `toHasuraInput`, and `RESOURCE_REGISTRY` directly
- Resource registry provides all Hasura table names needed for plan 04's GraphQL query construction
- 23 null-table resources need a strategy decision when implementing their service handlers in plan 04/05

## Self-Check: PASSED

- FOUND: /Users/mosorio/repos/model-catalog-api/src/mappers/resource-registry.ts
- FOUND: /Users/mosorio/repos/model-catalog-api/src/mappers/response.ts
- FOUND: /Users/mosorio/repos/model-catalog-api/src/mappers/request.ts
- FOUND: /Users/mosorio/repos/model-catalog-api/src/mappers/__tests__/response.test.ts
- FOUND: /Users/mosorio/repos/mint/.planning/phases/02-api-integration/02-03-SUMMARY.md
- Commit 493214d verified in git log
- Commit 34787ec verified in git log
- All 24 tests pass (npx vitest run)
- TypeScript compiles cleanly (npx tsc --noEmit)

---
*Phase: 02-api-integration*
*Completed: 2026-02-21*
