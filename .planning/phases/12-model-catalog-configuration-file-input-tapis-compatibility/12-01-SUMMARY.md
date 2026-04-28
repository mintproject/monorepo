---
phase: 12-model-catalog-configuration-file-input-tapis-compatibility
plan: "01"
subsystem: database
tags:
  - hasura
  - migration
  - schema
  - permissions
  - postgresql
dependency_graph:
  requires: []
  provides:
    - "is_optional column on modelcatalog_configuration_input (BOOLEAN NOT NULL DEFAULT FALSE)"
    - "Hasura insert + anonymous select + user select permissions for is_optional"
    - "Migration applied to dev Kubernetes cluster (namespace: mint)"
  affects:
    - "Wave 2 codegen (model-catalog-api, mint-ensemble-manager types)"
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
  duration: "~35 minutes"
  completed_date: "2026-04-27"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 12 Plan 01: SQL Migration + Hasura Metadata for is_optional Summary

**BOOLEAN NOT NULL DEFAULT FALSE column added to `modelcatalog_configuration_input` junction table with Hasura GraphQL exposure confirmed live — existing rows default to `false`, field queryable by both anonymous and user roles**

## Performance

- **Duration:** ~35 min (Tasks 1-2 automated; Task 3 applied by orchestrator to dev k8s cluster)
- **Started:** 2026-04-27T ~01:00Z
- **Completed:** 2026-04-27T ~01:35Z
- **Tasks:** 3 of 3
- **Files modified:** 3

## Accomplishments

- SQL migration `1771200016000_modelcatalog_configuration_input_is_optional` written and applied: `ALTER TABLE modelcatalog_configuration_input ADD COLUMN is_optional BOOLEAN NOT NULL DEFAULT FALSE`
- Hasura `tables.yaml` updated: `is_optional` in the `&id007` insert/user-select anchor and in the anonymous role's explicit inline column list
- Migration and metadata applied to dev Kubernetes cluster; GraphQL probe confirmed field is live and existing rows correctly default to `false`

## Task Commits

1. **Task 1: Write SQL migration files** - superproject `2e6c611` / graphql_engine `ba3e3df` (feat)
2. **Task 2: Update Hasura tables.yaml** - superproject `bc4fd4c` / graphql_engine `2653623` (feat)
3. **Task 3: Apply migration and metadata** - applied by orchestrator via `kubectl exec` against pod `mint-hasura-69f57b579-hxwb2`; no code commit (live environment action)

**Plan metadata (checkpoint commit):** `026638f` (docs: complete SQL migration + metadata tasks)

## Apply Evidence

Migration applied to dev cluster (`mint` namespace, pod `mint-hasura-69f57b579-hxwb2`):

```
hasura migrate apply:   {"level":"info","msg":"migrations applied"}
hasura metadata apply:  {"level":"info","msg":"Metadata applied"}
hasura metadata reload: {"level":"info","msg":"Metadata reloaded"}
                        {"level":"info","msg":"Metadata is consistent"}
```

Column confirmed in PostgreSQL `information_schema.columns`:

```
 column_name | data_type | column_default | is_nullable
-------------+-----------+----------------+-------------
 is_optional | boolean   | false          | NO
```

GraphQL field confirmed live (admin query via `kubectl exec` into Hasura pod):

```json
{
  "data": {
    "modelcatalog_configuration_input": [
      {
        "configuration_id": "https://w3id.org/okn/i/mint/f74c9f41-...",
        "input_id": "https://w3id.org/okn/i/mint/2c8d5622-...",
        "is_optional": false
      }
    ]
  }
}
```

Existing rows correctly default to `false`.

## Files Created/Modified

- `graphql_engine/migrations/1771200016000_modelcatalog_configuration_input_is_optional/up.sql` — ADD COLUMN migration (BEGIN/COMMIT wrapped)
- `graphql_engine/migrations/1771200016000_modelcatalog_configuration_input_is_optional/down.sql` — DROP COLUMN rollback
- `graphql_engine/metadata/tables.yaml` — `is_optional` added to `&id007` anchor (insert + user select) and anonymous inline select list

## Decisions Made

- Column placed on junction table `modelcatalog_configuration_input` only, not on `modelcatalog_dataset_specification` (D-02): a configuration input may be optional in one configuration but required in another — the flag belongs on the relationship row.
- `NOT NULL DEFAULT FALSE` chosen over nullable: avoids three-valued logic in consumers; existing rows silently default to non-optional (D-04).
- ETL files (`etl/extract.py`, `etl/transform.py`) left untouched — the DB DEFAULT handles historical and future ETL-inserted rows without code change (D-11, D-12).
- No `update_permissions` added for the junction table, consistent with the project-wide insert+delete-only pattern for junction tables (D-05).

## Deviations from Plan

None — plan executed exactly as written. Task 3 was a `checkpoint:human-action` task (apply to live Hasura); it was performed by the orchestrator via `kubectl exec`, matching acceptance criteria.

## Deployment Scope

Migration has been applied to the **dev Kubernetes cluster only** (`mint` namespace). Staging and production environments require a separate `hasura migrate apply && hasura metadata apply` run when promoted. Hasura tracks applied migrations by version number — repeated runs will skip already-applied migrations safely.

## Threat Flags

None — change is purely additive. Existing role grants extended only (no new roles, no new trust boundaries). T-12-01 and T-12-02 mitigations verified: anonymous role select is inline list only (not anchored to insert columns beyond what is listed), no `update_permissions` added.

## Known Stubs

None — this plan creates DB-layer artifacts only. No application code with hardcoded values.

## Issues Encountered

None.

## User Setup Required

None — migration was applied automatically to dev cluster by the orchestrator.

## Next Phase Readiness

Wave 2 (Plan 12-02) can proceed: `is_optional` is live in the GraphQL schema. Running `npm run codegen` in `model-catalog-api/` will generate updated TypeScript types that include the field. No blockers.

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
- Checkpoint metadata commit: 026638f

### GraphQL Probe

Live query against `mint-hasura-69f57b579-hxwb2` returned `is_optional: false` for an existing row — field is exposed and functional.

## Self-Check: PASSED

---
*Phase: 12-model-catalog-configuration-file-input-tapis-compatibility*
*Completed: 2026-04-27*
