# DYNAMO - Model Catalog GraphQL Migration

## What This Is

Architectural migration of the MINT Model Catalog from Apache Fuseki (RDF/SPARQL triplestore) to PostgreSQL/Hasura GraphQL. This establishes a single source of truth for model data in DYNAMO (the next version of MINT) by consolidating model metadata into the existing GraphQL data layer. The FastAPI REST API is preserved as a thin compatibility layer over Hasura.

## Core Value

All model catalog data accessible through a single GraphQL endpoint, eliminating the Fuseki dependency and external transformation layers while maintaining REST API compatibility for external consumers.

## Requirements

### Validated

- Model execution orchestration via Ensemble Manager -- existing
- Problem statement / task / thread workflow via GraphQL -- existing
- Execution tracking and result storage via Hasura -- existing
- Region management with spatial queries -- existing
- Dataset and dataslice management -- existing
- HPC job submission via Tapis -- existing
- Local execution via Docker -- existing
- OAuth2/Keycloak authentication -- existing
- LitElement UI with Redux state management -- existing

### Active

- [ ] Design `modelcatalog_*` PostgreSQL schema reflecting 4-level hierarchy (Software > SoftwareVersion > ModelConfiguration > ModelConfigurationSetup) plus I/O, parameters, variables
- [ ] Create Hasura migration for new `modelcatalog_*` tables with proper relationships and metadata
- [ ] Export model catalog data from dump /Users/mosorio/repos/mint/model-catalog-endpoint/data/model-catalog-tacc.trig
- [ ] Update FastAPI to query Hasura/PostgreSQL instead of Fuseki, maintaining same REST endpoints
- [ ] Classify existing `model` table rows as configurations vs setups and map to new `modelcatalog_*` entries
- [ ] Migrate foreign keys in `execution`, `thread_model`, and related tables to point to new `modelcatalog_*` tables
- [ ] Remove Fuseki dependency from the stack
- [ ] Update Ensemble Manager model catalog integration to use GraphQL instead of REST client

### Out of Scope

- UI migration to GraphQL for model data -- separate effort, UI keeps using REST client
- Changes to execution engine backends (Tapis, LocalEx)
- Data Catalog (CKAN) migration
- New feature development beyond what's needed for the migration

## Context

**Current state:** Model metadata lives in Apache Fuseki (RDF triplestore), accessed via `@mintproject/modelcatalog_client` SDK and a FastAPI service (`model-catalog-fastapi`). Everything else (problem statements, tasks, threads, executions) already uses Hasura/PostgreSQL via GraphQL. This split creates complexity: two data layers, transformation adapters (`graphql_adapter.ts`), and the external `modelcatalog_client` dependency.

**Existing partial migration:** The current PostgreSQL schema already has `model`, `model_io`, `model_parameter`, `model_input`, `model_output` tables -- but these are a flattened representation that mixes ModelConfigurations and ModelConfigurationSetups. The new `modelcatalog_*` tables will properly model the RDF hierarchy.

**Data available as JSON:** The existing Model Catalog REST API can export all model data as JSON, so no SPARQL queries needed for the data migration.

**FK dependencies:** The `execution` and `thread_model` table families have foreign keys into the current model tables. These need careful migration to point to the new `modelcatalog_*` tables.

## Constraints

- **Backward compatibility**: FastAPI REST endpoints must remain functional permanently (external consumers)
- **Existing FKs**: `execution`, `thread_model`, and related tables reference current `model`/`model_io`/`model_parameter` tables -- migration must preserve referential integrity
- **Schema prefix**: New tables use `modelcatalog_` prefix to avoid collision with existing tables during migration
- **Estimated effort**: 60 hours

## Key Decisions

| Decision                                               | Rationale                                                       | Outcome    |
| ------------------------------------------------------ | --------------------------------------------------------------- | ---------- |
| Fresh `modelcatalog_*` tables over fixing existing     | Current model tables are poorly structured (flat, mixed types)  | -- Pending |
| 4-level hierarchy: Software > Version > Config > Setup | Mirrors the RDF Model Catalog ontology                          | -- Pending |
| FastAPI as thin REST layer over Hasura                 | External consumers need REST, but data should live in one place | -- Pending |
| Keep old model tables during migration                 | Execution/thread FKs need gradual migration, not a big bang     | -- Pending |
| UI migration out of scope                              | Reduces blast radius; UI can switch to GraphQL independently    | -- Pending |

---

_Last updated: 2026-02-14 after initialization_
