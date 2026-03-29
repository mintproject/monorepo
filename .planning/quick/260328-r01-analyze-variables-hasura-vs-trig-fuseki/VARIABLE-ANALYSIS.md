# Variable Migration Analysis: TriG/Fuseki to Hasura

## Executive Summary

This document analyzes the migration of variable-related data from the MINT model catalog's original RDF/TriG representation (served by Apache Fuseki) to the current PostgreSQL-backed Hasura GraphQL API. The migration covers **VariablePresentation** entities and their relationships to SoftwareVersions and ModelConfigurationSetups via four junction tables.

Key findings:
- **605 VariablePresentation records** have been successfully migrated to PostgreSQL.
- **StandardVariable and Variable** types remain unmigrated -- they exist only as URI strings stored in the `has_standard_variable` column (313 distinct URIs referenced).
- **Unit entities** are likewise stored as URI strings (91 distinct unit URIs) rather than as a dedicated table.
- Junction table population is sparse in production data (primarily integration test rows), suggesting that relationship migration from TriG may be incomplete or that relationships were not widely used in the source data.

---

## TriG/Fuseki Data Model (RDF)

### Ontology Types

The MINT ontology defines three variable-related RDF types:

| RDF Type | Namespace | Purpose |
|----------|-----------|---------|
| `sd:VariablePresentation` | `https://w3id.org/okn/o/sd#` | Concrete variable instance with metadata (name, unit, description) |
| `sd:StandardVariable` | `https://w3id.org/okn/o/sd#` | Canonical variable definition (e.g., "Air Temperature") used for cross-model interoperability |
| `sd:Variable` | `https://w3id.org/okn/o/sd#` | Abstract base type |

### Scalar Properties on VariablePresentation

| RDF Predicate | Range | Description |
|---------------|-------|-------------|
| `rdfs:label` | `xsd:string` | Human-readable display name |
| `sd:description` | `xsd:string` | Free-text description of the variable |
| `sd:hasLongName` | `xsd:string` | Full variable name (e.g., "River discharge") |
| `sd:hasShortName` | `xsd:string` | Abbreviated name (e.g., "Q") |
| `sd:hasStandardVariable` | URI (`sd:StandardVariable`) | Reference to a canonical StandardVariable |
| `sd:usesUnit` | URI (`qudt:Unit`) | Reference to a unit of measurement |

### Relationship Properties (on Parent Entities)

| RDF Predicate | Domain | Range | Cardinality |
|---------------|--------|-------|-------------|
| `sdm:hasInputVariable` | `SoftwareVersion` | `VariablePresentation` | Many-to-many |
| `sdm:hasOutputVariable` | `SoftwareVersion` | `VariablePresentation` | Many-to-many |
| `sdm:calibratedVariable` | `ModelConfigurationSetup` | `VariablePresentation` | Many-to-many |
| `sdm:calibrationTargetVariable` | `ModelConfigurationSetup` | `VariablePresentation` | Many-to-many |

### Example RDF (TriG)

```turtle
<https://w3id.org/okn/i/mint/fsi_q>
    a sd:VariablePresentation ;
    rdfs:label "River discharge" ;
    sd:description "Volume rate of water flow..." ;
    sd:hasLongName "River discharge" ;
    sd:hasShortName "Q" ;
    sd:hasStandardVariable <https://w3id.org/okn/i/mint/CHANNEL_WATER__24-HOUR_...> ;
    sd:usesUnit <https://w3id.org/okn/i/mint/m%5E3%2Fs> .
```

### Source Files

Seven TriG files contain variable data across different MINT catalog partitions:

- `model-catalog.trig` -- Main production catalog
- `model-catalog-dev.trig` -- Development data
- `model-catalog-wifre.trig` -- WIFIRE project data
- `model-catalog-tacc.trig` -- TACC deployment data
- `dynamo-catalog.trig` -- DYNAMO project catalog
- `wifire-2023-09-22.trig` -- WIFIRE snapshot (Sep 2023)
- `wifire-2024-09.trig` -- WIFIRE snapshot (Sep 2024)

