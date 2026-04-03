---
phase: 03-fix-nested-resource-creation-link-or-create-associated-resources-when-creating-parent-resource
plan: 01
subsystem: model-catalog-api
tags: [typescript, hasura, junction-tables, nested-inserts, resource-registry]
dependency_graph:
  requires: []
  provides:
    - RelationshipConfig.parentFkColumn field for all 25 junction relationships
    - buildJunctionInserts() helper for Hasura nested insert generation
  affects:
    - model-catalog-api/src/mappers/resource-registry.ts
    - model-catalog-api/src/mappers/request.ts
    - model-catalog-api/src/mappers/__tests__/request.test.ts
tech_stack:
  added: []
  patterns:
    - Hasura nested insert with on_conflict (upsert) for junction-based relationships
    - TDD: failing tests committed before implementation
key_files:
  created: []
  modified:
    - model-catalog-api/src/mappers/resource-registry.ts
    - model-catalog-api/src/mappers/request.ts
    - model-catalog-api/src/mappers/__tests__/request.test.ts
decisions:
  - Added parentFkColumn as optional field on RelationshipConfig interface rather than runtime lookup map -- explicit, self-documenting, catches missing values
  - buildJunctionInserts is a separate export alongside toHasuraInput rather than modifying toHasuraInput -- cleaner separation, Plan 02 wires them together
  - causaldiagrams hasPart intentionally skipped (no junctionRelName) -- polymorphic table requires custom handling out of scope
metrics:
  duration: 4 minutes
  completed: 2026-03-28
  tasks_completed: 2
  files_modified: 3
---

# Phase 03 Plan 01: Junction Registry Extension and buildJunctionInserts Helper Summary

Extended RelationshipConfig with explicit parentFkColumn for all 25 junction relationships and implemented buildJunctionInserts() helper that transforms API request body relationship fields into Hasura nested insert format with link-or-create semantics.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend RelationshipConfig with parentFkColumn | fafe3f3 (submodule), dc68865 (parent) | resource-registry.ts |
| 2 (RED) | Add failing tests for buildJunctionInserts | 457a4e2 (submodule) | request.test.ts |
| 2 (GREEN) | Implement buildJunctionInserts helper | 5ea631c (submodule), e78ae38 (parent) | request.ts |

## What Was Built

### Task 1: RelationshipConfig Extension

Added `parentFkColumn?: string` field to the `RelationshipConfig` interface with JSDoc. Populated for all 25 junction-based relationships:

- `software_id` (10 entries): softwares, models, empiricalmodels, hybridmodels, emulators, theory-guidedmodels, theory_guidedmodels, coupledmodels authors + hasModelCategory
- `software_version_id` (7 entries): softwareversions authors, hasModelCategory, hasProcess, hasGrid, hasExplanationDiagram, hasInputVariable, hasOutputVariable
- `configuration_id` (7 entries): modelconfigurations authors, hasInput, hasOutput, hasParameter, hasCausalDiagram, hasOutputTimeInterval, hasRegion
- `model_configuration_id` (1 entry): modelconfigurations hasModelCategory (special case per Pitfall 1)
- `setup_id` (12 entries): modelconfigurationsetups and configurationsetups authors, hasInput, hasOutput, hasParameter, calibratedVariable, calibrationTargetVariable
- `model_configuration_setup_id` (1 entry): modelconfigurationsetups hasModelCategory (special case per Pitfall 1)
- `parameter_id` (1 entry): parameters hasIntervention
- causaldiagrams hasPart: intentionally left without parentFkColumn (no junctionRelName, polymorphic table)

### Task 2: buildJunctionInserts Helper + Unit Tests

Exported `buildJunctionInserts(body, resourceConfig)` from `request.ts`:

- Iterates over all junction relationships in the resource config (skips non-junction, skips missing junctionRelName)
- Normalizes array-of-strings and array-of-objects (Pitfall 6 guard)
- Resolves IDs: full URIs pass through, short IDs get `https://w3id.org/okn/i/mint/` prefix prepended
- Generates UUID when no ID provided (D-02 requirement)
- Maps camelCase nested scalar fields to snake_case
- Produces Hasura nested insert structure with `on_conflict` on both junction row and target entity
- Returns empty object when no junction fields present in body

9 new tests added to `request.test.ts`, all passing. 30 existing tests unchanged (regression safe).

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all junction relationships have explicit parentFkColumn values. buildJunctionInserts is ready for Plan 02 to wire into service.ts create() and update() methods.

## Self-Check: PASSED

- resource-registry.ts: FOUND (fafe3f3 in submodule)
- request.ts: FOUND (5ea631c in submodule)
- request.test.ts: FOUND (457a4e2 in submodule)
- Submodule commits referenced in parent: dc68865, e78ae38
- All 39 tests pass: `npm test -- request` exits 0
- TypeScript compiles: `npx tsc --noEmit` exits 0
