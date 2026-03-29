---
phase: 05-variable-migration-analysis-trig-fuseki-to-hasura
plan: 01
subsystem: database
tags: [postgres, hasura, migration, sql, typescript, modelcatalog]

# Dependency graph
requires:
  - phase: 01-schema-and-data-migration
    provides: modelcatalog_variable_presentation table with has_standard_variable and uses_unit FK columns
provides:
  - modelcatalog_standard_variable PostgreSQL table (id TEXT PK, label, description)
  - modelcatalog_unit PostgreSQL table (id TEXT PK, label)
  - Hasura metadata tracking for both tables with full permissions and bidirectional relationships
  - API resource registry entries enabling CRUD for standardvariables and units
  - VP object relationships standard_variable and unit declared in Hasura metadata
affects:
  - 05-02 (ETL pipeline can now populate the new tables)
  - 05-03 (FK constraint migration will reference these tables)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Entity table with TEXT URI primary key (modelcatalog_ prefix)
    - YAML anchor pattern for Hasura permission column reuse (&id043, &id044)
    - Bidirectional Hasura relationships: array on parent table, object on child table

key-files:
  created:
    - graphql_engine/migrations/1771200005000_modelcatalog_standard_variable_unit/up.sql
    - graphql_engine/migrations/1771200005000_modelcatalog_standard_variable_unit/down.sql
  modified:
    - graphql_engine/metadata/tables.yaml
    - model-catalog-api/src/mappers/resource-registry.ts

key-decisions:
  - "Added FK column indexes on modelcatalog_variable_presentation.has_standard_variable and uses_unit in migration for query performance"
  - "Object relationships on VP declared without FK constraints present - will activate after Plan 03 adds FK constraints"

patterns-established:
  - "Entity tables use TEXT PRIMARY KEY for RDF URI storage"
  - "Hasura array relationship points from entity to VP via FK column on VP side"
  - "Resource registry relationships array/object type mirrors Hasura relationship direction"

requirements-completed: [D-01, D-02, D-06, D-07, D-09]

# Metrics
duration: 2min
completed: 2026-03-29
---

# Phase 5 Plan 01: StandardVariable and Unit Schema, Metadata, and API Registry

**PostgreSQL tables and Hasura metadata for StandardVariable (TEXT PK, label, description) and Unit (TEXT PK, label) entities, with bidirectional VP relationships and full CRUD permissions wired to the API resource registry**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-29T12:38:56Z
- **Completed:** 2026-03-29T12:40:32Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified across 2 submodules)

## Accomplishments
- Created SQL migration `1771200005000_modelcatalog_standard_variable_unit` with `modelcatalog_standard_variable` and `modelcatalog_unit` tables plus VP FK column indexes
- Updated Hasura metadata to track both tables with full user CRUD permissions, anonymous read, and array relationships to variable_presentations
- Added object_relationships to modelcatalog_variable_presentation for standard_variable and unit traversal
- Updated API resource registry: standardvariables and units now have real hasuraTable values, variablepresentations has hasStandardVariable and usesUnit object relationships

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SQL migration for StandardVariable and Unit tables**
   - graphql_engine submodule: `b7512f9` (feat)
2. **Task 2: Update Hasura metadata and API resource registry**
   - graphql_engine submodule: `b1483fa` (feat)
   - model-catalog-api submodule: `20b2d4d` (feat)
   - Parent repo (submodule pointer update): `4a5c5e4` (feat)

## Files Created/Modified
- `graphql_engine/migrations/1771200005000_modelcatalog_standard_variable_unit/up.sql` - CREATE TABLE DDL for StandardVariable and Unit plus VP FK indexes
- `graphql_engine/migrations/1771200005000_modelcatalog_standard_variable_unit/down.sql` - DROP TABLE rollback
- `graphql_engine/metadata/tables.yaml` - Hasura tracking entries for both new tables plus VP object relationships
- `model-catalog-api/src/mappers/resource-registry.ts` - standardvariables and units wired to real tables; variablepresentations has relationship config

## Decisions Made
- Added indexes on `modelcatalog_variable_presentation.has_standard_variable` and `uses_unit` in the migration (within Claude's discretion per plan) for expected query performance when joining VP to StandardVariable/Unit
- VP object_relationships declared in Hasura metadata now even though FK constraints don't exist yet; they will activate automatically after Plan 03 adds the FK constraints (noted in plan per D-08)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SQL migration ready to be applied to the database (Plan 02 ETL pipeline will populate the tables post-migration)
- Hasura metadata in place for tracking and permissions
- API resource registry enables CRUD endpoints for /standardvariables and /units immediately after migration is applied
- Plan 03 (FK constraints) can proceed after ETL loads data, completing the referential integrity for has_standard_variable and uses_unit columns

## Self-Check: PASSED

All created files exist:
- FOUND: graphql_engine/migrations/1771200005000_modelcatalog_standard_variable_unit/up.sql
- FOUND: graphql_engine/migrations/1771200005000_modelcatalog_standard_variable_unit/down.sql

All commits exist:
- FOUND: b7512f9 (graphql_engine - SQL migration)
- FOUND: b1483fa (graphql_engine - Hasura metadata)
- FOUND: 20b2d4d (model-catalog-api - resource registry)
- FOUND: 4a5c5e4 (parent repo - submodule pointer update)

---
*Phase: 05-variable-migration-analysis-trig-fuseki-to-hasura*
*Completed: 2026-03-29*