---

## Hasura Data Model (PostgreSQL)

### Main Table: `modelcatalog_variable_presentation`

| Column | Type | Constraint | Notes |
|--------|------|-----------|-------|
| `id` | TEXT | PRIMARY KEY | Full URI from RDF (e.g., `https://w3id.org/okn/i/mint/cycles_hx`) |
| `label` | TEXT | NOT NULL | Maps from `rdfs:label` |
| `description` | TEXT | nullable | Maps from `sd:description` |
| `has_long_name` | TEXT | nullable | Maps from `sd:hasLongName` |
| `has_short_name` | TEXT | nullable | Maps from `sd:hasShortName` |
| `has_standard_variable` | TEXT | nullable | Stores URI string -- no FK to a StandardVariable table |
| `uses_unit` | TEXT | nullable | Stores URI string -- no FK to a Unit table |

### Junction Tables (4)

**1. `modelcatalog_software_version_input_variable`**
| Column | Type | Constraint |
|--------|------|-----------|
| `software_version_id` | TEXT | FK to software_version |
| `variable_id` | TEXT | FK to variable_presentation |
| PK: `(software_version_id, variable_id)` | | |

**2. `modelcatalog_software_version_output_variable`**
| Column | Type | Constraint |
|--------|------|-----------|
| `software_version_id` | TEXT | FK to software_version |
| `variable_id` | TEXT | FK to variable_presentation |
| PK: `(software_version_id, variable_id)` | | |

**3. `modelcatalog_setup_calibrated_variable`**
| Column | Type | Constraint |
|--------|------|-----------|
| `setup_id` | TEXT | FK to model_configuration_setup |
| `variable_id` | TEXT | FK to variable_presentation |
| PK: `(setup_id, variable_id)` | | |

**4. `modelcatalog_setup_calibration_target`**
| Column | Type | Constraint |
|--------|------|-----------|
| `setup_id` | TEXT | FK to model_configuration_setup |
| `variable_id` | TEXT | FK to variable_presentation |
| PK: `(setup_id, variable_id)` | | |

### Polymorphic Table: `modelcatalog_diagram_part`

The `modelcatalog_diagram_part` table connects CausalDiagrams to both VariablePresentations and Processes using a `part_type` discriminator column:

| part_type | Count | Meaning |
|-----------|-------|---------|
| `variable` | 47 | Links to VariablePresentation |
| `process` | 32 | Links to Process |
| **Total** | **79** | |

---

## Property Mapping Table

| RDF Predicate | Hasura Column | Type Change | Notes |
|---------------|---------------|-------------|-------|
| URI subject | `id` (TEXT PK) | URI -> TEXT | Full URI preserved as primary key |
| `rdfs:label` | `label` (TEXT NOT NULL) | Literal -> TEXT | Direct mapping, NOT NULL enforced |
| `sd:description` | `description` (TEXT) | Literal -> TEXT | Direct mapping, nullable |
| `sd:hasLongName` | `has_long_name` (TEXT) | Literal -> TEXT | Direct mapping, nullable |
| `sd:hasShortName` | `has_short_name` (TEXT) | Literal -> TEXT | Direct mapping, nullable |
| `sd:hasStandardVariable` | `has_standard_variable` (TEXT) | URI -> TEXT | **Denormalized**: URI stored as string, no FK, no StandardVariable table |
| `sd:usesUnit` | `uses_unit` (TEXT) | URI -> TEXT | **Denormalized**: URI stored as string, no FK, no Unit table |

---

## Relationship Mapping

| RDF Predicate | Junction Table | Parent FK Column | Child FK Column | Direction |
|---------------|---------------|-----------------|----------------|-----------|
| `sdm:hasInputVariable` | `modelcatalog_software_version_input_variable` | `software_version_id` | `variable_id` | SoftwareVersion -> VariablePresentation |
| `sdm:hasOutputVariable` | `modelcatalog_software_version_output_variable` | `software_version_id` | `variable_id` | SoftwareVersion -> VariablePresentation |
| `sdm:calibratedVariable` | `modelcatalog_setup_calibrated_variable` | `setup_id` | `variable_id` | ModelConfigurationSetup -> VariablePresentation |
| `sdm:calibrationTargetVariable` | `modelcatalog_setup_calibration_target` | `setup_id` | `variable_id` | ModelConfigurationSetup -> VariablePresentation |

