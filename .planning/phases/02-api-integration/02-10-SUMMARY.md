---
phase: 02-api-integration
plan: 10
subsystem: etl-schema-api
tags: [type-column, software-subtype, hasura-migration, etl, api-filtering]
dependency_graph:
  requires: ["02-08"]
  provides: ["software-type-column", "subtype-api-endpoints"]
  affects: ["model-catalog-api", "etl", "graphql_engine"]
tech_stack:
  added: []
  patterns: ["rdf:type extraction", "Hasura type filter", "ETL column backfill"]
key_files:
  created:
    - graphql_engine/migrations/1771105512000_modelcatalog_software_type/up.sql
    - graphql_engine/migrations/1771105512000_modelcatalog_software_type/down.sql
  modified:
    - graphql_engine/metadata/tables.yaml
    - etl/extract.py
    - model-catalog-api/src/hasura/field-maps.ts
    - model-catalog-api/src/mappers/resource-registry.ts
decisions:
  - "ETL extracts rdf:type URI from TriG (excluding base sdm:Model) and assigns most specific subtype; falls back to sdm:Model if no specialized subtype"
  - "Generic load_table mechanism in load.py automatically includes type in INSERT because entity dict keys drive the column list"
  - "Hasura metadata applied programmatically via replace_metadata API after adding type column to live DB"
  - "theory_guidedmodels (underscore) alias added to resource-registry.ts: OpenAPI operationId converts hyphens in URL paths to underscores in operationId"
metrics:
  duration: 598s
  completed: "2026-02-21"
  tasks_completed: 3
  files_modified: 4
---

# Phase 2 Plan 10: Add Software type Column and Enable Subtype Filtering

**One-liner:** Added `type` TEXT column to `modelcatalog_software` via Hasura migration, populated from TriG `rdf:type` data in ETL, enabling `/v2.0.0/models`, `/empiricalmodels`, `/theory-guidedmodels`, `/coupledmodels` endpoint filtering.

## What Was Built

The `modelcatalog_software` table had no `type` column, causing runtime errors when the API's `getSoftwareTypeFilter()` constructed `type: { _eq: "..." }` Hasura WHERE clauses. Three coordinated changes resolved this:

**Schema:** Migration `1771105512000_modelcatalog_software_type` adds `type TEXT` column with backfill. Tables.yaml updated to include `type` in select (anonymous+user), insert, and update permissions.

**ETL:** `extract_software()` now runs a SPARQL query to find all `rdf:type` values in the `sdm:` namespace for each Software entity. The most specific subtype (non-Model) is used; falls back to `sdm:Model` if no specialized type. `load.py` generic mechanism automatically includes `type` in INSERT.

**API:** `field-maps.ts` updated to include `type` in the `modelcatalog_software` GraphQL selection. `resource-registry.ts` gained `theory_guidedmodels` (underscore) alias because OpenAPI operationId converts URL-path hyphens to underscores.

## Verification Results

| Check | Result |
|-------|--------|
| `modelcatalog_software.type` column exists | PASS |
| No NULL type values in DB | PASS (0 NULLs) |
| Type distribution from TriG | Model:22, Theory-Guided:7, Empirical:5, Coupled:2, Other:2 |
| GET /v2.0.0/models | 22 results |
| GET /v2.0.0/empiricalmodels | 5 results |
| GET /v2.0.0/theory-guidedmodels | 7 results |
| GET /v2.0.0/coupledmodels | 2 results |
| GET /v2.0.0/emulators | 0 results (no data in TriG - correct) |
| GET /v2.0.0/hybridmodels | 0 results (no data in TriG - correct) |
| TypeScript compile | PASS |
| Test suite (32 tests) | PASS |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | graphql_engine: 46f4c24 | Migration files and metadata update |
| Task 1 | mint: f581ff1 | Update graphql_engine submodule reference |
| Task 2 | mint: cd7c660 | ETL rdf:type extraction |
| Task 3 | model-catalog-api: 71c7c4c | Field-maps + resource-registry fix |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Applied missing author_id migration to local DB before ETL run**
- **Found during:** Task 2 ETL execution
- **Issue:** `modelcatalog_software.author_id` column didn't exist in local postgres (migration 1771105511000 had not been applied to live DB)
- **Fix:** Applied migration 1771105511000_modelcatalog_author_relationships to local postgres via `psql -f`
- **Files modified:** None (DB DDL applied directly)

**2. [Rule 3 - Blocking] Applied Hasura metadata update for type column and author relationship**
- **Found during:** Task 3 API verification
- **Issue:** Hasura's tracked metadata for modelcatalog_software was minimal (no author_id in permissions, no author object relationship, no authors array relationship). The API was failing with `field 'author' not found in type: 'modelcatalog_software'`
- **Fix:** Exported Hasura metadata, updated modelcatalog_software entry to add type+author_id to select permissions, add author object relationship, add authors array relationship, track modelcatalog_software_author junction table. Applied via `replace_metadata` API. Also ran ETL against Hasura DB via port-forward.
- **Files modified:** Hasura live metadata (via API)

**3. [Rule 1 - Bug] Added theory_guidedmodels underscore alias to resource-registry.ts**
- **Found during:** Task 3 API verification
- **Issue:** `GET /v2.0.0/theory-guidedmodels` returned 404 "Unknown resource type: theory_guidedmodels". OpenAPI operationId `theory_guidedmodels_get` uses underscore (URL hyphen converted by openapi-glue), but resource-registry only had `theory-guidedmodels` (hyphen)
- **Fix:** Added `theory_guidedmodels` alias entry to resource-registry.ts with identical config to `theory-guidedmodels`
- **Files modified:** `model-catalog-api/src/mappers/resource-registry.ts`
- **Commit:** 71c7c4c

## Self-Check: PASSED

- Migration files exist: FOUND
- ETL extract.py updated with type_query: FOUND
- field-maps.ts includes type for modelcatalog_software: FOUND
- resource-registry.ts has theory_guidedmodels alias: FOUND
- Hasura DB has type column: VERIFIED (6 distinct type values, 0 NULLs)
- All API endpoints return correct filtered results: VERIFIED
