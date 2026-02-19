# Phase 01 Plan 05: ETL Extraction Extension Summary

**One-liner:** Extended ETL pipeline to extract all 16 entity types (6 original + 10 new), 20 relationship link sets (6 original + 14 new), and 11 new columns on existing entities from the RDF data source.

---

## Plan Reference

- **Phase:** 01-schema-and-data-migration
- **Plan:** 05
- **Type:** execute
- **Subsystem:** etl

---

## What Was Built

### Entities Created

**Files created:**
- None (extended existing files)

**Files modified:**
- `etl/config.py` - Added 10 new TYPE_ constants for new entity types
- `etl/extract.py` - Added 10 new extraction functions, extended 3 existing functions, updated extract_all()

### Key Components

**1. Type Constants (config.py)**
- Added 10 new TYPE_ constants matching RDF ontology types:
  - SD namespace (3): TYPE_PERSON, TYPE_IMAGE, TYPE_VARIABLE_PRESENTATION
  - SDM namespace (7): TYPE_MODEL_CATEGORY, TYPE_REGION, TYPE_PROCESS, TYPE_TIME_INTERVAL, TYPE_CAUSAL_DIAGRAM, TYPE_INTERVENTION, TYPE_GRID

**2. Entity Extraction Functions (extract.py)**
- Added 10 new extraction functions following established SPARQL query pattern:
  - `extract_persons()` - sd:Person entities with sd:name property
  - `extract_model_categories()` - sdm:ModelCategory with self-referential parent links
  - `extract_regions()` - sdm:Region with description and partOf self-reference
  - `extract_processes()` - sdm:Process entities
  - `extract_time_intervals()` - sdm:TimeInterval with intervalValue and intervalUnit
  - `extract_causal_diagrams()` - sdm:CausalDiagram with hasDiagramPart polymorphic links
  - `extract_images()` - sd:Image entities
  - `extract_variable_presentations()` - sd:VariablePresentation with long/short names and standard variable
  - `extract_interventions()` - sdm:Intervention entities
  - `extract_grids()` - sdm:Grid with dimension, shape, spatial resolution, and coordinate system

**3. Extended Existing Extraction Functions**
- `extract_software_versions()`:
  - Added 5 new columns: short_description, limitations, parameterization, runtime_estimation, theoretical_basis
  - Added 6 new link extractions: hasModelCategory, hasProcess, hasGrid, hasExplanationDiagram, hasInputVariable, hasOutputVariable
- `extract_model_configurations()`:
  - Added 1 new column: has_model_result_table
  - Added 3 new link extractions: hasCausalDiagram, hasOutputTimeInterval, hasRegion
- `extract_model_configuration_setups()`:
  - Added 5 new columns: author_id (single FK), calibration_interval, calibration_method, parameter_assignment_method, valid_until
  - Added 3 new link extractions: author (multi-valued for junction), calibratedVariable, calibrationTargetVariable
- `extract_parameters()`:
  - Added 1 new link extraction: relevantForIntervention

**4. Comprehensive extract_all() Function**
- Returns all 16 entity types in dict with descriptive keys (persons, model_categories, regions, etc.)
- Returns all 20 link sets organized by relationship type in 'links' dict
- Maintains backward compatibility with original 6 entity types and 6 link sets

---

## Decisions Made

| Decision | Rationale | Alternatives Considered |
|----------|-----------|-------------------------|
| Return all links as dicts keyed by source entity ID | Consistent with existing pattern in extract_software(), extract_software_versions(), etc. | Could have used list of tuples, but dict lookup is more efficient for load.py |
| Self-referential links (category parent, region partOf) returned separately | These represent FK relationships in the same table, not junction tables | Could have been embedded in entity dicts, but separate tracking allows flexible loading |
| CausalDiagram parts extracted without type discrimination | Type determination (Process vs VariablePresentation) deferred to load.py where entity existence can be checked | Could have used ASK queries to determine type during extraction, but would double query count |
| Author extracted both as single FK (author_id) and multi-valued links | Matches schema design with redundant author_id column + setup_author junction table for single/multi-valued optimization | N/A - decision inherited from 01-03 schema design |

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Testing Performed

**Import verification:**
- Verified all 10 new TYPE_ constants import without error from config.py
- Verified extract.py imports without syntax errors

**Function verification:**
- Confirmed all 16 extraction functions exist (6 original + 10 new)
- Confirmed extract_all() calls all 16 entity extraction functions
- Confirmed extract_all() returns all entity types and link sets in expected dict structure

**Pattern consistency:**
- All new extraction functions follow established SPARQL query pattern
- All link extractions use consistent dict structure keyed by source entity ID
- All entity dicts include 'id' and 'label' as base fields with optional properties

---

## Dependencies

**Requires (from previous plans):**
- 01-03: Extended schema migration with 10 new entity tables, 14 junction tables, 11 new columns
- Original entity extraction functions (plans 01-01, 01-02)

**Provides (for future plans):**
- Complete ETL extraction capability for all 16 entity types
- Link data for all 20 relationship sets (6 original + 14 new)
- New column values for existing entity types

**Affects:**
- Next plan (01-06): Will implement load.py to insert extracted data into PostgreSQL
- Phase 2 API plans: Will have access to all entity types and relationships through GraphQL

---

## Performance Notes

- Execution time: 251 seconds (4.2 minutes)
- Tasks completed: 2
- Files modified: 2
- Lines added: ~688 lines of extraction code

**Efficiency observations:**
- Each entity extraction function performs 1-2 SPARQL queries (entity query + optional link query)
- Total SPARQL queries in extract_all(): ~35 queries (reasonable for comprehensive extraction)
- No query optimization performed - future improvement could combine related queries

---

## Key Files

**Created:**
- None

**Modified:**
- `/Users/mosorio/repos/mint/etl/config.py` - TYPE_ constants
- `/Users/mosorio/repos/mint/etl/extract.py` - Extraction functions

**Referenced:**
- `/Users/mosorio/repos/mint/model-catalog-ontology/release/1.8.0/ontology.ttl` - RDF type definitions
- `/Users/mosorio/repos/mint/graphql_engine/migrations/1771105510000_modelcatalog_extended_schema/up.sql` - Target schema structure

---

## Tech Stack

**Added:**
- SPARQL queries for 10 new RDF entity types
- SPARQL queries for 14 new relationship patterns

**Patterns:**
- Consistent extraction function signature: `extract_*() -> List[Dict] | Tuple[List[Dict], Dict]`
- Self-referential relationship tracking via separate link dicts
- Polymorphic relationship extraction (CausalDiagram parts)
- Multi-valued relationship extraction for junction tables

---

## Tags

`etl` `sparql` `rdf` `extraction` `data-pipeline` `schema-extension`

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | a09ac27 | feat(01-05): add 10 new TYPE_ constants to config.py |
| 2 | bd95ef2 | feat(01-05): extend ETL extraction for all 16 entity types and 20 link sets |

---

## Self-Check: PASSED

**Created files:**
- None expected (modification plan)

**Modified files:**
- /Users/mosorio/repos/mint/etl/config.py: EXISTS
- /Users/mosorio/repos/mint/etl/extract.py: EXISTS

**Commits:**
- a09ac27: FOUND
- bd95ef2: FOUND

**Function verification:**
- 16 extraction functions: CONFIRMED
- extract_all() calls all functions: CONFIRMED
- All TYPE_ constants importable: CONFIRMED
- extract.py imports without errors: CONFIRMED

All deliverables verified and present.

---

**Completed:** 2026-02-19T02:27:12Z
**Duration:** 251 seconds
