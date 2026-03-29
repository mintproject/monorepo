---
phase: 05-variable-migration-analysis-trig-fuseki-to-hasura
plan: 02
subsystem: etl
tags: [etl, extraction, sparql, standard-variable, unit, transform, load]
dependency_graph:
  requires: [05-01]
  provides: [StandardVariable extraction, Unit extraction, junction sparsity diagnostic]
  affects: [etl/config.py, etl/extract.py, etl/transform.py, etl/load.py]
tech_stack:
  added: []
  patterns: [SPARQL extraction, dedup-then-label pattern, FK-ordered load]
key_files:
  created: []
  modified:
    - etl/config.py
    - etl/extract.py
    - etl/transform.py
    - etl/load.py
decisions:
  - "Used qudt:Unit type URI (not sd:Unit) for Unit extraction per research finding"
  - "Placed standard_variable and unit before software_version in load_order (no FK deps)"
metrics:
  duration: 2 minutes
  completed: 2026-03-29
  tasks_completed: 2
  files_modified: 4
---

# Phase 05 Plan 02: StandardVariable and Unit ETL Extension Summary

ETL pipeline extended with SPARQL extraction for StandardVariable and Unit entities using correct type URIs, plus a junction sparsity diagnostic function.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add extraction functions for StandardVariable and Unit | 0b9647c | etl/config.py, etl/extract.py |
| 2 | Update transform and load for StandardVariable and Unit | 238f783 | etl/transform.py, etl/load.py |

## What Was Built

### Task 1 — config.py and extract.py

Added two type URI constants to `etl/config.py`:
- `TYPE_STANDARD_VARIABLE = f"{SD}StandardVariable"`
- `TYPE_UNIT = "http://qudt.org/1.1/schema/qudt#Unit"` (QUDT ontology, not sd:Unit)

Added three new functions to `etl/extract.py`:
- `extract_standard_variables(ds)` — SPARQL SELECT for `?id ?label ?description` where `?id a sd:StandardVariable`
- `extract_units(ds)` — SPARQL SELECT for `?id ?label` where `?id a qudt:Unit`
- `diagnose_junction_sparsity(ds)` — counts triples for hasInputVariable, hasOutputVariable, calibratedVariable, calibrationTargetVariable predicates (D-04 diagnostic)

Updated `extract_all()` to call all three functions and return `standard_variables` and `units` in the result dict.

### Task 2 — transform.py and load.py

Updated `transform_all()` in `etl/transform.py`:
- Runs `deduplicate_by_id()` and `ensure_labels()` on both new entity types
- Builds `valid_standard_variable_ids` and `valid_unit_ids` sets for future FK validation
- Adds `modelcatalog_standard_variable` and `modelcatalog_unit` to the result dict

Updated `etl/load.py`:
- `clear_all()` TRUNCATE list includes both new tables
- `load_order` places `modelcatalog_standard_variable` and `modelcatalog_unit` before `modelcatalog_software_version` (no FK dependencies)

## Deviations from Plan

None - plan executed exactly as written.

The plan mentioned adding new tables "BEFORE `modelcatalog_variable_presentation`" in load_order, but that table does not exist yet. The new tables were placed in the correct logical position (no FK deps, alongside dataset_specification and parameter) which achieves the same intent.

## Known Stubs

None. Both entity types are fully wired from extraction through transformation to load.

## Self-Check: PASSED

- etl/config.py contains TYPE_STANDARD_VARIABLE and TYPE_UNIT
- etl/extract.py contains extract_standard_variables, extract_units, diagnose_junction_sparsity
- etl/extract.py extract_all() returns 'standard_variables' and 'units' keys
- etl/transform.py adds modelcatalog_standard_variable and modelcatalog_unit to result
- etl/load.py clear_all() truncates both new tables
- etl/load.py load_order has both new tables (lines 98-99) before software_version (line 101)
- Commit 0b9647c: feat(05-02): add StandardVariable and Unit extraction functions
- Commit 238f783: feat(05-02): add StandardVariable and Unit to transform and load
