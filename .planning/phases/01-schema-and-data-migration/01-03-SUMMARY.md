---
phase: 01-schema-and-data-migration
plan: 03
subsystem: database-schema
tags: [hasura, postgresql, migration, graphql, schema-extension]
dependency-graph:
  requires:
    - modelcatalog_* core tables from 01-01
  provides:
    - 10 new entity tables (Person, ModelCategory, Region, Process, TimeInterval, CausalDiagram, Image, VariablePresentation, Intervention, Grid)
    - 14 junction tables for many-to-many object properties
    - 11 new columns on existing tables
    - 31 FK indexes for query performance
  affects:
    - graphql_engine/migrations/1771105510000_modelcatalog_extended_schema/
tech-stack:
  added:
    - Extended PostgreSQL schema (24 new tables, 11 columns)
    - Indexes on all FK columns including self-referential relationships
  patterns:
    - Self-referential FKs (ModelCategory.parent_category_id, Region.part_of_id)
    - Polymorphic junction table (modelcatalog_diagram_part with part_type discriminator)
    - Redundant FK column + junction table (author_id + modelcatalog_setup_author for single/multi-valued cases)
key-files:
  created:
    - graphql_engine/migrations/1771105510000_modelcatalog_extended_schema/up.sql
    - graphql_engine/migrations/1771105510000_modelcatalog_extended_schema/down.sql
  modified: []
decisions:
  - Created redundant author_id FK column alongside modelcatalog_setup_author junction table to optimize single-author case while supporting multi-valued authors
  - Used polymorphic junction table (modelcatalog_diagram_part) with part_type discriminator for CausalDiagram parts (can be VariablePresentation or Process)
  - Made all new columns on existing tables nullable since data is already loaded in production
  - Used TEXT for interval_value to handle both integer and string values from ontology
metrics:
  duration: 132
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  completed_date: 2026-02-18T22:20:42Z
---

# Phase 01 Plan 03: Extended Schema Migration Summary

**One-liner:** Additive PostgreSQL migration adding 10 entity tables, 14 junction tables, and 11 columns to cover all SDM 1.8.0 ontology entities and properties identified in UAT gap analysis

## What Was Built

Created additive migration extending the base modelcatalog schema (01-01) to cover all ontology entities actively used in production TriG data:

### New Entity Tables (10 tables)

**Reference Data:**
1. `modelcatalog_person` - Authors (sd:Person with name property)
2. `modelcatalog_model_category` - Hierarchical categories with parent_category_id self-reference
3. `modelcatalog_region` - Hierarchical regions with part_of_id self-reference
4. `modelcatalog_process` - Model processes
5. `modelcatalog_time_interval` - Time intervals with interval_value and interval_unit

**Visualization & Documentation:**
6. `modelcatalog_causal_diagram` - Causal diagrams
7. `modelcatalog_image` - Explanation diagrams and images

**Variables & Configuration:**
8. `modelcatalog_variable_presentation` - Variable metadata with standard_variable, units, long/short names
9. `modelcatalog_intervention` - Intervention scenarios
10. `modelcatalog_grid` - Grid specifications (distinct from generic DatasetSpecification)

### New Columns on Existing Tables (11 columns)

**modelcatalog_software_version (5 columns):**
- short_description, limitations, parameterization, runtime_estimation, theoretical_basis

**modelcatalog_model_configuration (1 column):**
- has_model_result_table

**modelcatalog_model_configuration_setup (5 columns):**
- author_id (FK to Person), calibration_interval, calibration_method, parameter_assignment_method, valid_until

### Junction Tables (14 tables)

**SoftwareVersion level (6 tables):**
- `modelcatalog_software_version_category` - hasModelCategory
- `modelcatalog_software_version_process` - hasProcess
- `modelcatalog_software_version_grid` - hasGrid
- `modelcatalog_software_version_image` - hasExplanationDiagram
- `modelcatalog_software_version_input_variable` - hasInputVariable
- `modelcatalog_software_version_output_variable` - hasOutputVariable

**Configuration level (3 tables):**
- `modelcatalog_configuration_causal_diagram` - hasCausalDiagram
- `modelcatalog_configuration_time_interval` - hasOutputTimeInterval
- `modelcatalog_configuration_region` - hasRegion

**Setup level (3 tables):**
- `modelcatalog_setup_author` - sd:author (multi-valued)
- `modelcatalog_setup_calibrated_variable` - calibratedVariable
- `modelcatalog_setup_calibration_target` - calibrationTargetVariable

**Parameter level (1 table):**
- `modelcatalog_parameter_intervention` - relevantForIntervention

**CausalDiagram level (1 polymorphic table):**
- `modelcatalog_diagram_part` - hasDiagramPart (with part_type CHECK constraint for 'variable' or 'process')

### Indexes (31 total)