---

## Migration Gaps

### Not Migrated: StandardVariable

The `standardvariables` resource is registered in the API resource registry with `hasuraTable: null`. StandardVariable entities (which provide canonical, cross-model variable definitions like "Air Temperature" or "Soil Moisture") do not have their own PostgreSQL table. Instead, the URI is stored as a plain TEXT string in `variable_presentation.has_standard_variable`.

**Impact:**
- Cannot query "which models use the same standard variable?" without string matching on URIs
- No label/description/metadata for StandardVariables in the relational model
- 313 distinct StandardVariable URIs are referenced across 349 VariablePresentation rows

### Not Migrated: Variable (Abstract)

The `variables` resource is also registered with `hasuraTable: null`. The abstract `sd:Variable` type serves as a base class in the ontology but has no corresponding PostgreSQL table.

### Not Migrated: Unit Entities

Unit URIs (e.g., `https://w3id.org/okn/i/mint/m%5E3%2Fs`) are stored as TEXT strings in `uses_unit`. There is no `modelcatalog_unit` table. This means:
- No ability to query unit metadata (label, symbol, dimension)
- No referential integrity on unit references
- 91 distinct unit URIs are referenced across 476 VariablePresentation rows

### Sparse Junction Table Data

The junction tables contain very few rows (see Live Data Statistics below), with existing rows appearing to be integration test data rather than migrated production data. This suggests either:
1. The ETL pipeline has not yet been run with full relationship extraction from the TriG files, or
2. The source TriG data has very few explicit variable-to-parent relationships

---

## ETL Pipeline Overview

The ETL pipeline for variables follows a three-stage flow:

```
TriG Files (RDF)
     |
     v
[EXTRACT] -- SPARQL queries against Fuseki
     |
     |-- extract_variable_presentations()
     |   Returns: list of {id, label, description, has_long_name, has_short_name,
     |            has_standard_variable, uses_unit}
     |
     |-- SoftwareVersion link extraction
     |   Returns: {software_version_id -> [variable_ids]} for input/output
     |
     |-- ModelConfigurationSetup link extraction
     |   Returns: {setup_id -> [variable_ids]} for calibrated/target
     |
     v
[TRANSFORM] -- Python dict manipulation
     |
     |-- Flatten link dicts into junction table rows
     |   e.g., [(sv_id, var_id), (sv_id, var_id), ...]
     |
     |-- Handle FK dependency ordering
     |
     v
[LOAD] -- Hasura bulk insert via GraphQL mutations
     |
     |-- 1. Load modelcatalog_variable_presentation (must exist before junctions)
     |-- 2. Load junction tables (after parent tables exist):
     |       - software_version_input_variable
     |       - software_version_output_variable
     |       - setup_calibrated_variable
     |       - setup_calibration_target
```

**Key implementation details:**
- Extract uses SPARQL queries against the Fuseki endpoint
- Transform creates junction table rows from extracted link dictionaries
- Load respects FK dependency ordering (variable_presentation before junctions)

---

## Live Data Statistics

Queried from the PostgreSQL database (`localhost`, database `hasura`) on 2026-03-28:

### Row Counts

| Table | Row Count | Notes |
|-------|-----------|-------|
| `modelcatalog_variable_presentation` | **605** | Main entity table |
| `modelcatalog_software_version_input_variable` | **2** | Integration test data only |
| `modelcatalog_software_version_output_variable` | **0** | Empty |
| `modelcatalog_setup_calibrated_variable` | **2** | Integration test data only |
| `modelcatalog_setup_calibration_target` | **20** | Most-populated junction table |
| `modelcatalog_diagram_part` (variable type) | **47** | Polymorphic relationship |

### Column Completeness (out of 605 rows)

