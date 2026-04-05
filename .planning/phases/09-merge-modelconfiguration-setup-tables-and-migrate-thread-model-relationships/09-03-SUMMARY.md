---
phase: 09-merge-modelconfiguration-setup-tables-and-migrate-thread-model-relationships
plan: "03"
subsystem: database
tags: [etl, python, postgresql, rdflib, sparql]

requires:
  - phase: 01-schema-and-data-migration
    provides: ETL pipeline structure (extract/transform/load pattern)

provides:
  - Unified extract_configurations() function merging ModelConfiguration and ModelConfigurationSetup extraction
  - transform_all() produces modelcatalog_configuration key (column superset)
  - load.py configured for two-pass self-referential loading of modelcatalog_configuration
  - All junction table references use new names: modelcatalog_configuration_category, modelcatalog_configuration_calibrated_variable, modelcatalog_configuration_calibration_target

affects: [09-merge-modelconfiguration-setup-tables]

tech-stack:
  added: []
  patterns:
    - "Unified extraction: both entity types extracted into single list with superset columns"
    - "Self-referential self-FK embedded at extract time (model_configuration_id populated from hasSetup links)"
    - "Merged junction dicts keyed by unified entity id (not type-specific)"

key-files:
  created: []
  modified:
    - etl/extract.py
    - etl/transform.py
    - etl/load.py

key-decisions:
  - "extract_configurations() extracts both entity types in a single pass and returns merged junction dicts; model_configuration_id self-FK set directly from hasSetup RDF triples"
  - "Configuration entities get model_configuration_id=None; Setup entities get model_configuration_id=<parent_config_uri>"
  - "setup_* junction tables removed from load_order; data flows through unified configuration_* tables"
  - "Fallback to legacy links structure in transform.py when configuration_links is empty (backward compat)"

requirements-completed: [D-09]

duration: 8min
completed: 2026-04-05
---

# Phase 09 Plan 03: ETL Unified Configuration Extraction and Load Summary

**Merged ModelConfiguration and ModelConfigurationSetup ETL into unified modelcatalog_configuration table with two-pass self-referential loading and consolidated junction tables**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-05T19:12:00Z
- **Completed:** 2026-04-05T19:19:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `extract_configurations()` function that extracts both ModelConfiguration and ModelConfigurationSetup entities into a single unified list with superset columns and self-FK populated from `hasSetup` RDF triples
- Updated `transform.py` to produce `modelcatalog_configuration` as the primary entity table key (replacing separate `modelcatalog_model_configuration` and `modelcatalog_model_configuration_setup` keys)
- Updated `load.py` with new `self_referential_tables` entry for `modelcatalog_configuration`, updated `load_order` using new table names, and updated `clear_all()` to truncate new tables

## Task Commits

1. **Task 1: Merge ETL extraction functions into unified extract_configurations()** - `e0906b6` (feat)
2. **Task 2: Update ETL transform and load for unified table and junction names** - `2e0cf02` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `/Users/mosorio/repos/mint/etl/extract.py` - Added `extract_configurations()` function; updated `extract_all()` to include `configurations` and `configuration_links` keys in return dict
- `/Users/mosorio/repos/mint/etl/transform.py` - Updated `build_junction_tables()` to use merged configuration links; updated `build_extended_junction_tables()` to use `configuration_id` FK and produce merged category/calibration junctions; updated `transform_all()` to produce `modelcatalog_configuration`
- `/Users/mosorio/repos/mint/etl/load.py` - Updated `clear_all()`, `self_referential_tables`, and `load_order` with new table names

## Decisions Made
- `extract_configurations()` embedded the self-FK (`model_configuration_id`) directly at extraction time by querying `hasSetup` links and populating each setup entity's field. This avoids the old `invert_fk_relationships` approach for this specific relationship.
- Kept legacy `extract_model_configurations()` and `extract_model_configuration_setups()` calls in `extract_all()` for backward-compatibility with `transform.py`'s `invert_fk_relationships()` helper (which still needs `model_configurations` and `model_configuration_setups` keys).
- Fallback logic added in transform functions: if `configuration_links` key is empty, fall back to merging legacy link dicts to ensure the pipeline still works if called without the unified extraction.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs
None — no hardcoded placeholders or empty values that flow to UI rendering.

## Next Phase Readiness
- ETL pipeline is ready to load into the new `modelcatalog_configuration` table once the Hasura migration (Plan 01) creates the table
- Junction tables in `clear_all()` and `load_order` reference the merged names matching the new schema
- Plan 04 (Hasura metadata) and Plan 02 (API layer) can proceed in parallel

---
*Phase: 09-merge-modelconfiguration-setup-tables-and-migrate-thread-model-relationships*
*Completed: 2026-04-05*
