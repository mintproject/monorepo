---
phase: 02-api-integration
plan: 01
subsystem: database
tags: [hasura, graphql, permissions, yaml, modelcatalog]

# Dependency graph
requires:
  - phase: 01-schema-and-data-migration
    provides: 36 modelcatalog_* tables with select_permissions for anonymous and user roles
provides:
  - insert_permissions for user role on all 39 modelcatalog tables
  - update_permissions for user role on 16 modelcatalog entity tables
  - delete_permissions for user role on all 39 modelcatalog tables
  - Full CRUD mutation access through Hasura GraphQL for authenticated users
affects:
  - 02-api-integration (all subsequent plans requiring write endpoints)
  - Any plan implementing GraphQL mutations on modelcatalog data

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Entity tables (with id column) get insert+update+delete; junction tables (FK pairs only) get insert+delete"
    - "All mutation permissions use unrestricted filter ({}) - consistent with existing non-modelcatalog table conventions"
    - "insert_permissions use check: {} (allow all), update_permissions use filter: {} and check: null"

key-files:
  created: []
  modified:
    - graphql_engine/metadata/tables.yaml

key-decisions:
  - "Junction tables omit update_permissions: rows are inserted/deleted as FK pairs, never updated in place"
  - "Used check: {} (not null) for insert_permissions to allow unrestricted inserts by authenticated users"
  - "Used filter: {} for delete/update to match convention from 01-04 decision on unrestricted read access"

patterns-established:
  - "Entity vs junction distinction: entity tables need all 3 mutation types; junction tables need insert+delete only"

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 2 Plan 1: Hasura Mutation Permissions Summary

**Hasura mutation permissions (insert/update/delete) added for all 39 modelcatalog tables, enabling full CRUD via GraphQL for authenticated users while keeping anonymous read-only**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T00:06:42Z
- **Completed:** 2026-02-21T00:09:14Z
- **Tasks:** 2 (implemented atomically in single file pass)
- **Files modified:** 1

## Accomplishments

- All 16 modelcatalog entity tables now have insert_permissions, update_permissions, and delete_permissions for the user role
- All 23 modelcatalog junction tables now have insert_permissions and delete_permissions for the user role (no update needed - FK pairs are not updated in place)
- Anonymous role retains read-only access (select_permissions only) on all modelcatalog tables
- All existing non-modelcatalog table permissions preserved exactly

## Task Commits

Both tasks were implemented in a single atomic pass against the same file and committed together:

1. **Task 1: Add insert/update/delete permissions for 16 entity tables** - `b579032` (feat)
2. **Task 2: Add insert/update/delete permissions for 20+ junction tables** - included in `b579032` (same file pass)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `graphql_engine/metadata/tables.yaml` - Added mutation permissions for all 39 modelcatalog tables (submodule commit b579032 in graphql_engine repo)

## Decisions Made

- Junction tables (FK-pair-only tables) get insert+delete only, no update_permissions - rows are inserted or deleted, never partially updated
- Used `check: {}` for insert_permissions (permit all rows for user role, consistent with 01-04 decision on unrestricted access)
- Used `filter: {}` for update/delete (consistent with existing non-modelcatalog table conventions for simple entity tables)
- Total modelcatalog table count is 39 (plan stated 36; the 3 extra are modelcatalog_software_author, modelcatalog_version_author, modelcatalog_configuration_author which were added in 01-03)

## Deviations from Plan

None - plan executed exactly as written. The plan already accounted for the 3 additional author junction tables.

## Issues Encountered

- graphql_engine is a git submodule; had to commit inside the submodule rather than the parent repo. The parent repo submodule pointer will be updated in the final docs commit.

## Self-Check: PASSED

- graphql_engine/metadata/tables.yaml: FOUND (in submodule)
- 02-01-SUMMARY.md: FOUND
- Commit b579032 in graphql_engine submodule: FOUND

## Next Phase Readiness

- Hasura mutation permissions are in place for all modelcatalog tables
- The new API (Phase 2 subsequent plans) can now perform full CRUD via GraphQL mutations
- Hasura metadata reload required after deployment to activate permissions in live environment

---
*Phase: 02-api-integration*
*Completed: 2026-02-21*
