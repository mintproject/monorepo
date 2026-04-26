# OpenWolf

@.wolf/OPENWOLF.md

This project uses OpenWolf for context management. Read and follow .wolf/OPENWOLF.md every session. Check .wolf/cerebrum.md before generating code. Check .wolf/anatomy.md before reading files.


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MINT (Model INTegration) platform - a scientific modeling system. This monorepo uses git submodules for major components. The project has completed the DYNAMO v2.0 migration: model catalog data moved from Apache Fuseki (RDF triplestore) to PostgreSQL with Hasura GraphQL.

## Repository Structure

| Directory | Purpose | Language |
|-----------|---------|----------|
| `model-catalog-api/` | REST API v2.0.0 backed by Hasura | TypeScript/Fastify |
| `model-catalog-fastapi/` | Legacy REST API v1.8.0 (RDF) | Python/FastAPI |
| `model-catalog-endpoint/` | Apache Fuseki RDF store (deprecated) | - |
| `mint-ensemble-manager/` | Execution orchestration | TypeScript/Express |
| `ui/` | Frontend | TypeScript/LitElement |
| `graphql_engine/` | Hasura schema, migrations, metadata | SQL/YAML |
| `etl/` | RDF-to-PostgreSQL migration pipeline | Python |
| `helm-charts/` | Kubernetes deployment | Helm |

## Architecture

**Data flow:** TriG (RDF) -> ETL (Python) -> PostgreSQL -> Hasura GraphQL -> REST APIs

**model-catalog-api request path:**
```
HTTP -> Fastify + openapi-glue (operationId routing) -> Proxy (service.ts)
  -> CatalogServiceImpl (generic CRUD) -> Apollo Client -> Hasura -> PostgreSQL
```

**Key patterns:**
- `service.ts` uses a JavaScript Proxy to intercept operationId calls and dispatch to generic CRUD handlers (list/getById/create/update/delete)
- `resource-registry.ts` maps 46+ resource types to Hasura table names, fields, and relationship metadata
- OpenAPI spec is preprocessed (schemas stripped before AJV compilation) for startup performance
- Bearer tokens are forwarded to Hasura for JWT validation -- the API layer does not validate tokens itself
- Read operations use admin secret; write operations forward the user's JWT
- `field-maps.ts` controls which GraphQL fields are selected per table

**Database schema:** Tables use `modelcatalog_` prefix. 4-level hierarchy: Software > Version > Config > Setup. Junction tables handle M:M relationships. All PKs are URI text fields.

## Development Commands

### model-catalog-api
```bash
cd model-catalog-api
npm install && npm run dev          # Development (tsx watch)
npm test                            # Vitest
npm run codegen                     # Regenerate GraphQL types from Hasura
```

### mint-ensemble-manager
```bash
cd mint-ensemble-manager
npm install && npm run start:watch  # Development (nodemon)
npm test                            # Jest
npm run codegen                     # GraphQL type generation
npm run eslint:fix && npm run prettier:fix
```

### UI
```bash
cd ui
yarn install && yarn start          # Development with hot reload
yarn test                           # Jest
yarn build                          # Production build
```

### ETL Pipeline
```bash
python3 etl/run.py --trig-path model-catalog-endpoint/data/model-catalog.trig
python3 etl/run.py --trig-path ... --clear    # Truncate first
python3 etl/run.py --validate-only            # Validation only
```

### Hasura Migrations
```bash
cd graphql_engine
hasura migrate create <name> --database-name default
hasura migrate apply
hasura metadata apply
hasura metadata reload
```

## Key Implementation Details

- **ETL idempotency:** Uses ON CONFLICT DO NOTHING; safe to rerun. Self-referential FKs require two-pass loading.
- **Junction tables:** FK-pair-only junction tables get insert+delete only (no update). Entity tables get full CRUD.
- **username parameter:** Accepted but ignored (no user_id column in modelcatalog_* tables).
- **Nested writes (Phase 3):** PUT/POST handle junction relationships via delete-then-insert for updates, nested inserts for creates. See `buildJunctionInserts` in model-catalog-api.
- **Variable entities (Phase 5):** StandardVariable and Unit tables with FK constraints from variable_presentation.

## Migration Context

See `.planning/PROJECT.md` for full migration status and decisions. Key points:
- v2.0.0 API runs alongside legacy v1.8.0
- Old model/model_io/model_parameter tables kept for FK compatibility
- Submodules: `model-catalog-api`, `mint-ensemble-manager`, `ui` each have their own CLAUDE.md

## Git Guidelines

- Never indicate code was authored/co-authored by Claude or Anthropic in commit messages
- Keep commit messages clean and simple, no emoji
