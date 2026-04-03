# DYNAMO - Model Catalog GraphQL Migration

## What This Is

Architectural migration of the MINT Model Catalog from Apache Fuseki (RDF/SPARQL triplestore) to PostgreSQL/Hasura GraphQL. The migration is complete (v2.0): model catalog data now lives in properly structured `modelcatalog_*` PostgreSQL tables, served through a new Node.js/TypeScript REST API at /v2.0.0/ backed by Hasura GraphQL. The old Fuseki-based API remains at /v1.8.0/ for parallel validation. Execution and thread FK tables now reference the new `modelcatalog_*` tables directly. The `@mintproject/modelcatalog_client` SDK has been removed from Ensemble Manager.

## Core Value

All model catalog data accessible through a single GraphQL endpoint, eliminating the Fuseki dependency and external transformation layers while maintaining REST API compatibility for external consumers.

## Requirements

### Validated

- ✓ Model execution orchestration via Ensemble Manager — existing (pre-v2.0)
- ✓ Problem statement / task / thread workflow via GraphQL — existing (pre-v2.0)
- ✓ Execution tracking and result storage via Hasura — existing (pre-v2.0)
- ✓ Region management with spatial queries — existing (pre-v2.0)
- ✓ Dataset and dataslice management — existing (pre-v2.0)
- ✓ HPC job submission via Tapis — existing (pre-v2.0)
- ✓ Local execution via Docker — existing (pre-v2.0)
- ✓ OAuth2/Keycloak authentication — existing (pre-v2.0)
- ✓ LitElement UI with Redux state management — existing (pre-v2.0)
- ✓ Design `modelcatalog_*` PostgreSQL schema reflecting 4-level hierarchy — v2.0 (SCHM-01 through SCHM-08)
- ✓ Create Hasura migration for new `modelcatalog_*` tables with proper relationships and metadata — v2.0
- ✓ Export and migrate model catalog data from TriG dump — v2.0 (DATA-01 through DATA-09)
- ✓ New FastAPI-compatible REST API querying Hasura/PostgreSQL, maintaining same REST endpoints — v2.0 (API-01, API-02, API-03)
- ✓ Classify existing `model` table rows and migrate FKs to new `modelcatalog_*` tables — v2.0 (FKMG-01 through FKMG-08)
- ✓ Remove Fuseki dependency from the deployment stack — v2.0 (CLNP-01)
- ✓ Update Ensemble Manager model catalog integration to use GraphQL — v2.0 (API-04, CLNP-02)

### Active

- ✓ Analyze TriG data for Variable entities, create StandardVariable and Unit tables, ETL pipeline, FK constraints — Validated in Phase 05: Variable Migration Analysis

### Out of Scope

- UI migration to GraphQL for model data — separate effort, UI still uses REST client
- Changes to execution engine backends (Tapis, LocalEx)
- Data Catalog (CKAN) migration
- Docker Compose and CI/CD Fuseki reference cleanup — deferred to future phase
- Old model/model_io/model_parameter table cleanup — deferred (kept for FK compatibility during transition)
- GraphQL subscriptions for real-time model catalog updates — future enhancement
- Full-text search across model catalog metadata — future enhancement

## Context

**Current state (post Phase 05):** Model catalog data lives in `modelcatalog_*` PostgreSQL tables (38 tables: 6 entity + junction + extended schema + StandardVariable + Unit). New Node.js/TypeScript API (`model-catalog-api-v2`) serves /v2.0.0/ endpoints backed by Hasura. Old FastAPI (`model-catalog-fastapi`) still serves /v1.8.0/ for parallel validation. Execution and thread tables now have FK columns pointing to `modelcatalog_model_configuration` and `modelcatalog_model_configuration_setup`. Ensemble Manager uses direct GraphQL queries (no SDK). StandardVariable and Unit entities are fully migrated with ETL support and FK constraints from variable_presentation.

**Tech stack:** PostgreSQL + Hasura GraphQL (data layer), Node.js/TypeScript + Fastify + openapi-glue (new API), Python ETL pipeline (one-time migration), Helm chart (deployment).

**Known tech debt:**
- Phase 3 has no VERIFICATION.md (unverified phase)
- model-catalog-api lives in separate repo; no pinned image tag in Helm chart (uses 'latest')
- `model_catalog_api_v2.environment.hasura_graphql_url` is empty string in values.yaml — must be set per environment
- 1 unmatched model_io row (135/136) — documented as acceptable data quality issue
- Docker Compose and CI/CD Fuseki references not yet cleaned up
- Old model/model_io/model_parameter tables still exist (kept for FK compatibility)

## Constraints

- **Backward compatibility**: REST endpoints at /v1.8.0/ must remain functional permanently (external consumers)
- **Existing FKs**: `execution`, `thread_model` families now reference `modelcatalog_*` tables — future cleanup of old model tables requires care
- **Schema prefix**: `modelcatalog_` prefix used to avoid collision with existing tables

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fresh `modelcatalog_*` tables over fixing existing | Current model tables are poorly structured (flat, mixed types) | ✓ Good — clean 4-level hierarchy, no migration baggage |
| 4-level hierarchy: Software > Version > Config > Setup | Mirrors the RDF Model Catalog ontology | ✓ Good — maps cleanly to SDM ontology |
| FastAPI as thin REST layer over Hasura (new Node.js API) | External consumers need REST, but data should live in one place | ✓ Good — v2.0.0 API live alongside v1.8.0 |
| Keep old model tables during migration | Execution/thread FKs need gradual migration, not a big bang | ✓ Good — zero-downtime migration; tables still exist post-v2.0 |
| UI migration out of scope | Reduces blast radius; UI can switch to GraphQL independently | ✓ Good — isolated migration, UI unaffected |
| Junction tables FK-pair-only get insert+delete only | Entity tables get full CRUD; junction just links | ✓ Good — cleaner permissions model |
| OpenAPI spec pre-processed before openapi-glue registration | Prevents AJV compile errors, reduces startup from 31s to <1s | ✓ Good — critical perf optimization |
| Bearer token forwarded to Hasura (not validated at API layer) | Hasura validates JWT via row-level permissions | ✓ Good — single auth enforcement point |
| username param accepted but ignored (no-op) | No user_id column in modelcatalog_* tables | ⚠ Revisit — future user-owned catalog entries may need this |
| Delete-before-FK-add for tables where FK is part of PK | Cannot null a PK column; DELETE orphans before ADD CONSTRAINT | ✓ Good — 0 orphans confirmed before migration |
| has_accepted_values TEXT[] not string | Adapter fallback is [] not empty string | ✓ Good — fixes E2E model run GraphQL errors |

---

_Last updated: 2026-03-29 after Phase 05 completion_
