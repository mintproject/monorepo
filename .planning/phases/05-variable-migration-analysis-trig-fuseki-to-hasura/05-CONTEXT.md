# Phase 5: Variable Migration Analysis: TriG/Fuseki to Hasura - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the variable ecosystem migration: create PostgreSQL tables for StandardVariable and Unit entities (and Variable if data exists), add FK constraints from variable_presentation, fix ETL pipeline to populate all junction tables from TriG source data, and integrate new entities into the REST API with full CRUD and bidirectional relationship traversal.

</domain>

<decisions>
## Implementation Decisions

### Migration Scope
- **D-01:** Create `modelcatalog_standard_variable` table — 313 distinct URIs referenced by 349 VariablePresentations. Enables cross-model variable matching.
- **D-02:** Create `modelcatalog_unit` table — 91 distinct unit URIs referenced by 476 VariablePresentations. Enables unit metadata display.
- **D-03:** Create `modelcatalog_variable` table ONLY if TriG source files contain actual `sd:Variable` instances that are not already StandardVariable or VariablePresentation. Research phase must investigate.

### Junction Population
- **D-04:** Investigate TriG source files for `sdm:hasInputVariable`, `sdm:hasOutputVariable`, `sdm:calibratedVariable`, `sdm:calibrationTargetVariable` relationships. Fix ETL extraction if relationships exist but aren't being extracted. Current state: 4 junction tables nearly empty (2-20 rows) despite 605 VariablePresentations.
- **D-05:** Single comprehensive ETL update: extract StandardVariable metadata + Unit metadata + populate all junction tables in one pass. No separate ETL runs.

### API Integration
- **D-06:** Full CRUD endpoints for StandardVariable, Unit, and Variable (if table created per D-03). Same permission model as other modelcatalog entities (insert+update+delete for entity tables).
- **D-07:** Bidirectional relationship traversal: StandardVariable <-> VariablePresentation and Unit <-> VariablePresentation. Matches existing bidirectional junction pattern established in Phase 1.

### Schema Design
- **D-08:** Add FK constraints: `variable_presentation.has_standard_variable` -> `modelcatalog_standard_variable.id` and `variable_presentation.uses_unit` -> `modelcatalog_unit.id`. Full referential integrity.
- **D-09:** StandardVariable and Unit table schemas match whatever scalar properties exist on the corresponding RDF types in the TriG source data. Research phase extracts actual properties from the ontology/data.

### Claude's Discretion
- Index strategy for new tables and FK columns (common query patterns)
- Hasura metadata configuration details (relationship names, permissions)
- ETL implementation details (SPARQL queries, transform logic)
- Migration ordering (tables before FKs, entities before junctions)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Variable Analysis
- `.planning/quick/260328-r01-analyze-variables-hasura-vs-trig-fuseki/VARIABLE-ANALYSIS.md` — Comprehensive analysis of current state: 605 VPs migrated, 313 StandardVariable URIs, 91 Unit URIs, junction table sparsity, ETL pipeline overview, and proposed table schemas

### ETL Pipeline
- `etl/extract.py` — SPARQL extraction functions including `extract_variable_presentations()` (line ~1160)
- `etl/transform.py` — Transform logic for junction table row generation
- `etl/load.py` — Hasura bulk insert via GraphQL mutations

### API Layer
- `model-catalog-api/src/mappers/resource-registry.ts` — Resource registry with `standardvariables` and `variables` entries (currently `hasuraTable: null`, lines ~947-975)

### Hasura Schema
- `graphql_engine/migrations/` — Existing Hasura migrations (pattern to follow for new tables)
- `graphql_engine/metadata/` — Hasura metadata for table tracking, relationships, permissions

### TriG Source Data
- Seven TriG files in the data directory containing variable data across MINT catalog partitions (model-catalog.trig, model-catalog-dev.trig, model-catalog-wifre.trig, model-catalog-tacc.trig, dynamo-catalog.trig, wifire-2023-09-22.trig, wifire-2024-09.trig)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `etl/extract.py`: `extract_variable_presentations()` already extracts VP scalars and `has_standard_variable`/`uses_unit` as URI strings — extend for StandardVariable/Unit entity extraction
- `model-catalog-api/src/mappers/resource-registry.ts`: Existing resource config pattern for entity tables with relationships, junction tables, and Hasura mapping
- `model-catalog-api/src/services/service.ts`: Generic CRUD service with junction handling (buildJunctionInserts, nested inserts) from Phase 3

### Established Patterns
- `modelcatalog_` prefix for all new tables
- Full URI as TEXT primary key
- Junction tables: FK-pair composite PK, insert+delete permissions only
- Entity tables: insert+update+delete permissions with unrestricted filter
- Bidirectional Hasura relationships on junction tables
- ETL: SPARQL extract → Python transform → Hasura GraphQL bulk insert
- Two-pass loading for self-referential FK dependencies

### Integration Points
- Resource registry: Update `standardvariables` and `variables` entries from `hasuraTable: null` to actual table names
- Add new `units` resource entry (does not exist yet)
- Hasura migrations: New migration for StandardVariable + Unit tables + FK constraints
- Hasura metadata: Track new tables, configure relationships, set permissions
- ETL pipeline: New SPARQL queries for StandardVariable/Unit extraction, updated junction extraction

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following established patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-variable-migration-analysis-trig-fuseki-to-hasura*
*Context gathered: 2026-03-28*
