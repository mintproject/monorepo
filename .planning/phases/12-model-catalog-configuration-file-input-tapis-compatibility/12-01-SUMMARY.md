---
phase: 12-model-catalog-configuration-file-input-tapis-compatibility
plan: "01"
subsystem: graphql_engine
tags:
  - hasura
  - migration
  - schema
  - permissions
dependency_graph:
  requires: []
  provides:
    - "is_optional column on modelcatalog_configuration_input (BOOLEAN NOT NULL DEFAULT FALSE)"
    - "Hasura insert + anonymous select permissions for is_optional"
  affects:
    - "Wave 2 codegen (mint-ensemble-manager types.ts)"
    - "model-catalog-api field-maps.ts and resource-registry.ts (Wave 2)"
tech_stack:
  added: []
  patterns:
    - "Junction table NOT NULL DEFAULT column migration (ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT FALSE)"
    - "Hasura YAML anchor (&id007/*id007) column extension pattern"
    - "Separate anonymous inline column list (not anchor) for anonymous SELECT permissions"
key_files:
  created:
    - graphql_engine/migrations/1771200016000_modelcatalog_configuration_input_is_optional/up.sql
    - graphql_engine/migrations/1771200016000_modelcatalog_configuration_input_is_optional/down.sql
  modified:
    - graphql_engine/metadata/tables.yaml
decisions:
  - "D-01: is_optional BOOLEAN NOT NULL DEFAULT FALSE on junction table only"
  - "D-02: Column on modelcatalog_configuration_input (junction), NOT on modelcatalog_dataset_specification (entity)"
  - "D-03: Boolean type, not TEXT/enum"
  - "D-04: ALTER TABLE DEFAULT backfills existing rows — no separate UPDATE"
  - "D-05: insert (user anchor) + select (user anchor + anonymous inline) permissions; no update_permissions"
  - "D-11/D-12: ETL untouched — DB DEFAULT FALSE is sole ETL mechanism"
metrics:
  duration: "~2 minutes (Tasks 1-2 complete; Task 3 awaiting human apply)"
  completed_date: "2026-04-28 (partial — awaiting Hasura apply)"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 12 Plan 01: SQL Migration + Hasura Metadata for is_optional Summary

**One-liner:** Added `is_optional BOOLEAN NOT NULL DEFAULT FALSE` to `modelcatalog_configuration_input` junction table with Hasura permissions for both user and anonymous roles.

## What Was Built

Tasks 1 and 2 are complete. Task 3 (apply migration + metadata to live Hasura) is paused at a human-action checkpoint awaiting user confirmation of target environment.

### Task 1: SQL Migration Files

Created migration directory `graphql_engine/migrations/1771200016000_modelcatalog_configuration_input_is_optional/` with:

- `up.sql`: `ALTER TABLE modelcatalog_configuration_input ADD COLUMN is_optional BOOLEAN NOT NULL DEFAULT FALSE` wrapped in `BEGIN;/COMMIT;`
- `down.sql`: `ALTER TABLE modelcatalog_configuration_input DROP COLUMN is_optional` wrapped in `BEGIN;/COMMIT;`

Key properties: NOT NULL DEFAULT FALSE means existing junction rows backfill to FALSE automatically via the ALTER TABLE default clause. No separate UPDATE needed (D-04). PK `(configuration_id, input_id)` unchanged.

### Task 2: Hasura tables.yaml Metadata Update

Updated `graphql_engine/metadata/tables.yaml` `modelcatalog_configuration_input` section:

- Added `is_optional` to the `&id007` anchor used by `insert_permissions` (user role)
- Added `is_optional` to the anonymous role's inline `select_permissions` column list
- The `user` role `select_permissions` (`*id007`) picks up `is_optional` automatically via the anchor
- No `update_permissions` block added (junction table pattern: insert+delete only)
- No new roles added (D-05 honored)

### Task 3: Pending — Hasura Apply

Blocked at `checkpoint:human-action`. Commands to run:

```bash
cd graphql_engine
hasura migrate apply --database-name default
hasura metadata apply
```

Verification query (psql):
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'modelcatalog_configuration_input'
AND column_name = 'is_optional';
```

Expected: `column_name=is_optional, data_type=boolean, column_default=false, is_nullable=NO`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — change is purely additive. Existing role grants extended only (no new roles, no new trust boundaries). T-12-01 and T-12-02 mitigations verified: anonymous role select is inline list only (not anchored to insert columns beyond what's listed), no update_permissions added.

## Known Stubs

None — this plan creates DB-layer artifacts only. No application code with hardcoded values.

## Self-Check

### Files Exist

- `graphql_engine/migrations/1771200016000_modelcatalog_configuration_input_is_optional/up.sql` — FOUND
- `graphql_engine/migrations/1771200016000_modelcatalog_configuration_input_is_optional/down.sql` — FOUND
- `graphql_engine/metadata/tables.yaml` (modified) — FOUND, contains 2 occurrences of `is_optional`

### Commits

- Submodule graphql_engine Task 1: ba3e3df
- Superproject Task 1: 2e6c611
- Submodule graphql_engine Task 2: 2653623
- Superproject Task 2: bc4fd4c

## Self-Check: PASSED
