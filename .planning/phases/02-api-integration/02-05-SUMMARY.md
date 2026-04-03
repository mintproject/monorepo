---
phase: 02-api-integration
plan: 05
subsystem: api
tags: [graphql, hasura, field-maps, vitest, typescript, junction-tables, response-mapper]

# Dependency graph
requires:
  - plan: 02-03
    provides: Resource registry with RelationshipConfig and response/request mappers
  - plan: 02-04
    provides: Generic CRUD service using dynamic GraphQL queries

provides:
  - FIELD_SELECTIONS: Record<string, string> with precise GraphQL field selection strings for all 16 entity tables
  - getFieldSelection(tableName): string helper with fallback to 'id label'
  - service.ts updated to use getFieldSelection for all list/getById/update queries
  - 8 integration tests validating full pipeline (mock Apollo Client, vi.hoisted)
  - junctionRelName added to RelationshipConfig for junction table traversal in response mapper
  - response.ts updated to traverse junction rows via junctionRelName

affects: [02-06, 02-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 14: field-maps.ts derives field selections from tables.yaml metadata (hardcoded at build time)"
    - "Pattern 15: junctionRelName on RelationshipConfig tells mapper which key inside junction row holds the target entity"
    - "Pattern 16: vi.hoisted() required for vitest mocks that reference module-level variables"
    - "Pattern 17: Integration tests use vi.mock to replace Apollo Client with controlled mock returns"

key-files:
  created:
    - /Users/mosorio/repos/model-catalog-api/src/hasura/field-maps.ts
    - /Users/mosorio/repos/model-catalog-api/src/__tests__/integration.test.ts
  modified:
    - /Users/mosorio/repos/model-catalog-api/src/service.ts
    - /Users/mosorio/repos/model-catalog-api/src/mappers/resource-registry.ts
    - /Users/mosorio/repos/model-catalog-api/src/mappers/response.ts

key-decisions:
  - "No user_id column exists in any modelcatalog table - the schema uses author_id; user_id filtering in service.ts targets a non-existent column (will be a runtime no-op or error)"
  - "junctionRelName field added to RelationshipConfig; all 14 junction relationships updated; response mapper now traverses junction rows correctly"
  - "Integration test field names match resource registry keys (versions not hasVersion, inputs not hasInput) since mapper outputs registry keys"
  - "Junction table diagram_parts has no junctionRelName (polymorphic: part_id, part_type directly in junction row)"

# Metrics
duration: 11min
completed: 2026-02-21
---

# Phase 2 Plan 05: GraphQL Field Selections and Integration Tests Summary

**Complete GraphQL field selection maps for all 16 modelcatalog entity tables derived from tables.yaml metadata, junction table traversal via junctionRelName in response mapper, and 8 integration tests validating the full request-to-response pipeline**

## Performance

- **Duration:** 10 min 57s
- **Started:** 2026-02-21T12:02:07Z
- **Completed:** 2026-02-21T12:13:04Z
- **Tasks:** 2
- **Files created/modified:** 5

## Accomplishments

- Created `FIELD_SELECTIONS` in `field-maps.ts` covering all 16 entity tables: 4 hierarchy tables (software, software_version, model_configuration, model_configuration_setup), 2 I/O tables (dataset_specification, parameter), and 10 reference tables (person, model_category, region, process, time_interval, causal_diagram, image, variable_presentation, intervention, grid)
- Field selections include all scalar columns from tables.yaml `select_permissions`, object relationships (`{ id label }`), and junction table traversals (`authors { person { id label } }`, `inputs { input { ... } }`)
- Updated `service.ts` to use `getFieldSelection(resourceConfig.hasuraTable!)` in `list()`, `getById()`, and `update()` methods; removed the placeholder `buildFieldSelection()` function
- Added `junctionRelName` to `RelationshipConfig` interface and populated it for all 14 junction relationships; updated `response.ts` to extract the nested target entity from junction rows when `junctionRelName` is set
- Created 8 integration tests using `vi.hoisted()` to mock Apollo Client, validating: response format (array wrapping, type synthesis, null omission), junction traversal, pagination (offset/limit), label filter, username filter, and URI-encoded ID decoding

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate GraphQL field selection maps from Hasura metadata** - `cf78104` (feat)
2. **Task 2: Wire field maps into service and create integration tests** - `9db2867` (feat)

**Plan metadata:** committed with SUMMARY.md

## Files Created/Modified

- `/Users/mosorio/repos/model-catalog-api/src/hasura/field-maps.ts` - FIELD_SELECTIONS for all 16 entity tables with complete scalar+relationship field lists; getFieldSelection() helper
- `/Users/mosorio/repos/model-catalog-api/src/__tests__/integration.test.ts` - 8 integration tests covering the full service->mapper->response pipeline with mocked Apollo Client
- `/Users/mosorio/repos/model-catalog-api/src/service.ts` - Replaced buildFieldSelection() with getFieldSelection() import; removed RESOURCE_REGISTRY/ResourceConfig imports
- `/Users/mosorio/repos/model-catalog-api/src/mappers/resource-registry.ts` - Added junctionRelName to RelationshipConfig interface; populated junctionRelName on all 14 junction relationships
- `/Users/mosorio/repos/model-catalog-api/src/mappers/response.ts` - Updated array relationship handling to traverse junction rows via junctionRelName when set

## Decisions Made

- **No user_id column in modelcatalog tables**: The SQL schema uses `author_id` (FK to person) for author attribution. There is no `user_id` column in any modelcatalog table. The service.ts `user_id: { _eq: $username }` WHERE clause was already implemented in plan 04 and will be a Hasura error at runtime when username filtering is requested. The plan said to include `user_id` "for entity tables that have it" - since no tables have it, field selections do not include it.

- **junctionRelName for junction traversal**: When Hasura returns `inputs: [{ input: { id, label } }]` (junction rows), the response mapper previously tried to transform each `{ input: {...} }` as a DatasetSpecification row, which has no `id` at the top level. Adding `junctionRelName: 'input'` tells the mapper to extract `item['input']` before calling transformRow. This is the correct behavior for all 14 junction relationships.

- **vi.hoisted() required in vitest**: The `vi.mock()` factory is hoisted to the top of the file by vitest, but `const mockQuery = vi.fn()` declarations are not hoisted (temporal dead zone). Using `vi.hoisted(() => ({ mockQuery: vi.fn(), mockMutate: vi.fn() }))` creates the mocks during hoist time, making them accessible in the mock factory.

- **Response field names match registry keys**: The response mapper outputs `apiFieldName` (the key in `ResourceConfig.relationships`) as the field name. The test expects `sw.versions` not `sw.hasVersion`, `setup.inputs` not `setup.hasInput`. The registry keys were chosen in plan 03 to match camelCase API names.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type errors in pre-existing untracked custom-handlers.ts**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** `custom-handlers.ts` was already present as an untracked file (created anticipating plan 06). It accessed `result.data?.modelcatalog_software` but Apollo Client v4 types `result.data` as `{}` (empty object), causing 13 TypeScript errors.
- **Fix:** Changed all `result.data?.{property}` accesses to `const data = result.data as Record<string, unknown>; data['{property}']`
- **Files modified:** `src/custom-handlers.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** cf78104 (Task 1 commit, bundled with field-maps.ts)

**2. [Rule 1 - Bug] Junction table relationships not traversed by response mapper**
- **Found during:** Task 2 (integration test failures)
- **Issue:** The response mapper processed `inputs: [{ input: { id, label } }]` as an array of DatasetSpecification rows. Each junction row `{ input: {...} }` has no top-level `id`, so `transformRow` produced `{ type: ['DatasetSpecification'] }` with no id/label.
- **Fix:** Added `junctionRelName` to RelationshipConfig; response mapper now extracts `item[junctionRelName]` before calling transformRow when `junctionRelName` is set and exists in the row.
- **Files modified:** `src/mappers/resource-registry.ts` (interface + 14 relationships), `src/mappers/response.ts` (junction traversal logic)
- **Verification:** All 32 tests pass (24 existing + 8 new)
- **Committed in:** 9db2867 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes were necessary for correctness. The TypeScript fix was pre-existing in an untracked file. The junction traversal fix corrects a fundamental data extraction error that would have returned empty/wrong responses for all junction-based relationships.

## Issues Encountered

- The `user_id` column mentioned in plan notes does not exist in the Hasura schema. The service.ts WHERE clause `user_id: { _eq: $username }` will produce a Hasura error at runtime when username filtering is used. This needs to be addressed in plan 06 or 07, or when the schema is updated to add user_id to entity tables.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Field selection maps are complete; all 16 entity tables return their full field set in responses
- Junction table traversal works correctly in the response mapper
- 32 tests pass (8 integration + 24 unit) confirming the pipeline
- The `user_id` username filtering concern needs resolution (column doesn't exist in schema)
- Plans 06 and 07 can build on this complete read pipeline

## Self-Check: PASSED

- FOUND: /Users/mosorio/repos/model-catalog-api/src/hasura/field-maps.ts
- FOUND: /Users/mosorio/repos/model-catalog-api/src/__tests__/integration.test.ts
- FOUND: /Users/mosorio/repos/model-catalog-api/src/service.ts (modified)
- FOUND: /Users/mosorio/repos/model-catalog-api/src/mappers/resource-registry.ts (modified)
- FOUND: /Users/mosorio/repos/model-catalog-api/src/mappers/response.ts (modified)
- FOUND: /Users/mosorio/repos/mint/.planning/phases/02-api-integration/02-05-SUMMARY.md
- Commit cf78104 verified: feat(02-05): generate GraphQL field selection maps
- Commit 9db2867 verified: feat(02-05): wire field maps into service and add integration tests
- All 32 tests pass: npx vitest run (2 test files, 32 tests)
- TypeScript compiles cleanly: npx tsc --noEmit passes
- 16 entity tables in FIELD_SELECTIONS verified

---
*Phase: 02-api-integration*
*Completed: 2026-02-21*