| Column | Populated | Percentage |
|--------|-----------|-----------|
| `label` | 605 | 100% (NOT NULL) |
| `description` | 537 | 88.8% |
| `has_short_name` | 401 | 66.3% |
| `has_standard_variable` | 349 | 57.7% |
| `has_long_name` | 296 | 48.9% |
| `uses_unit` | 476 | 78.7% |

### Reference Diversity

| Reference Type | Distinct Values | Rows Referencing |
|----------------|----------------|-----------------|
| StandardVariable URIs | 313 | 349 |
| Unit URIs | 91 | 476 |

### Sample Data

**Variable Presentations:**

| ID (short) | Label | Short Name | Standard Variable (short) | Unit |
|------------|-------|------------|--------------------------|------|
| `cycles_avg_no3_denit` | AVG NO3 DENIT | AVG NO3 DENIT | SOIL_NITROGEN__AVERAGE_OF_MASS_DENITRIFICATION_RATE | kg/yr |
| `cycles_hx` | RHx | RHx | ATMOSPHERE_AIR_WATER~VAPOR__MAX_OF_RELATIVE_SATURATION | Pa+Pa-1+x-100 |
| `modflow2005_dsys_compaction` | DSYS COMPACTION | DSYS COMPACTION | GROUND_INTERBED~DELAY__COMPACTION_LENGTH | mL |

**Junction Table Samples (integration test rows):**

Input variables: `integration-sv-test-* -> integration-vp2-test-*`
Calibrated variables: `integration-mcs-cv-test-* -> integration-cvp2-test-*`

---

## Recommendations

### 1. Create a StandardVariable Table (High Priority)

**Why:** 313 distinct StandardVariable URIs are referenced but have no metadata in the relational model. Cross-model variable matching (a core MINT feature) requires querying by standard variable, which currently means string-matching on URIs.

**Proposed table:**
```sql
CREATE TABLE modelcatalog_standard_variable (
    id TEXT PRIMARY KEY,         -- Full URI
    label TEXT NOT NULL,         -- e.g., "Air Temperature"
    description TEXT,
    long_name TEXT
);
```

Then add an FK from `variable_presentation.has_standard_variable` to this table.

### 2. Create a Unit Table (Medium Priority)

**Why:** 91 distinct unit URIs are referenced. A dedicated table would enable unit-based querying and provide human-readable labels (e.g., displaying "m^3/s" as "cubic meters per second").

**Proposed table:**
```sql
CREATE TABLE modelcatalog_unit (
    id TEXT PRIMARY KEY,         -- Full URI
    label TEXT NOT NULL,         -- e.g., "m^3/s"
    description TEXT
);
```

### 3. Investigate Junction Table Sparsity (High Priority)

**Why:** The 605 VariablePresentations are well-populated, but junction tables have near-zero production data. This likely indicates that the ETL relationship extraction from TriG needs to be run or debugged. The 20 rows in `setup_calibration_target` and the 2 rows elsewhere appear to be integration test artifacts.

**Action items:**
- Verify that the TriG source files contain `sdm:hasInputVariable` / `sdm:hasOutputVariable` relationships
- Check if the SPARQL extraction queries in `etl/extract.py` are correctly traversing these predicates
- Run a targeted ETL pass for junction table population

### 4. Consider Migrating the Variable Abstract Type (Low Priority)

The abstract `sd:Variable` type from the ontology has limited practical value in the relational model since VariablePresentation already captures all concrete variable instances. Unless the API needs to support querying abstract variables independently, this can be deferred.

### 5. Add Indexes for Common Query Patterns (Medium Priority)

Consider adding indexes for:
- `variable_presentation.has_standard_variable` -- for cross-model variable matching
- `variable_presentation.uses_unit` -- for unit-based filtering
- `variable_presentation.has_short_name` -- for search/autocomplete

---

## Appendix: API Resource Registry Status

| Resource | hasuraTable | Status |
|----------|------------|--------|
| `variablepresentations` | `modelcatalog_variable_presentation` | Fully migrated |
| `standardvariables` | `null` | NOT migrated |
| `variables` | `null` | NOT migrated |
