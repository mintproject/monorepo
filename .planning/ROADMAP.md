# Roadmap: DYNAMO Model Catalog GraphQL Migration

## Overview

This migration moves the MINT Model Catalog from Apache Fuseki (RDF triplestore) to PostgreSQL/Hasura GraphQL in three phases. Phase 1 establishes the new `modelcatalog_*` schema and loads all data from the TriG dump. Phase 2 builds a new Node.js/TypeScript REST API serving identical responses from Hasura at /v2.0.0/ while the old API stays at /v1.8.0/. Phase 3 migrates foreign keys from existing execution/thread tables to the new schema and removes the Fuseki dependency entirely.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Schema and Data Migration** - Design modelcatalog_* tables, create Hasura migrations, ETL data from TriG/JSON, validate
- [ ] **Phase 2: API Integration** - New Node.js/TypeScript API at /v2.0.0/ backed by Hasura/PostgreSQL, identical responses to v1.8.0
- [ ] **Phase 3: FK Migration and Cleanup** - Migrate execution/thread FKs to new tables, remove Fuseki from the stack

## Phase Details

### Phase 1: Schema and Data Migration
**Goal**: All model catalog data exists in properly structured PostgreSQL tables and is queryable via Hasura GraphQL
**Depends on**: Nothing (first phase)
**Requirements**: SCHM-01, SCHM-02, SCHM-03, SCHM-04, SCHM-05, SCHM-06, SCHM-07, SCHM-08, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-09
**Success Criteria** (what must be TRUE):
  1. All `modelcatalog_*` tables exist in PostgreSQL with the 4-level hierarchy (Software > SoftwareVersion > ModelConfiguration > ModelConfigurationSetup) plus I/O, parameters
  2. Hasura tracks all `modelcatalog_*` tables with correct relationships -- nested GraphQL queries return parent-child data
  3. Every Software, SoftwareVersion, ModelConfiguration, and ModelConfigurationSetup entity from the TriG dump exists in the corresponding PostgreSQL table
  4. Entity counts match between source (TriG/JSON) and target (PostgreSQL) for every entity type
  5. Sample entities spot-checked for correct field values, FK relationships, and multi-valued properties
**Plans:** 7 plans

Plans:
- [x] 01-01-PLAN.md -- Schema design: create modelcatalog_* tables (12 tables) and Hasura metadata with relationships
- [x] 01-02-PLAN.md -- ETL pipeline: extract from TriG, transform with FK inversion, load into PostgreSQL, validate counts
- [x] 01-03-PLAN.md -- Gap closure: extended schema migration adding 10 entity tables, 14 junction tables, and columns for missing ontology properties
- [x] 01-04-PLAN.md -- Gap closure: Hasura metadata for all new tables and updated relationships/permissions
- [x] 01-05-PLAN.md -- Gap closure: extend ETL extraction for 10 new entity types, 14 link sets, and new columns on existing types
- [x] 01-06-PLAN.md -- Gap closure: extend ETL transformation with dedup, label derivation, FK resolution, and 14 new junction table builders
- [x] 01-07-PLAN.md -- Gap closure: extend ETL loading and validation for all 36 tables, execute pipeline, verify data population

### Phase 2: API Integration
**Goal**: New Node.js/TypeScript REST API serves identical responses at /v2.0.0/ from Hasura/PostgreSQL, while old FastAPI stays at /v1.8.0/ for parallel validation
**Depends on**: Phase 1
**Requirements**: API-01, API-02, API-03
**Success Criteria** (what must be TRUE):
  1. New API at /v2.0.0/ returns data from PostgreSQL/Hasura for all 46 resource types and 13 custom endpoints
  2. REST endpoint responses match the existing v1.8.0 API contract (same JSON structure, array wrapping, URI IDs)
  3. All existing REST endpoints remain functional at /v1.8.0/ (old API untouched)
  4. Full CRUD (GET, POST, PUT, DELETE) works through Hasura GraphQL mutations
  5. Helm chart deploys the new API alongside existing services
**Plans:** 13 plans

Plans:
- [x] 02-01-PLAN.md -- Hasura mutation permissions: add insert/update/delete for all modelcatalog tables
- [x] 02-02-PLAN.md -- Project scaffolding: new Node.js/TypeScript repo with Fastify, OpenAPI-glue, GraphQL client
- [x] 02-03-PLAN.md -- Response/request mappers and resource registry for v1.8.0 format compatibility
- [x] 02-04-PLAN.md -- Generic CRUD service with Proxy-based operationId dispatch and JWT security
- [x] 02-05-PLAN.md -- GraphQL field selections and integration tests for read operations
- [x] 02-06-PLAN.md -- Custom endpoint handlers for 13 /custom/ routes
- [x] 02-07-PLAN.md -- Dockerfile, CI/CD pipeline, and Helm chart for deployment
- [x] 02-08-PLAN.md -- Gap closure: remove broken user_id filtering from service and custom handlers
- [x] 02-09-PLAN.md -- Gap closure: return empty read responses for 23 null-table resource types
- [x] 02-10-PLAN.md -- Gap closure: add type column to modelcatalog_software for software subtype filtering
- [x] 02-11-PLAN.md -- Gap closure: rename relationship keys to v1.8.0 OWL names and fix plain ID lookup
- [x] 02-12-PLAN.md -- Gap closure: rewrite custom handler GraphQL field selections to match actual schema
- [ ] 02-13-PLAN.md -- Gap closure: apply fullId prefix logic to custom _by_pk handlers

### Phase 3: FK Migration and Cleanup
**Goal**: All execution and thread tables reference the new `modelcatalog_*` tables, old model tables are deprecated, and Fuseki is removed from the stack
**Depends on**: Phase 2
**Requirements**: FKMG-01, FKMG-02, FKMG-03, FKMG-04, FKMG-05, FKMG-06, FKMG-07, FKMG-08, CLNP-01, CLNP-02
**Success Criteria** (what must be TRUE):
  1. Every existing `model` table row is classified as either a ModelConfiguration or ModelConfigurationSetup with an explicit mapping to its `modelcatalog_*` counterpart
  2. `execution.model_id`, `thread_model.model_id`, and all related binding tables reference `modelcatalog_*` tables instead of old model tables
  3. No orphaned records and no broken FK references exist after migration -- validated by constraint checks
  4. Fuseki is removed from the deployment stack and does not appear in docker-compose or deployment configs
  5. `@mintproject/modelcatalog_client` SDK dependency is removed from Ensemble Manager
**Plans**: TBD

Plans:
- [ ] 03-01: Row classification and FK migration
- [ ] 03-02: Fuseki removal and dependency cleanup

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema and Data Migration | 7/7 | Complete | 2026-02-19 |
| 2. API Integration | 12/13 | In progress | - |
| 3. FK Migration and Cleanup | 0/2 | Not started | - |
