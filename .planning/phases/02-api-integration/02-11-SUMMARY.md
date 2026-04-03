---
phase: 02-api-integration
plan: 11
subsystem: api
tags: [typescript, hasura, graphql, owl, resource-registry, vitest]

requires:
  - phase: 02-api-integration
    provides: resource-registry with relationship configs, service.ts generic CRUD handlers

provides:
  - v1.8.0 OWL property names as relationship keys in resource-registry.ts (hasVersion, hasInput, hasOutput, hasParameter, hasSetup, hasConfiguration, etc.)
  - ID prefix prepending for plain UUIDs in getById, update, deleteResource
  - Updated tests validating v1.8.0 key names and plain-ID resolution

affects: [03-fuseki-migration, UAT-issue-3, UAT-issue-4]

tech-stack:
  added: []
  patterns:
    - "Registry key = API output field name (OWL property name); hasuraRelName = Hasura internal field"
    - "fullId = id.startsWith('https://') ? id : idPrefix + id for plain UUID resolution"

key-files:
  created: []
  modified:
    - model-catalog-api/src/mappers/resource-registry.ts
    - model-catalog-api/src/service.ts
    - model-catalog-api/src/mappers/__tests__/response.test.ts
    - model-catalog-api/src/__tests__/integration.test.ts

key-decisions:
  - "Registry keys are the API output field names (OWL v1.8.0 property names); hasuraRelName stays as internal Hasura relationship name"
  - "Plain UUID IDs are accepted in getById/update/delete by prepending resourceConfig.idPrefix; full URIs pass through unchanged"
  - "deleteResource returns deleted: fullId (not deleted: id) so caller sees the resolved full URI"

patterns-established:
  - "OWL property name mapping: apiFieldName (registry key) drives output JSON key; hasuraRelName drives Hasura query field"

duration: 4min
completed: 2026-02-21
---

# Phase 02 Plan 11: v1.8.0 Relationship Field Names and Plain UUID ID Resolution Summary

**Corrected API response field names to match v1.8.0 OWL properties (hasVersion, hasInput, hasSetup, etc.) and added ID_PREFIX prepending so plain UUID lookups resolve correctly in getById, update, and deleteResource.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-21T19:06:48Z
- **Completed:** 2026-02-21T19:11:08Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Renamed 25+ relationship registry keys across 12 resource types to v1.8.0 OWL property names (hasVersion, hasConfiguration, hasInput, hasOutput, hasParameter, hasSetup, hasModelCategory, hasProcess, hasGrid, hasExplanationDiagram, hasInputVariable, hasOutputVariable, hasCausalDiagram, hasOutputTimeInterval, hasRegion, calibratedVariable, calibrationTargetVariable, hasPart, hasIntervention)
- Added `fullId` logic in getById, update (mutation + re-fetch), and deleteResource so plain UUIDs are expanded to full URIs before querying Hasura
- Updated response.test.ts and integration.test.ts to use new v1.8.0 key names; added Test 9 verifying plain-ID prefix prepending

## Task Commits

1. **Task 1: Rename relationship keys to v1.8.0 OWL property names** - `a385f14` (feat)
2. **Task 2: Prepend ID_PREFIX for plain IDs in getById, update, deleteResource** - `4f88031` (feat)
3. **Task 3: Update tests for renamed keys and add plain-ID integration test** - `aab147b` (test)

## Files Created/Modified

- `model-catalog-api/src/mappers/resource-registry.ts` - 34 relationship key renames across softwares, softwareversions, modelconfigurations, modelconfigurationsetups, configurationsetups, causaldiagrams, parameters, and all software subtypes
- `model-catalog-api/src/service.ts` - fullId = id.startsWith('https://') ? id : idPrefix + id in getById, update, deleteResource
- `model-catalog-api/src/mappers/__tests__/response.test.ts` - Updated versions assertions to hasVersion; fixed empty-array property name check
- `model-catalog-api/src/__tests__/integration.test.ts` - Updated sw.versions -> sw.hasVersion, setup.inputs -> setup.hasInput, setup.parameters -> setup.hasParameter; added Test 9 plain-ID test

## Decisions Made

- Registry keys are the API output field names (OWL v1.8.0 property names); hasuraRelName stays as internal Hasura relationship name. This separation ensures the mapper correctly translates Hasura snake_case field names to OWL property names in the JSON response.
- Plain UUID IDs are accepted in getById/update/delete by prepending `resourceConfig.idPrefix`; full URIs (starting with `https://`) pass through unchanged. This makes both `GET /softwares/plain-uuid` and `GET /softwares/https%3A%2F%2F...full-uri` work correctly.
- `deleteResource` returns `deleted: fullId` (not `deleted: id`) so the caller sees the resolved full URI, not the bare UUID.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The linter in the model-catalog-api repo automatically updated response.test.ts and integration.test.ts (updating `sw.versions` to `sw.hasVersion` and `setup.inputs` to `setup.hasInput`) concurrently with edit operations. The file changes were valid and consistent with the plan intent; only the empty-array property name check and the new plain-ID test required manual edits.

## Next Phase Readiness

- UAT issues 3 and 4 should now be resolved: relationship fields use v1.8.0 OWL names and plain UUID lookups work
- All 33 tests pass (TypeScript compiles cleanly)
- Ready for Phase 3 (Fuseki migration) or further UAT validation

## Self-Check: PASSED

- FOUND: model-catalog-api/src/mappers/resource-registry.ts
- FOUND: model-catalog-api/src/service.ts
- FOUND: model-catalog-api/src/mappers/__tests__/response.test.ts
- FOUND: model-catalog-api/src/__tests__/integration.test.ts
- FOUND: .planning/phases/02-api-integration/02-11-SUMMARY.md
- FOUND commit: a385f14 (Task 1 - rename relationship keys)
- FOUND commit: 4f88031 (Task 2 - ID prefix prepending)
- FOUND commit: aab147b (Task 3 - updated tests + plain-ID test)

---
*Phase: 02-api-integration*
*Completed: 2026-02-21*
