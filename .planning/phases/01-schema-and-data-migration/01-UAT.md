---
status: diagnosed
phase: 01-schema-and-data-migration
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md]
started: 2026-02-15T00:00:00Z
updated: 2026-02-18T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Software listing with labels
expected: Query returns software entities with all ontology properties populated
result: issue
reported: "Schema missing important properties from ontology: sd:author, sd:shortDescription, sdm:hasModelCategory, sdm:limitations, sdm:parameterization, sdm:runtimeEstimation, sdm:theoreticalBasis, and object properties for Process, Grid, Equation, Image, VariablePresentation. Also missing on ModelConfiguration: hasModelResultTable, hasCausalDiagram, hasOutputTimeInterval, hasRegion. On ModelConfigurationSetup: calibrationInterval, calibrationMethod, parameterAssignmentMethod, validUntil, calibratedVariable, calibrationTargetVariable. On Parameter: relevantForIntervention."
severity: major

### 2. Full 4-level hierarchy traversal
expected: Nested query returns software -> versions -> configurations -> setups with data at each level
result: pass

### 3. Configuration inputs and outputs via junction tables
expected: Configurations show linked dataset specifications through junction tables
result: pass

### 4. Parameters linked to configurations
expected: Configuration parameters return with data type, default value, and position
result: pass

### 5. Setup-level I/O override
expected: Setups have their own inputs/outputs independent of parent configuration
result: pass

### 6. Parameter type discrimination
expected: Parameters include both standard and adjustment types
result: pass

### 7. Orphan entity handling
expected: Software versions with null software_id still appear in queries
result: pass

### 8. Rollback migration
expected: down.sql drops all tables cleanly without errors
result: pass

## Summary

total: 8
passed: 7
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "All modelcatalog_* tables capture the full ontology properties for each entity type"
  status: failed
  reason: "User reported: Schema missing important properties from ontology including sd:author, sd:shortDescription, sdm:hasModelCategory on Software; hasModelResultTable, hasCausalDiagram, hasOutputTimeInterval on ModelConfiguration; calibrationInterval, calibrationMethod, parameterAssignmentMethod, validUntil on ModelConfigurationSetup; relevantForIntervention on Parameter. Additional entity tables needed: ModelCategory, Region (as proper table), Person/Author, Process, TimeInterval, Image, Equation, Grid, VariablePresentation, Intervention."
  severity: major
  test: 1
  root_cause: "Schema migration created minimal viable schema covering core hierarchy and I/O but excluded many ontology properties that are defined in SDM 1.8.0 ontology and actively used in production TriG data. Verified against model-catalog-ontology/release/1.8.0/ontology.ttl and model-catalog-endpoint/data/model-catalog.trig."
  artifacts:
    - path: "graphql_engine/migrations/1771105509000_modelcatalog_schema/up.sql"
      issue: "Missing columns on existing tables and missing entire entity tables"
    - path: "model-catalog-ontology/release/1.8.0/ontology.ttl"
      issue: "Authoritative source for property definitions"
    - path: "model-catalog-endpoint/data/model-catalog.trig"
      issue: "Production data using all reported missing properties"
  missing:
    - "Add columns to modelcatalog_software_version: limitations, parameterization, runtime_estimation, theoretical_basis, short_description"
    - "Add columns to modelcatalog_model_configuration: has_model_result_table"
    - "Add columns to modelcatalog_model_configuration_setup: author, calibration_interval, calibration_method, parameter_assignment_method, valid_until"
    - "New entity tables: modelcatalog_model_category, modelcatalog_process, modelcatalog_grid, modelcatalog_equation, modelcatalog_image, modelcatalog_causal_diagram, modelcatalog_time_interval, modelcatalog_variable_presentation, modelcatalog_intervention"
    - "New junction tables for many-to-many object properties (hasProcess, hasGrid, hasEquation, hasCausalDiagram, hasOutputTimeInterval, calibratedVariable, calibrationTargetVariable, relevantForIntervention)"
  debug_session: ".planning/debug/schema-missing-properties.md"
