---
phase: 09-merge-modelconfiguration-setup-tables-and-migrate-thread-model-relationships
plan: "02"
subsystem: model-catalog-api
tags: [resource-registry, field-maps, table-merge, configuration]
dependency_graph:
  requires: []
  provides: [unified-configuration-api-layer]
  affects: [modelconfigurations, modelconfigurationsetups, configurationsetups]
tech_stack:
  added: []
  patterns: [self-referential-relationships, unified-table-mapping]
key_files:
  created: []
  modified:
    - model-catalog-api/src/mappers/resource-registry.ts
    - model-catalog-api/src/hasura/field-maps.ts
decisions:
  - "All three resource entries point to modelcatalog_configuration (unified table)"
  - "hasSetup uses child_configurations self-referential array relationship"
  - "modelConfiguration uses parent_configuration self-referential object relationship"
  - "All setup junction tables renamed to configuration_* prefix with configuration_id FK"
metrics:
  duration: "5 minutes"
  completed: "2026-04-05"
  tasks: 2
  files: 2
---

# Phase 9 Plan 02: Update API Resource Registry for Unified Configuration Table Summary

Updated model-catalog-api resource registry and field maps to reference the unified `modelcatalog_configuration` table, replacing separate `modelcatalog_model_configuration` and `modelcatalog_model_configuration_setup` table references with self-referential relationships.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update resource registry entries for unified configuration table | 85bcf66 | model-catalog-api/src/mappers/resource-registry.ts |
| 2 | Update field-maps.ts for unified configuration table | ddc94b2 | model-catalog-api/src/hasura/field-maps.ts |

## Changes Made

### resource-registry.ts

All three resource entries updated:

- **modelconfigurations**: `hasuraTable` changed from `modelcatalog_model_configuration` to `modelcatalog_configuration`. `hasSetup.hasuraRelName` changed from `setups` to `child_configurations`. `hasModelCategory` junction updated from `modelcatalog_modelconfiguration_category` (FK: `model_configuration_id`) to `modelcatalog_configuration_category` (FK: `configuration_id`).

- **modelconfigurationsetups**: `hasuraTable` changed from `modelcatalog_model_configuration_setup` to `modelcatalog_configuration`. `modelConfiguration.hasuraRelName` changed from `model_configuration` to `parent_configuration`. All seven junction relationships updated from `modelcatalog_setup_*` prefix (FK: `setup_id`) to `modelcatalog_configuration_*` prefix (FK: `configuration_id`).

- **configurationsetups**: Same changes as `modelconfigurationsetups` — `hasuraTable`, `modelConfiguration.hasuraRelName`, and all junction table names/FK columns updated.

### field-maps.ts

- Removed `modelcatalog_model_configuration` entry
- Removed `modelcatalog_model_configuration_setup` entry
- Added unified `modelcatalog_configuration` entry with superset of all columns: `id`, `software_version_id`, `model_configuration_id`, `label`, `description`, `keywords`, `usage_notes`, `has_component_location`, `has_implementation_script_location`, `has_software_image`, `has_model_result_table`, `has_region`, `author_id`, `calibration_interval`, `calibration_method`, `parameter_assignment_method`, `valid_until`
- Added self-referential relationships: `parent_configuration` (object) and `child_configurations` (array)
- Added `calibrated_variables` and `calibration_targets` junction traversals (previously setup-only)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All resource entries reference real table/relationship names as defined in the merged Hasura schema.

## Verification

- TypeScript build (`npm run build`) compiles without errors
- 0 occurrences of `modelcatalog_model_configuration` in resource-registry.ts
- 0 occurrences of `modelcatalog_setup_` in resource-registry.ts
- 0 occurrences of `modelcatalog_modelconfiguration_category` in resource-registry.ts
- 0 occurrences of `modelcatalog_modelconfigurationsetup_category` in resource-registry.ts
- 0 occurrences of `modelcatalog_model_configuration` in field-maps.ts
- `modelcatalog_configuration` entry present in field-maps.ts with required fields

## Self-Check: PASSED

Files exist and commits verified:
- model-catalog-api/src/mappers/resource-registry.ts: FOUND
- model-catalog-api/src/hasura/field-maps.ts: FOUND
- Commit 85bcf66: FOUND
- Commit ddc94b2: FOUND
