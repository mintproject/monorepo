---
phase: 03-fk-migration-and-cleanup
plan: 01
subsystem: database
tags: [postgres, hasura, fk-migration, modelcatalog, yaml, sql]

# Dependency graph
requires:
  - phase: 01-schema-and-data-migration
    provides: modelcatalog_model_configuration, modelcatalog_model_configuration_setup, modelcatalog_parameter, modelcatalog_dataset_specification tables
  - phase: 02-api-integration
    provides: Hasura metadata patterns and modelcatalog_* table tracking in tables.yaml
provides:
  - Hasura migration 1771200000000: adds modelcatalog_configuration_id and modelcatalog_setup_id FK columns to execution and thread_model
  - Hasura migration 1771200001000: adds modelcatalog_dataset_specification_id to model_io, repoints parameter binding FK from model_parameter to modelcatalog_parameter
  - Updated tables.yaml with all new FK relationships and reverse relationships on modelcatalog_* tables
  - Read-only classification preview script for user review before migration
affects: [03-sdk-removal, 03-ensemble-manager-rewrite, future-model-table-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two Hasura migration files (1771200000000 and 1771200001000) covering classification+FK columns and parameter repointing
    - BEGIN/COMMIT wrapping for all multi-statement migrations
    - Delete-before-FK-add pattern for tables where FK column is part of PK (execution_parameter_binding, thread_model_parameter)
    - Explicit CREATE INDEX for every new FK column (PostgreSQL does not auto-index FKs)

key-files:
  created:
    - graphql_engine/migrations/1771200000000_fk_migration_classify/up.sql
    - graphql_engine/migrations/1771200000000_fk_migration_classify/down.sql
    - graphql_engine/migrations/1771200001000_fk_migration_parameter/up.sql
    - graphql_engine/migrations/1771200001000_fk_migration_parameter/down.sql
  modified:
    - graphql_engine/metadata/tables.yaml

key-decisions:
  - "Migration 1 up.sql: DROP CONSTRAINT and ALTER COLUMN DROP NOT NULL in same ALTER TABLE statement for atomicity"
  - "Migration 2 up.sql: DELETE orphaned parameter binding rows before ADD CONSTRAINT (not deferrable) -- orphan count was 0 per user review"
  - "model_parameter: remove execution_parameter_bindings and thread_model_parameters array_relationships since FK now points to modelcatalog_parameter"
  - "modelcatalog_dataset_specification: add model_ios array_relationship as reverse direction for new FK on model_io"

patterns-established:
  - "Reverse relationships always added on both ends when adding new FK columns (object_relationship on owning table + array_relationship on referenced table)"
  - "Permission column lists updated in same commit as relationship changes to keep Hasura metadata internally consistent"

# Metrics
duration: 10min
completed: 2026-02-21
---

# Phase 3 Plan 01: FK Migration Classification and Metadata Summary

**Two Hasura migrations (classify FK columns + repoint parameter FKs) and updated tables.yaml connecting execution/thread_model directly to modelcatalog_model_configuration/setup tables via new nullable FK columns**

## Performance

- **Duration:** ~10 min (continuation after user-approved checkpoint)
- **Started:** 2026-02-21T (continuation from Task 3)
- **Completed:** 2026-02-21
- **Tasks:** 4 (Tasks 1-2 completed in prior session; Tasks 3-4 in this session)
- **Files modified:** 5 (4 migration SQL files created, 1 tables.yaml updated)

## Accomplishments

- Created two Hasura migration directories with up.sql and down.sql, following existing migration naming convention (timestamp_slug with BEGIN/COMMIT wrapping)
- Migration 1 adds `modelcatalog_configuration_id` and `modelcatalog_setup_id` nullable FK columns to `execution` and `thread_model`, backfills via string-match against modelcatalog_* tables, and drops the old `execution_model_id_fkey` and `thread_model_model_id_fkey` constraints while keeping `model_id` column for backward compatibility
- Migration 2 adds `modelcatalog_dataset_specification_id` to `model_io`, deletes orphaned parameter binding rows before adding new FK, and repoints `execution_parameter_binding` and `thread_model_parameter` from `model_parameter` to `modelcatalog_parameter`
- Updated `tables.yaml` with all required relationship changes: replaced stale `model` object_relationships, added new modelcatalog_* object_relationships on owning tables, added reverse array_relationships on referenced modelcatalog_* tables, and updated permission column lists

## Task Commits

Each task was committed atomically (in `graphql_engine` submodule):

1. **Task 1: Create read-only classification preview SQL script** - `999d5c9` (feat) [prior session]
2. **Task 2: User reviews classification report** - `APPROVED` (checkpoint) [prior session]
3. **Task 3: Create two Hasura migration SQL files for FK migration** - `9645a4f` (feat)
4. **Task 4: Update Hasura metadata for new FK relationships and permissions** - `f8098d1` (feat)

**Plan metadata (parent repo submodule updates):** `b4eded0`, `ef0667a`

## Files Created/Modified

- `graphql_engine/migrations/1771200000000_fk_migration_classify/up.sql` - Adds modelcatalog_configuration_id and modelcatalog_setup_id to execution and thread_model with backfill and drops old FK constraints
- `graphql_engine/migrations/1771200000000_fk_migration_classify/down.sql` - Reverses migration 1 (drops new columns, restores old FK constraints)
- `graphql_engine/migrations/1771200001000_fk_migration_parameter/up.sql` - Adds modelcatalog_dataset_specification_id to model_io, deletes orphaned parameter bindings, repoints parameter FK to modelcatalog_parameter
- `graphql_engine/migrations/1771200001000_fk_migration_parameter/down.sql` - Reverses migration 2 structural changes (note: deleted orphan rows not restorable without pg_dump)
- `graphql_engine/metadata/tables.yaml` - Updated with 13 targeted edits covering all new FK relationships and permission column lists

## Decisions Made

- Migration 2 uses DELETE (not NULL) for orphaned parameter binding rows because `model_parameter_id` is part of the primary key on both `execution_parameter_binding` and `thread_model_parameter` -- setting it to NULL would violate the PK constraint. User review confirmed 0 orphaned rows, so no data loss occurs.
- The down.sql for migration 2 notes explicitly that orphaned parameter binding rows deleted by up.sql cannot be restored without a pg_dump backup.
- Used non-deferrable FK constraints in migration 2 after deleting orphans, since deferrable constraints add complexity with no benefit when orphan count is 0.
- Removed `execution_parameter_bindings` and `thread_model_parameters` array_relationships from `model_parameter` in tables.yaml since those tables no longer FK to `model_parameter`.

## Deviations from Plan

None - plan executed exactly as written. All migration SQL patterns match the documented approach in RESEARCH.md.

## Issues Encountered

- `graphql_engine` is a git submodule -- file commits had to be made inside the submodule repo (`graphql_engine/`) rather than in the parent monorepo. The parent repo received submodule pointer update commits separately. This is normal project structure behavior, not a bug.

## User Setup Required

None - no external service configuration required.

The migrations are ready to apply. When deploying:
1. Run `hasura migrate apply` for migration 1771200000000_fk_migration_classify
2. Run `hasura migrate apply` for migration 1771200001000_fk_migration_parameter
3. Run `hasura metadata apply` to push the updated tables.yaml

Per the research rollback strategy: take a `pg_dump` backup before running migrations and deploy during a maintenance window.

## Next Phase Readiness

- FK migration SQL and Hasura metadata updates are complete and ready to apply to production
- Remaining Phase 3 plans: 03-03 (SDK dependency removal) and 03-04 (Ensemble Manager rewrite)
- No blockers for proceeding to 03-03

---
*Phase: 03-fk-migration-and-cleanup*
*Completed: 2026-02-21*
