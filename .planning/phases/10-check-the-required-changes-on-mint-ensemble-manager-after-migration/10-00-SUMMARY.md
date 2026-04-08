---
phase: 10-check-the-required-changes-on-mint-ensemble-manager-after-migration
plan: "00"
subsystem: graphql_engine
tags: [hasura, migration, postgresql, execution, fk-migration]
dependency_graph:
  requires: [Phase 09 migration 1771200012000]
  provides: [execution.model_id dropped, execution_data_binding FK to modelcatalog_dataset_specification]
  affects: [graphql_engine/migrations, graphql_engine/metadata/tables.yaml]
tech_stack:
  added: []
  patterns: [delete-before-fk-add for PK columns, hasura-metadata-column-permissions]
key_files:
  created:
    - graphql_engine/migrations/1771200013000_drop_execution_model_id/up.sql
    - graphql_engine/migrations/1771200013000_drop_execution_model_id/down.sql
    - graphql_engine/migrations/1771200014000_execution_data_binding_fk/up.sql
    - graphql_engine/migrations/1771200014000_execution_data_binding_fk/down.sql
  modified:
    - graphql_engine/metadata/tables.yaml
decisions:
  - "Delete-before-FK-add pattern used for execution_data_binding and execution_result because model_io_id is part of PK (cannot be nulled)"
  - "execution_result table included in FK repoint migration alongside execution_data_binding (both reference model_io)"
  - "Hasura metadata update_permissions also contained model_id — removed from all 4 permission blocks (insert, select x2, update)"
metrics:
  duration: 3 minutes
  completed: "2026-04-08T01:25:24Z"
  tasks: 2
  files: 5
---

# Phase 10 Plan 00: Drop execution.model_id and repoint data binding FKs Summary

SQL migrations and Hasura metadata update to drop legacy `execution.model_id` column and repoint `execution_data_binding` and `execution_result` FK constraints from `model_io` to `modelcatalog_dataset_specification`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SQL migration to drop execution.model_id and update Hasura metadata | 9294b01 | migrations/1771200013000/up.sql, down.sql, metadata/tables.yaml |
| 2 | Create SQL migration to repoint execution_data_binding FK to modelcatalog_dataset_specification | defba3b | migrations/1771200014000/up.sql, down.sql |

## What Was Built

Two Hasura SQL migrations that complete the D-01 and D-04 requirements:

1. **Migration 1771200013000** (`drop_execution_model_id`): Drops the legacy `execution.model_id` column. The replacement column `modelcatalog_configuration_id` was backfilled in Phase 9 migration 1771200012000 and already has a FK constraint to `modelcatalog_configuration`.

2. **Migration 1771200014000** (`execution_data_binding_fk`): Repoints `execution_data_binding.model_io_id` and `execution_result.model_io_id` FK constraints from `model_io` to `modelcatalog_dataset_specification`. Uses the delete-before-add pattern (established in migration 1771200001000) because `model_io_id` is part of the primary key and cannot be nulled.

3. **Hasura metadata**: Removed `model_id` from all 4 execution table permission blocks (insert/user, select/anonymous, select/user, update/user).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing coverage] Also included execution_result in FK repoint migration**
- **Found during:** Task 2 planning — init migration (line 497) shows `execution_result_model_io_id_fkey` also references `model_io`
- **Issue:** Plan mentioned only execution_data_binding but execution_result has the same FK pattern
- **Fix:** Both tables included in migration 1771200014000 per plan note: "The same should be done for execution_result table"
- **Files modified:** graphql_engine/migrations/1771200014000_execution_data_binding_fk/up.sql
- **Commit:** defba3b

**2. [Rule 1 - Bug] update_permissions also contained model_id**
- **Found during:** Task 1 — tables.yaml inspection
- **Issue:** Plan mentioned 3 select + 1 insert = 4 occurrences, but update_permissions also listed model_id (5th occurrence)
- **Fix:** Removed model_id from update_permissions as well
- **Files modified:** graphql_engine/metadata/tables.yaml
- **Commit:** 9294b01

## Known Stubs

None — migrations are complete SQL statements with no placeholders.

## Self-Check: PASSED

- graphql_engine/migrations/1771200013000_drop_execution_model_id/up.sql: FOUND
- graphql_engine/migrations/1771200013000_drop_execution_model_id/down.sql: FOUND
- graphql_engine/migrations/1771200014000_execution_data_binding_fk/up.sql: FOUND
- graphql_engine/migrations/1771200014000_execution_data_binding_fk/down.sql: FOUND
- model_id removed from execution permissions in tables.yaml: VERIFIED
- Commit 9294b01: FOUND
- Commit defba3b: FOUND
