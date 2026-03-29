---
phase: 05-variable-migration-analysis-trig-fuseki-to-hasura
plan: 03
subsystem: database
tags: [postgres, hasura, migration, sql, fk-constraints, modelcatalog]

# Dependency graph
requires:
  - phase: 05-01
    provides: modelcatalog_standard_variable and modelcatalog_unit tables
  - phase: 05-02
    provides: ETL populates standard_variable and unit rows before FK constraints applied
provides:
  - FK constraint fk_vp_standard_variable enforcing variable_presentation.has_standard_variable -> modelcatalog_standard_variable(id)
  - FK constraint fk_vp_unit enforcing variable_presentation.uses_unit -> modelcatalog_unit(id)
  - Migration 1771200006000 with up.sql and down.sql for clean rollback
  - D-03 resolved: no modelcatalog_variable table created (0 plain sd:Variable in TriG)
affects:
  - modelcatalog_variable_presentation table (two FK constraints added)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DEFERRABLE INITIALLY DEFERRED FK constraints for batch ETL compatibility
    - ON DELETE SET NULL on nullable FK columns to preserve child rows on parent deletion

key-files:
  created:
    - graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/up.sql
    - graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/down.sql
  modified: []

key-decisions:
  - "D-03 resolved: no modelcatalog_variable table created; 0 plain sd:Variable instances in TriG data"
  - "DEFERRABLE INITIALLY DEFERRED chosen for both FK constraints to allow batch loading within transactions"
  - "ON DELETE SET NULL used because both FK columns are nullable and VP rows should survive entity deletion"

requirements-completed: [D-03, D-08]

# Metrics
duration: 3min
completed: 2026-03-29
---

# Phase 5 Plan 03: FK Constraints from variable_presentation to StandardVariable and Unit

**SQL migration adding FK constraints fk_vp_standard_variable and fk_vp_unit from modelcatalog_variable_presentation to modelcatalog_standard_variable and modelcatalog_unit, completing referential integrity for the variable data ecosystem**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-29T12:52:20Z
- **Completed:** 2026-03-29T12:55:00Z
- **Tasks:** 1
- **Files modified:** 2 (both created in graphql_engine submodule)

## Accomplishments

- Created SQL migration `1771200006000_modelcatalog_variable_fk_constraints` with `up.sql` adding two DEFERRABLE FK constraints
- Created `down.sql` for clean rollback using `DROP CONSTRAINT IF EXISTS`
- Documented D-03 resolution: no `modelcatalog_variable` table created (research confirmed 0 plain `sd:Variable` instances in TriG data)
- Migration runs AFTER ETL (Plan 02) per the documented critical ordering requirement

## Task Commits

Each task was committed atomically:

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create FK constraint migration | graphql_engine: `a66adeb`, parent: `3832dda` | graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/up.sql, down.sql |

## Files Created/Modified

- `graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/up.sql` - ALTER TABLE ADD CONSTRAINT for fk_vp_standard_variable and fk_vp_unit
- `graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/down.sql` - DROP CONSTRAINT IF EXISTS rollback

## Decisions Made

- **D-03 resolved**: No `modelcatalog_variable` table is created. Research confirmed 0 plain `sd:Variable` instances in the TriG data. The `variables` resource entry in resource-registry.ts keeps `hasuraTable: null`.
- **DEFERRABLE INITIALLY DEFERRED**: Both constraints use this pattern (consistent with the existing `fk_migration_parameter` migration) to allow batch ETL loading within transactions without violating FK constraints mid-transaction.
- **ON DELETE SET NULL**: Both FK columns are nullable (`has_standard_variable` and `uses_unit`), so VP rows survive if a referenced StandardVariable or Unit is deleted.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. The migration is complete and reversible. The only ordering constraint is that this migration must be applied after the ETL (Plan 02) has populated `modelcatalog_standard_variable` and `modelcatalog_unit`.

## Self-Check: PASSED

All created files exist:
- FOUND: graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/up.sql
- FOUND: graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/down.sql

All commits exist:
- FOUND: a66adeb (graphql_engine submodule - FK constraint migration)
- FOUND: 3832dda (parent repo - submodule pointer update)

Verification checks passed:
- up.sql contains 2 ADD CONSTRAINT statements
- down.sql contains 2 DROP CONSTRAINT statements
- up.sql contains 2 DEFERRABLE INITIALLY DEFERRED clauses
- up.sql contains 2 ON DELETE SET NULL clauses

---
*Phase: 05-variable-migration-analysis-trig-fuseki-to-hasura*
*Completed: 2026-03-29*
