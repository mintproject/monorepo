---
status: investigating
trigger: "Schema missing important properties from ontology"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:00:00Z
---

## Current Focus

hypothesis: Schema was created manually/selectively and didn't capture all properties defined in the ontology
test: Examine actual TriG data and latest ontology to identify what properties exist in data vs what's in schema
expecting: Will find properties in data/ontology that aren't mapped to SQL columns
next_action: Read sample TriG file to see actual property usage

## Symptoms

expected: Schema should include all important properties from OKN/MINT ontology
actual: Schema missing sd:author, sd:shortDescription, sdm:hasModelCategory, sdm:limitations, sdm:parameterization, sdm:runtimeEstimation, sdm:theoreticalBasis, and object properties for Process, Grid, Equation, Image, VariablePresentation. ModelConfiguration missing hasModelResultTable, hasCausalDiagram, hasOutputTimeInterval, hasRegion. ModelConfigurationSetup missing calibrationInterval, calibrationMethod, parameterAssignmentMethod, validUntil, calibratedVariable, calibrationTargetVariable. Parameter missing relevantForIntervention.
errors: None reported
reproduction: Compare up.sql schema against ontology properties
started: Discovered during migration review
symptoms_prefilled: true

## Eliminated

## Evidence

- timestamp: 2026-02-18T00:00:01Z
  checked: Current schema structure
  found: Schema has 6 main tables with basic properties, many reported properties missing
  implication: Schema was created with subset of available properties

- timestamp: 2026-02-18T00:00:02Z
  checked: Ontology 1.8.0 (model-catalog-ontology/release/1.8.0/ontology.ttl)
  found: All reported missing properties exist in ontology and are defined with proper domains/ranges
  implication: Schema intentionally excluded properties that ARE defined in the ontology

- timestamp: 2026-02-18T00:00:03Z
  checked: Actual TriG data in model-catalog-endpoint/data/model-catalog.trig
  found: Properties ARE being used in real data - hasProcess, hasGrid, hasCausalDiagram, hasOutputTimeInterval, parameterAssignmentMethod, calibrationTargetVariable all have instances
  implication: These are not theoretical properties - they have real production data

- timestamp: 2026-02-18T00:00:04Z
  checked: Object property usage patterns
  found: hasProcess points to Process entities (label+description), hasGrid points to Grid entities (hasDimension, hasShape, hasSpatialResolution), hasCausalDiagram points to CausalDiagram entities
  implication: Need separate tables for Process, Grid, Equation, Image, CausalDiagram, TimeInterval entities

- timestamp: 2026-02-18T00:00:05Z
  checked: Data property vs object property distinction
  found: Some properties are TEXT (limitations, parameterization, runtimeEstimation, theoreticalBasis, author, shortDescription, calibrationInterval, calibrationMethod, parameterAssignmentMethod, validUntil, hasModelResultTable). Some are object refs (calibratedVariable, calibrationTargetVariable point to VariablePresentation; hasProcess -> Process; hasGrid -> Grid)
  implication: Simple properties can be added as columns, object properties need junction tables or FK columns

- timestamp: 2026-02-18T00:00:06Z
  checked: relevantForIntervention on Parameter
  found: In actual data, parameters have relevantForIntervention pointing to Intervention entities
  implication: Need to capture this relationship (either as column or junction table)

## Resolution

root_cause: Schema migration created minimal viable schema focusing on core hierarchy and I/O relationships, but intentionally excluded many documented properties that are (1) defined in the SDM ontology and (2) actually used in production TriG data. This was likely a pragmatic first-pass approach, but results in significant data loss during RDF->SQL migration.

fix: Need to add missing columns and tables

verification: Compare ontology definitions + actual data usage + expected schema coverage

files_changed: []
