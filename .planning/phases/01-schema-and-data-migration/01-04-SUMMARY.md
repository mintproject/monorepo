---
phase: 01-schema-and-data-migration
plan: 04
subsystem: hasura-metadata
tags: [metadata, relationships, permissions, graphql-schema]
dependency-graph:
  requires: [01-03-extended-schema]
  provides: [hasura-tracking-complete, graphql-api-extended]
  affects: [graphql-queries, nested-queries, relationship-traversal]
tech-stack:
  added: []
  patterns: [bidirectional-relationships, junction-table-tracking, permission-replication]
key-files:
  created: []
  modified:
    - path: graphql_engine/metadata/tables.yaml
      lines-added: 767
      summary: Added metadata for 24 new tables and updated 4 existing tables with relationships and columns
decisions:
  - context: Hasura metadata structure
    choice: Follow existing pattern of anonymous + user permissions with unrestricted read (filter: {})
    rationale: Maintains consistency with existing modelcatalog tables and current security model
  - context: Junction table relationships
    choice: Bidirectional object_relationships on junction tables pointing to both parent entities
    rationale: Enables nested GraphQL queries in both directions through junction tables
  - context: Array relationship naming
    choice: Plural descriptive names (e.g., "categories", "explanation_diagrams", "calibrated_variables")
    rationale: Makes GraphQL queries more intuitive and follows Hasura conventions
metrics:
  duration: 240s
  completed: 2026-02-18
---

# Phase 01 Plan 04: Hasura Metadata Tracking Summary

**One-liner:** Tracked 24 new modelcatalog tables and updated 4 existing tables in Hasura metadata, exposing extended schema through GraphQL API with full relationship traversal.

## What Was Accomplished

Updated Hasura metadata (tables.yaml) to track all tables from the extended schema migration (01-03), enabling GraphQL access to 10 new entity tables and 14 new junction tables. Updated existing table entries with new relationships and columns.

**Tables added to metadata (24):**
- 10 entity tables: person, model_category, region, process, time_interval, causal_diagram, image, variable_presentation, intervention, grid
- 14 junction tables: software_version_category, software_version_process, software_version_grid, software_version_image, software_version_input_variable, software_version_output_variable, configuration_causal_diagram, configuration_time_interval, configuration_region, setup_author, setup_calibrated_variable, setup_calibration_target, parameter_intervention, diagram_part

**Tables updated (4):**
- modelcatalog_software_version: +6 array_relationships, +5 columns
- modelcatalog_model_configuration: +3 array_relationships, +1 column
- modelcatalog_model_configuration_setup: +1 object_relationship, +3 array_relationships, +5 columns
- modelcatalog_parameter: +1 array_relationship

**Total modelcatalog tables in metadata:** 36 (12 original + 24 new)

## Task Breakdown

### Task 1: Update existing table entries in tables.yaml
**Status:** Complete
**Commit:** b1caa12

Updated 4 existing modelcatalog table entries to add relationships to new junction tables and expose new columns from extended schema migration.

**Changes:**
1. **modelcatalog_software_version**
   - Added 6 array_relationships: categories, processes, grids, explanation_diagrams, input_variables, output_variables
   - Added 5 columns to permissions: short_description, limitations, parameterization, runtime_estimation, theoretical_basis

2. **modelcatalog_model_configuration**
   - Added 3 array_relationships: causal_diagrams, time_intervals, regions
   - Added 1 column to permissions: has_model_result_table

3. **modelcatalog_model_configuration_setup**
   - Added 1 object_relationship: author (modelcatalog_person via author_id FK)
   - Added 3 array_relationships: authors, calibrated_variables, calibration_targets
   - Added 5 columns to permissions: author_id, calibration_interval, calibration_method, parameter_assignment_method, valid_until

4. **modelcatalog_parameter**
   - Added 1 array_relationship: interventions

**Verification:** All relationships point to correct junction tables, all new columns exposed in both anonymous and user select_permissions.

### Task 2: Add new entity and junction table entries to tables.yaml
**Status:** Complete
**Commit:** de752ad

Added metadata entries for all 24 new tables from extended schema migration. Each entry follows existing modelcatalog table structure with appropriate relationships and permissions.

**Entity tables (10):**
- All have select_permissions for anonymous and user roles
- All have appropriate array_relationships to junction tables
- Self-referential tables (model_category, region) have both object_relationship (parent) and array_relationship (children)

**Junction tables (14):**
- All have 2 object_relationships to parent entities (except diagram_part with 1)
- All have select_permissions for anonymous and user roles with all FK columns exposed
- All use `filter: {}` for unrestricted read access

**Verification:** YAML is valid, all 36 modelcatalog tables present, no duplicates, all relationships correctly configured.

## Deviations from Plan

None - plan executed exactly as written.

## Key Relationships Enabled

**Software/SoftwareVersion level:**
- SoftwareVersion → Categories (hierarchical)
- SoftwareVersion → Processes (flat)
- SoftwareVersion → Grids (flat)
- SoftwareVersion → Images (as explanation diagrams)
- SoftwareVersion → VariablePresentation (input/output variables)

**Configuration level:**
- ModelConfiguration → CausalDiagrams
- ModelConfiguration → TimeIntervals
- ModelConfiguration → Regions (hierarchical)

**Setup level:**
- Setup → Person (single author via FK + multi-valued authors via junction)
- Setup → VariablePresentation (calibrated variables + calibration targets)

**Parameter level:**
- Parameter → Interventions

**Hierarchical entities:**
- ModelCategory → ModelCategory (parent/subcategories)
- Region → Region (part_of/subregions)

## GraphQL Query Capabilities Unlocked

All relationships are now queryable in both directions through the GraphQL API:

```graphql
# Forward: From software version to categories
query {
  modelcatalog_software_version {
    label
    categories {
      category { label }
    }
  }
}

# Reverse: From category to software versions
query {
  modelcatalog_model_category {
    label
    software_versions {
      software_version { label }
    }
  }
}

# Nested: Setup with author and calibrated variables
query {
  modelcatalog_model_configuration_setup {
    label
    author { name }
    authors { person { name } }
    calibrated_variables {
      variable { label, uses_unit }
    }
  }
}
```

## Verification Results

All verification checks passed:

1. ✓ tables.yaml is valid YAML
2. ✓ 36 modelcatalog tables tracked (12 original + 24 new)
3. ✓ All tables have anonymous and user select_permissions
4. ✓ All junction tables have correct object_relationships (14 with 2 rels, 1 with 1 rel)
5. ✓ Existing tables updated with new array_relationships
6. ✓ New columns exposed in select_permissions
7. ✓ No duplicated table entries

## Impact

**Before:** 12 modelcatalog tables tracked, basic schema only
**After:** 36 modelcatalog tables tracked, full extended schema accessible via GraphQL

**Relationship graph:** Complete bidirectional traversal through all junction tables enables nested GraphQL queries across the entire modelcatalog schema.

**Next steps:** Ready for ETL pipeline (Phase 01-05+) to populate new tables with data from RDF Fuseki triplestore.

## Self-Check: PASSED

Checking created/modified files exist:
- graphql_engine/metadata/tables.yaml: EXISTS (modified)

Checking commits exist:
- b1caa12: EXISTS (Task 1 - update existing tables)
- de752ad: EXISTS (Task 2 - add new tables)

All files and commits verified.
