---
phase: 03-fix-nested-resource-creation-link-or-create-associated-resources-when-creating-parent-resource
plan: 02
subsystem: model-catalog-api
tags: [typescript, hasura, junction-tables, nested-inserts, service-layer, atomic-mutation]
dependency_graph:
  requires:
    - 03-01 (buildJunctionInserts helper and parentFkColumn on RelationshipConfig)
  provides:
    - Junction-aware create() and update() methods in service.ts
    - Atomic POST that creates parent entity AND junction rows in one mutation
    - Atomic PUT that replaces junction rows for provided relationship fields
  affects:
    - model-catalog-api/src/service.ts
tech_stack:
  added: []
  patterns:
    - Multi-root Hasura mutation for delete-then-insert junction replacement
    - Pitfall 2 guard: only touch junction rows for body fields explicitly present
    - Flat FK columns for root-level junction inserts (not nested insert syntax)
    - 400 error response for constraint violations instead of 500
key_files:
  created: []
  modified:
    - model-catalog-api/src/service.ts
decisions:
  - Used multi-root mutation for update path (delete junctions + update scalars + insert junctions in one transaction) rather than sequential mutations
  - Used flat FK columns for update-path junction inserts (not nested insert syntax) -- simpler and correct for root-level insert_* mutations
  - Only junction relationships explicitly present in PUT request body are affected (Pitfall 2 compliance)
metrics:
  duration: 1 minute
  completed: 2026-03-28
  tasks_completed: 2
  files_modified: 1
---

# Phase 03 Plan 02: Wire Junction Inserts into Service Layer Summary

Updated service.ts create() and update() methods to call buildJunctionInserts and handle junction table row management atomically via Hasura multi-root mutations.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update create() to include junction inserts in atomic mutation | 5057497 (submodule), 52990b9 (parent) | service.ts |
| 2 | Update update() with delete-then-insert for junction replacement | b86052d (submodule), 9606b83 (parent) | service.ts |

## What Was Built

### Task 1: create() Junction Handling

Updated `create()` in `service.ts`:

1. Added `buildJunctionInserts` to the import from `./mappers/request.js`
2. After building scalar `input`, calls `buildJunctionInserts(body, resourceConfig)` to get junction nested insert objects keyed by `hasuraRelName`
3. Merges both into `const object = { ...input, ...junctionInserts }` for atomic mutation
4. Passes `{ object }` (not `{ object: input }`) to the Hasura mutation variable
5. Added constraint violation detection in the catch block: checks `err.message` for `"uniqueness violation"` or `"constraint"` and returns 400 instead of 500

POST with nested relationship arrays now creates the parent entity AND all junction rows in one atomic mutation.

### Task 2: update() Delete-then-Insert Junction Handling

Updated `update()` in `service.ts`:

1. Iterates over `resourceConfig.relationships` to find junction relationships explicitly present in the request body (Pitfall 2 guard: `if (body[apiFieldName] === undefined) continue`)
2. For each such relationship, builds two mutation parts:
   - `del_{relName}: delete_modelcatalog_{juncSuffix}(where: { {parentFkColumn}: { _eq: $id } }) { affected_rows }` -- deletes all existing junction rows for this parent
   - `ins_{relName}: insert_modelcatalog_{juncSuffix}(objects: ${varName}, on_conflict: { constraint: ..._pkey, update_columns: [] }) { affected_rows }` -- inserts new flat junction rows
3. Junction insert objects use flat FK columns: `{ [parentFkColumn]: fullId, [targetFkColumn]: targetId }` where `targetFkColumn = junctionRelName + "_id"`
4. Target IDs from the body are normalized: full URIs pass through, short IDs get `https://w3id.org/okn/i/mint/` prefix, missing IDs get a generated UUID
5. When no junction relationships are in the body, falls back to the simple `_set` mutation (regression safe)
6. Multi-root mutation variable declarations include typed arrays for each junction insert: `$junc_{relName}: [modelcatalog_{juncSuffix}_insert_input!]!`
7. Added constraint violation detection same as create()

PUT with relationship fields now replaces junction rows atomically. PUT without relationship fields in the body leaves all existing junction rows untouched.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - both create() and update() are fully wired. The feature is complete end-to-end.

## Self-Check: PASSED

- service.ts contains `import { toHasuraInput, buildJunctionInserts } from './mappers/request.js'`: FOUND
- service.ts contains `buildJunctionInserts(body as Record<string, unknown>, resourceConfig)`: FOUND
- service.ts contains `const object = { ...input, ...junctionInserts }`: FOUND
- service.ts create() passes `{ object }` (not `{ object: input }`): FOUND
- service.ts create() catch block checks for constraint: FOUND
- service.ts update() contains `delete_modelcatalog_`: FOUND
- service.ts update() checks `body[apiFieldName] === undefined`: FOUND
- service.ts update() contains `parentFkColumn`: FOUND
- service.ts update() contains `on_conflict`: FOUND
- TypeScript compiles: npx tsc --noEmit exits 0
- All 85 tests pass: npm test exits 0