- 2 self-referential FK indexes (parent_category_id, part_of_id)
- 1 author_id FK index on model_configuration_setup
- 28 junction table FK indexes (2 per junction table × 14 tables)

## Commits

| Commit  | Type | Description                                   |
| ------- | ---- | --------------------------------------------- |
| 1be3ae0 | feat | Create extended schema migration (up.sql)     |
| 31f65cd | feat | Create rollback migration (down.sql)          |

## Technical Decisions

### 1. Redundant author_id Column + Junction Table
**Decision:** Created both `author_id` FK column on `modelcatalog_model_configuration_setup` AND `modelcatalog_setup_author` junction table.

**Rationale:** Most setups have 0-1 authors (common case), but the ontology allows multi-valued authors. The FK column optimizes GraphQL queries for the single-author case (`setup.author { name }`), while the junction table supports multi-valued cases (`setup.authors { name }`). Both will be populated by the ETL script.

**Trade-off:** Slight data redundancy vs. significant query performance improvement for common case.

### 2. Polymorphic Junction Table for Diagram Parts
**Decision:** Used single `modelcatalog_diagram_part` table with `part_type` TEXT discriminator instead of separate `diagram_variable_part` and `diagram_process_part` tables.

**Rationale:** The ontology defines `sdm:hasDiagramPart` with range `sd:VariablePresentation OR sdm:Process`. A polymorphic table with CHECK constraint (`part_type IN ('variable', 'process')`) models this accurately without redundant table structures.

**Alternative considered:** Two separate junction tables. Rejected as over-normalization; GraphQL queries can filter by part_type.

### 3. Nullable Columns on Existing Tables
**Decision:** All 11 new columns added via ALTER TABLE are nullable (no NOT NULL constraints).

**Rationale:** Migration 01-01 already loaded production data into core tables. Adding NOT NULL columns would fail or require default values. These properties are optional in the ontology, so nullable is semantically correct.

### 4. TEXT for interval_value
**Decision:** Used TEXT for `modelcatalog_time_interval.interval_value` instead of INTEGER.

**Rationale:** The ontology defines `sdm:intervalValue` as `xsd:string OR xsd:int`. Production TriG data contains both integer values (e.g., "1") and string values (e.g., "P1M" for ISO 8601 durations). TEXT accommodates both.

**Alternative considered:** Separate integer_value and string_value columns. Rejected as unnecessary complexity.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All plan verification criteria passed:

1. Migration directory exists: `/Users/mosorio/repos/mint/graphql_engine/migrations/1771105510000_modelcatalog_extended_schema/`
2. up.sql contains 24 CREATE TABLE statements (10 entity + 14 junction)
3. up.sql contains 3 ALTER TABLE statements
4. up.sql contains 11 ADD COLUMN statements
5. up.sql contains 31 CREATE INDEX statements
6. up.sql has no DROP or ALTER COLUMN statements (purely additive)
7. up.sql starts with BEGIN and ends with COMMIT
8. down.sql exists and properly reverses all changes
9. down.sql drops junction tables before entity tables (correct dependency order)
10. down.sql drops index on author_id before dropping the column

## Coverage Analysis

**Entities from UAT gap now covered:**
- ModelCategory ✓
- Region ✓
- Person ✓
- Process ✓
- TimeInterval ✓
- CausalDiagram ✓
- Image ✓
- VariablePresentation ✓
- Intervention ✓
- Grid ✓

**Properties from UAT gap now covered:**
- Software/Model properties: short_description, limitations, parameterization, runtime_estimation, theoretical_basis ✓
- Configuration properties: has_model_result_table ✓
- Setup properties: author (FK + junction), calibration_interval, calibration_method, parameter_assignment_method, valid_until ✓
- Object properties: hasModelCategory, hasProcess, hasGrid, hasExplanationDiagram, hasInputVariable, hasOutputVariable, hasCausalDiagram, hasOutputTimeInterval, hasRegion, calibratedVariable, calibrationTargetVariable, relevantForIntervention, hasDiagramPart ✓

## Next Steps

**Immediate (Plan 01-04):** Update ETL pipeline (01-02) to:
- Extract and load 10 new entity types from TriG data
- Populate 11 new columns on existing entities
- Create 14 junction table relationships
- Validate that all production data properties are captured

**Blocked by this plan:** Plan 01-04 cannot populate extended schema without these tables.

## Self-Check

Verifying all claimed artifacts exist:

- Migration directory exists: `/Users/mosorio/repos/mint/graphql_engine/migrations/1771105510000_modelcatalog_extended_schema/`
- up.sql file exists and contains 24 CREATE TABLE statements
- down.sql file exists and contains 24 DROP TABLE statements
- Commit 1be3ae0 exists in git history (graphql_engine submodule)
- Commit 31f65cd exists in git history (graphql_engine submodule)

## Self-Check: PASSED

All files and commits verified.
