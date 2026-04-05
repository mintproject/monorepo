---
phase: 09-merge-modelconfiguration-setup-tables-and-migrate-thread-model-relationships
plan: "01"
subsystem: graphql_engine
tags:
  - database-migration
  - hasura-metadata
  - schema-consolidation
dependency_graph:
  requires:
    - graphql_engine/migrations/1771200000000_fk_migration_classify
    - graphql_engine/migrations/1771200004000_modelcatalog_configuration_category
    - graphql_engine/migrations/1771105511000_modelcatalog_author_relationships
  provides:
    - modelcatalog_configuration unified table
    - consolidated junction tables
    - thread_model/execution FK backfill to unified table
    - public.model cleanup
  affects:
    - graphql_engine/metadata/tables.yaml
    - thread_model table (removes modelcatalog_setup_id column)
    - execution table (removes modelcatalog_setup_id column)
tech_stack:
  added: []
  patterns:
    - self-FK to distinguish Configuration vs Setup rows (model_configuration_id NULL vs non-NULL)
    - BEGIN/COMMIT wrapped SQL migrations
    - ON CONFLICT DO NOTHING for idempotent junction merges
key_files:
  created:
    - graphql_engine/migrations/1771200010000_merge_configuration_tables/up.sql
    - graphql_engine/migrations/1771200010000_merge_configuration_tables/down.sql
    - graphql_engine/migrations/1771200011000_merge_junction_tables/up.sql
    - graphql_engine/migrations/1771200011000_merge_junction_tables/down.sql
    - graphql_engine/migrations/1771200012000_thread_model_migration/up.sql
    - graphql_engine/migrations/1771200012000_thread_model_migration/down.sql
  modified:
    - graphql_engine/metadata/tables.yaml
decisions:
  - "Three-migration split: table creation (10000), junction consolidation (11000), FK backfill and public.model drop (12000)"
  - "self-FK model_configuration_id as discriminator: NULL=Configuration, non-NULL=Setup"
  - "ON CONFLICT DO NOTHING for all junction merges (safe for idempotent runs)"
  - "modelcatalog_setup_id column dropped from thread_model and execution after backfill"
metrics:
  duration: 8 minutes
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_modified: 7
---

# Phase 09 Plan 01: Merge Configuration Tables and Migrate Thread Model Relationships Summary

Unified `modelcatalog_model_configuration` and `modelcatalog_model_configuration_setup` into `modelcatalog_configuration` with a self-FK discriminator, merged 5 overlapping junction tables, renamed 2 setup-only junctions, backfilled thread_model/execution FKs, and updated Hasura metadata to track all new/renamed tables.

## What Was Built

### Migration 1771200010000_merge_configuration_tables

Creates `modelcatalog_configuration` as the column superset of both old tables:
- 17 columns covering all fields from both old tables
- `model_configuration_id` as nullable self-FK: NULL for Configuration rows, non-NULL for Setup rows
- `software_version_id` FK to `modelcatalog_software_version`
- `author_id` FK to `modelcatalog_person`
- Data migrated: Configuration rows inserted with `model_configuration_id = NULL`, Setup rows with their parent's ID
- 3 indexes on FK columns

### Migration 1771200011000_merge_junction_tables

Consolidates all junction tables to reference `modelcatalog_configuration`:

**Overlapping junctions merged (setup rows merged into configuration junctions):**
- `configuration_input` absorbs `setup_input`
- `configuration_output` absorbs `setup_output`
- `configuration_parameter` absorbs `setup_parameter`
- `configuration_author` absorbs `setup_author`

**New merged category junction:**
- `modelcatalog_configuration_category` created from `modelcatalog_modelconfiguration_category` + `modelcatalog_modelconfigurationsetup_category`

**Configuration-only junctions — FK updated:**
- `configuration_causal_diagram`, `configuration_time_interval`, `configuration_region` all updated to reference `modelcatalog_configuration`

**Setup-only junctions — renamed:**
- `modelcatalog_setup_calibrated_variable` → `modelcatalog_configuration_calibrated_variable` (column `setup_id` → `configuration_id`)
- `modelcatalog_setup_calibration_target` → `modelcatalog_configuration_calibration_target` (column `setup_id` → `configuration_id`)

**Old entity tables dropped:**
- `modelcatalog_model_configuration_setup`
- `modelcatalog_model_configuration`

### Migration 1771200012000_thread_model_migration

- Drops stale FK constraints on `thread_model` and `execution` (referencing deleted tables)
- Backfills `thread_model.modelcatalog_configuration_id` via `public.model.model_configuration` column
- Backfills `execution.modelcatalog_configuration_id` via same path
- Merges `modelcatalog_setup_id` → `modelcatalog_configuration_id` for any rows not already covered
- Adds FK constraints to `modelcatalog_configuration(id)` on both tables
- Drops `modelcatalog_setup_id` column from `thread_model` and `execution`
- Drops `model_input`, `model_output`, `model_parameter`, `public.model`

### Hasura Metadata (tables.yaml)

- Added `modelcatalog_configuration` entry with full relationship set: `parent_configuration`, `child_configurations`, `inputs`, `outputs`, `parameters`, `authors`, `categories`, `causal_diagrams`, `time_intervals`, `regions`, `calibrated_variables`, `calibration_targets`
- Added entries: `modelcatalog_configuration_category`, `modelcatalog_configuration_calibrated_variable`, `modelcatalog_configuration_calibration_target`
- Removed entries: `modelcatalog_model_configuration`, `modelcatalog_model_configuration_setup`, `modelcatalog_setup_input`, `modelcatalog_setup_output`, `modelcatalog_setup_parameter`, `modelcatalog_setup_author`, `modelcatalog_modelconfiguration_category`, `modelcatalog_modelconfigurationsetup_category`, `modelcatalog_setup_calibrated_variable`, `modelcatalog_setup_calibration_target`
- Updated `thread_model` and `execution`: removed `modelcatalog_setup` relationship and `modelcatalog_setup_id` from all permission column lists
- Updated `modelcatalog_person`: removed `authored_setups`, updated `authored_configurations` to reference new table
- Updated `modelcatalog_model_category`: removed old category junctions, added `modelcatalog_configuration_category`
- Updated `modelcatalog_dataset_specification`: removed `setup_inputs`/`setup_outputs` (now unified in configuration junctions)
- Updated `modelcatalog_parameter`: removed `setup_parameters` (now unified)
- Updated `modelcatalog_variable_presentation`: `calibrated_in` and `calibration_target_in` reference renamed tables

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all migrations are complete SQL DDL/DML with no placeholders.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 693c702 | feat(09-01): create SQL migrations for modelcatalog_configuration table merge and junction consolidation |
| Task 2 | ee31a03 | feat(09-01): update Hasura metadata to track modelcatalog_configuration and untrack dropped tables |

## Self-Check: PASSED

All created files verified:
- graphql_engine/migrations/1771200010000_merge_configuration_tables/up.sql - FOUND
- graphql_engine/migrations/1771200011000_merge_junction_tables/up.sql - FOUND
- graphql_engine/migrations/1771200012000_thread_model_migration/up.sql - FOUND
- graphql_engine/metadata/tables.yaml - FOUND and updated

All commits verified:
- 693c702 - FOUND
- ee31a03 - FOUND
