---
phase: 01-schema-and-data-migration
plan: 01
subsystem: database-schema
tags: [hasura, postgresql, migration, graphql, schema-design]
dependency-graph:
  requires: []
  provides:
    - modelcatalog_* tables in PostgreSQL
    - Hasura metadata for modelcatalog_* tables
    - GraphQL API for 4-level hierarchy queries
  affects:
    - graphql_engine/migrations/
    - graphql_engine/metadata/tables.yaml
tech-stack:
  added:
    - PostgreSQL modelcatalog_* schema (12 tables)
    - Hasura relationship metadata
  patterns:
    - Hierarchical foreign keys (4-level adjacency list)
    - Junction tables for many-to-many relationships
    - Index-backed FK constraints for query performance
key-files:
  created:
    - graphql_engine/migrations/1771105509000_modelcatalog_schema/up.sql
    - graphql_engine/migrations/1771105509000_modelcatalog_schema/down.sql
  modified:
    - graphql_engine/metadata/tables.yaml
decisions:
  - Made FK columns nullable (software_id, software_version_id, model_configuration_id) to handle orphaned entities in RDF data
  - Used TEXT for all ID columns to preserve full URI references
  - Created 15 indexes covering all FK columns (PostgreSQL doesn't auto-index FKs)
  - Single parameter table with parameter_type column instead of separate Adjustment table
metrics:
  duration: 182
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  completed_date: 2026-02-14T21:47:58Z
---

# Phase 01 Plan 01: ModelCatalog Schema Migration Summary

**One-liner:** PostgreSQL schema with 12 tables (6 entity + 6 junction) for 4-level model catalog hierarchy, tracked in Hasura with full relationship metadata

## What Was Built

Created complete PostgreSQL schema for migrating Apache Fuseki model catalog data to Hasura GraphQL:

### Database Schema (up.sql)
- **6 entity tables** implementing 4-level hierarchy:
  - `modelcatalog_software` (top level, 186 expected entities)
  - `modelcatalog_software_version` (240 entities)
  - `modelcatalog_model_configuration` (308 entities)
  - `modelcatalog_model_configuration_setup` (757 entities)
  - `modelcatalog_dataset_specification` (5,434 I/O specs)
  - `modelcatalog_parameter` (8,273 parameters)

- **6 junction tables** for many-to-many relationships:
  - `modelcatalog_configuration_input/output/parameter` (links configurations to I/O and parameters)
  - `modelcatalog_setup_input/output/parameter` (links setups to I/O and parameters)

- **15 indexes** on all FK columns for query performance
- **Rollback migration** (down.sql) with proper dependency order

### Hasura Metadata (tables.yaml)
- **12 table entries** with complete relationship configuration
- **Object relationships** pointing parent-ward (e.g., software_version.software)
- **Array relationships** pointing child-ward (e.g., software.versions)
- **Select permissions** for anonymous and user roles (read-only public access)

## Commits

| Commit  | Type | Description                                  |
| ------- | ---- | -------------------------------------------- |
| 7c58f59 | feat | Create modelcatalog schema migration         |
| ae24df7 | feat | Configure Hasura metadata for modelcatalog tables |

## Technical Decisions

### 1. Nullable FK Columns
**Decision:** Made `software_id`, `software_version_id`, and `model_configuration_id` FK columns nullable.

**Rationale:** The TriG data may contain orphaned entities where parent references cannot be reliably inferred from inverse predicates (`sd#hasVersion`, `sd#hasConfiguration`, `sd#hasSetup`). The ETL script (Plan 02) will log orphans for manual review.

**Alternative considered:** NOT NULL constraints with data cleaning pre-pass. Rejected due to complexity and potential data loss.

### 2. Single Parameter Table
**Decision:** Single `modelcatalog_parameter` table with optional `parameter_type` column to distinguish standard Parameters from Adjustments.

**Rationale:** Both types share identical properties. Normalization can be deferred until Phase 2 if GraphQL query patterns require it.

**Alternative considered:** Separate `modelcatalog_adjustment` table. Rejected as premature optimization.

### 3. TEXT ID Columns
**Decision:** Use TEXT for all ID columns instead of UUID or INTEGER.

**Rationale:** Preserves full URI references from RDF data (e.g., `https://w3id.org/okn/i/mint/topoflow_3.5`), enabling cross-reference with original Fuseki endpoint during migration validation.

### 4. Comprehensive FK Indexing
**Decision:** Created indexes on every FK column (15 total).

**Rationale:** PostgreSQL does not auto-index foreign keys. Without indexes, nested GraphQL queries (e.g., software -> versions -> configurations -> setups) would perform full table scans.

**Performance impact:** Estimated 10-100x speedup for relationship traversal queries.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All plan verification criteria passed:

1. Migration directory exists with up.sql and down.sql
2. 12 CREATE TABLE statements in up.sql
3. All FK relationships present (software_id, software_version_id, model_configuration_id)
4. 6 junction tables created (3 for configuration level, 3 for setup level)
5. 15 CREATE INDEX statements in up.sql
6. tables.yaml is valid YAML
7. All 12 tables tracked in metadata
8. Object relationships point parent-ward (via FK)
9. Array relationships point child-ward (via reverse FK)
10. Select permissions configured for anonymous and user roles

## Next Steps

**Immediate (Plan 01-02):** Build Python ETL pipeline to:
- Parse TriG file with RDFLib
- Extract 15,000+ entities via SPARQL queries
- Load into PostgreSQL with batch inserts
- Validate entity counts match source data

**Blocked by this plan:** Plan 01-02 cannot proceed without the schema from this plan.

## Self-Check

Verifying all claimed artifacts exist:

- Migration files exist: `/Users/mosorio/repos/mint/graphql_engine/migrations/1771105509000_modelcatalog_schema/up.sql` and `down.sql`
- Metadata file modified: `/Users/mosorio/repos/mint/graphql_engine/metadata/tables.yaml`
- Commit 7c58f59 exists in git history
- Commit ae24df7 exists in git history

## Self-Check: PASSED

All files and commits verified.
