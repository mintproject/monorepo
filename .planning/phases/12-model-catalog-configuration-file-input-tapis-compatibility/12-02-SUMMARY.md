---
phase: 12-model-catalog-configuration-file-input-tapis-compatibility
plan: "02"
subsystem: model-catalog-api
tags:
  - is_optional
  - junction-columns
  - field-maps
  - openapi
  - unit-tests
dependency_graph:
  requires:
    - 12-01-PLAN.md
  provides:
    - is_optional round-trips through v2 REST API (GET, PUT, POST)
  affects:
    - model-catalog-api/src/mappers/resource-registry.ts
    - model-catalog-api/src/hasura/field-maps.ts
    - model-catalog-api/src/service.ts
    - model-catalog-api/src/mappers/request.ts
    - model-catalog-api/src/mappers/__tests__/request.test.ts
    - model-catalog-api/openapi.yaml
tech_stack:
  added: []
  patterns:
    - junctionColumns metadata on RelationshipConfig drives PUT and POST is_optional pass-through
    - Junction-level scalars excluded from nested entity copy loop in buildJunctionInserts
key_files:
  created: []
  modified:
    - model-catalog-api/src/mappers/resource-registry.ts
    - model-catalog-api/src/hasura/field-maps.ts
    - model-catalog-api/src/service.ts
    - model-catalog-api/src/mappers/request.ts
    - model-catalog-api/src/mappers/__tests__/request.test.ts
    - model-catalog-api/openapi.yaml
decisions:
  - junctionColumns camelCase keys are excluded from nested entity data copy to prevent
    leakage of junction-row metadata (is_optional) into the nested dataset_specification insert
  - configurationsetups alias also received junctionColumns for consistency (same junction table)
metrics:
  duration: 235s
  completed: "2026-04-27"
  tasks_completed: 4
  files_modified: 6
---

# Phase 12 Plan 02: is_optional Round-Trip Through v2 REST API Summary

**One-liner:** Added `junctionColumns` metadata to RelationshipConfig + hasInput entries and wired is_optional through field-maps GraphQL selection, service.ts PUT path, request.ts CREATE path (buildJunctionInserts), unit tests, and OpenAPI DatasetSpecification schema.

## What Was Built

`is_optional` now round-trips through the model-catalog-api v2 REST API:

- **GET** responses include `is_optional` on each `hasInput` item (field-maps.ts selects it at junction row level)
- **PUT** requests propagate `isOptional` from request body to junction row insert (service.ts update path)
- **POST** requests propagate `isOptional` from request body via `buildJunctionInserts` to the nested junction insert (request.ts CREATE path)
- **OpenAPI** schema declares `isOptional: boolean` on DatasetSpecification for API consumers

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Extend RelationshipConfig + hasInput entries in resource-registry.ts | 5ace037 | resource-registry.ts |
| 2 | Update field-maps.ts, service.ts, and request.ts | e3767ae | field-maps.ts, service.ts, request.ts |
| 3 | Add buildJunctionInserts unit tests for configuration_input + is_optional | da2329d | request.test.ts, request.ts |
| 4 | Add isOptional field to DatasetSpecification in openapi.yaml | 72ec181 | openapi.yaml |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Junction-row fields leaking into nested entity data**
- **Found during:** Task 3 (Test 10 failure)
- **Issue:** The `buildJunctionInserts` scalar copy loop (lines 201-213 in request.ts) iterates all item fields and applies `camelToSnake()` to copy them into the nested entity's `data` object. This caused `isOptional` to be converted to `is_optional` and written into the `modelcatalog_dataset_specification` insert — a column that doesn't exist on that table.
- **Fix:** Added a `junctionCamelKeys` Set populated from `relConfig.junctionColumns` values. The copy loop skips any key present in this set, ensuring junction-row-level fields are not copied into the nested entity data.
- **Files modified:** model-catalog-api/src/mappers/request.ts
- **Commit:** da2329d

**2. [Rule 2 - Missing critical functionality] configurationsetups alias missing junctionColumns**
- **Found during:** Task 1 code review
- **Issue:** The `configurationsetups` alias resource entry also has a `hasInput` relationship pointing to the same `modelcatalog_configuration_input` junction table. Without `junctionColumns` there, POST/PUT via the `/configurationsetups` endpoint would not propagate `is_optional`.
- **Fix:** Added `junctionColumns: { is_optional: 'isOptional' }` to `configurationsetups.hasInput` alongside the two specified entries.
- **Files modified:** model-catalog-api/src/mappers/resource-registry.ts
- **Commit:** 5ace037

## Verification Results

```
1. grep -c "junctionColumns" resource-registry.ts  => 4 (interface + 3 hasInput entries)
2. grep -c "is_optional" field-maps.ts             => 1
3. grep -c "junctionColumns" service.ts            => 2
4. grep -c "junctionColumns" request.ts            => 3
5. grep -c "is_optional" request.test.ts           => 7
6. grep -c "isOptional" openapi.yaml               => 1
7. npx tsc --noEmit                                => CLEAN
8. npm test                                        => 174 passed, 66 skipped (integration skipped, needs live Hasura)
```

## Self-Check

- [x] model-catalog-api/src/mappers/resource-registry.ts — modified (junctionColumns)
- [x] model-catalog-api/src/hasura/field-maps.ts — modified (is_optional)
- [x] model-catalog-api/src/service.ts — modified (junctionColumns spread)
- [x] model-catalog-api/src/mappers/request.ts — modified (junctionColumns spread + bug fix)
- [x] model-catalog-api/src/mappers/__tests__/request.test.ts — modified (Tests 10 and 11)
- [x] model-catalog-api/openapi.yaml — modified (isOptional field)
- [x] All commits on gsd/phase-12-is-optional branch (submodule + superproject pointer bumps)

## Self-Check: PASSED

All files exist and all commits are present on the feature branch.

## Known Stubs

None — all wiring is live. is_optional reads from and writes to the actual junction table column added in Plan 01.

## Threat Flags

No new threat surface beyond what was modeled in the plan's threat_model section. The junctionColumns guard (only pre-declared columns pass through) prevents arbitrary client key injection.
