# DYNAMO - MINT Platform

## What This Is

DYNAMO is the next version of the MINT modeling platform. It consolidates model metadata into a GraphQL data layer (PostgreSQL/Hasura) and provides a modern React-based UI for exploring and managing models, variables, and geographic regions. The FastAPI REST API is preserved as a compatibility layer for external consumers.

## Core Value

Researchers can browse, register, configure, and compare models through a modern React interface backed entirely by the Hasura GraphQL endpoint.

## Current Milestone: v2.0 — UI React Migration

**Goal:** Standalone React app replacing 4 key screens (Areas, Variables, Prepare Models, User Models) from the existing LitElement UI, backed by GraphQL only.

**Target features:**
- Browse and manage geographic regions (Administrative, Agricultural, Hydrological) with map visualization and editing
- Browse and search variable presentations with filtering
- Explore the 4-level model catalog hierarchy, register new models, configure setups, compare models
- User-specific model catalogs with CRUD and cross-user sharing

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
- modelcatalog_* PostgreSQL schema with 4-level hierarchy -- v1.0
- Hasura metadata tracking all modelcatalog_* tables with relationships -- v1.0
- ETL pipeline from TriG dump to PostgreSQL -- v1.0
- REST API v2.0.0 at /v2.0.0/ backed by Hasura/PostgreSQL -- v1.0

### Active

- [ ] Standalone React app with modern stack (React 19, React Router, TanStack Query, Material UI)
- [ ] Areas: Browse region hierarchy by category (Administrative, Agricultural, Hydrological)
- [ ] Areas: Map visualization with bounding boxes and geometries
- [ ] Areas: Region editor for creating and editing regions
- [ ] Areas: Region selection as context for other screens
- [ ] Variables: Browse variable presentations with details
- [ ] Variables: Search and filter variables by name and category
- [ ] Prepare Models: Browse 4-level model catalog hierarchy (Software > Version > Config > Setup)
- [ ] Prepare Models: Register new models with metadata
- [ ] Prepare Models: Configure model setups with parameters and I/O
- [ ] Prepare Models: Compare models side-by-side
- [ ] User Models: View models owned by a specific user
- [ ] User Models: Create models under user's catalog
- [ ] User Models: Edit user model metadata, parameters, I/O
- [ ] User Models: Browse other users' model catalogs

### Out of Scope

- Standard variable mapping -- deferred, not needed for browse-only variable screen
- Variable selection for modeling workflow -- modeling workflow stays in LitElement app
- Modeling workflow migration (problem statements, threads, tasks) -- separate future effort
- Dataset management migration -- separate future effort
- Analysis/visualization migration -- separate future effort
- Messages/discussion migration -- separate future effort
- Emulators migration -- separate future effort
- Phase 3 FK migration from v1.0 -- deferred, Fuseki still runs in parallel

## Context

**Previous milestone (v1.0):** Migrated model catalog data from Apache Fuseki (RDF triplestore) to PostgreSQL/Hasura. Created 36+ modelcatalog_* tables, ETL pipeline from TriG dump, and a new Node.js/TypeScript REST API at /v2.0.0/. Phases 1-2 complete; Phase 3 (FK migration) deferred.

**Current LitElement UI:** The existing UI at `ui/` is a LitElement + Redux PWA with lazy-loaded screens. The 4 target screens (Areas, Variables, Models, User Models) currently use a mix of GraphQL (Apollo Client) and the Model Catalog REST API. The new React app will use GraphQL exclusively.

**New React app location:** `ui-react/` directory in the monorepo, alongside the existing `ui/` directory.

**Data layer:** All data comes from Hasura GraphQL. The modelcatalog_* tables from v1.0 provide model, variable, and related entity data. Region data comes from existing Hasura tables.

## Constraints

- **GraphQL only**: React app queries Hasura exclusively -- no REST API dependency
- **Standalone**: New app at `ui-react/`, does not modify the existing `ui/` LitElement app
- **Auth**: Must integrate with existing OAuth2/Keycloak authentication
- **Existing schema**: Uses modelcatalog_* tables as-is from v1.0 migration

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fresh modelcatalog_* tables over fixing existing | Current model tables poorly structured | -- v1.0 validated |
| 4-level hierarchy: Software > Version > Config > Setup | Mirrors RDF Model Catalog ontology | -- v1.0 validated |
| FastAPI as thin REST layer over Hasura | External consumers need REST | -- v1.0 validated |
| Standalone React app (not hybrid) | Clean separation, no framework coexistence complexity | -- Pending |
| GraphQL only for React app | Leverages v1.0 Hasura migration, single data layer | -- Pending |
| New ui-react/ directory in monorepo | Preserves existing LitElement app during transition | -- Pending |
| Modern defaults stack (React 19, Router, TanStack Query, MUI) | Research will refine specific choices | -- Pending |

---
*Last updated: 2026-02-21 after milestone v2.0 initialization*
