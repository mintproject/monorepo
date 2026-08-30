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
| `model-catalog-endpoint/` | Apache Fuseki RDF store (deprecated) | - |
| `mint-ensemble-manager/` | Execution orchestration | TypeScript/Express |
| `ui-react/` | Frontend (current) | TypeScript/React + Vite |
| `ui/` | Legacy frontend (deprecated, being replaced by `ui-react/`) | TypeScript/LitElement |
| `graphql_engine/` | Hasura schema, migrations, metadata | SQL/YAML |
| `etl/` | RDF-to-PostgreSQL migration pipeline | Python |
| `helm-charts/` | Kubernetes deployment | Helm |

> **Deprecated (2026-08-29):** `model-catalog-fastapi` (legacy REST API v1.8.0, RDF/SPARQL)
> is retired. The GitHub repo `mintproject/model-catalog-fastapi` is archived and the
> directory is no longer checked out here. Use `model-catalog-api/` (v2.0.0).

> **Removed as submodules (2026-08-30):** `model-catalog-ontology/`, `MINT_USERGUIDE/`,
> `model-catalog-fetch-api-client/` and `dynamo-experiment-may/` are no longer checked
> out here. The single-repo cutover removed them
> ([#146](https://github.com/mintproject/monorepo/issues/146)).
>
> Two of them stay maintained, in their own repositories. Read them there:
>
> - The OWL ontology for the model catalog schema:
>   [`mintproject/Mint-ModelCatalog-Ontology`](https://github.com/mintproject/Mint-ModelCatalog-Ontology)
> - The user documentation:
>   [`mintproject/MINT_USERGUIDE`](https://github.com/mintproject/MINT_USERGUIDE)
>
> Both keep outside forks. Do not copy their content into this repository.

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

### UI (ui-react — current frontend)
```bash
cd ui-react
npm install && npm run dev          # Vite dev server
npm test                            # Vitest
npm run build                       # Production build
npm run codegen                     # GraphQL type generation (needs HASURA_ADMIN_SECRET)
```

### UI (ui — deprecated LitElement frontend)
Only touch this for maintenance of the old app; new frontend work goes in `ui-react/`.
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
- v2.0.0 API is the only maintained REST API; legacy v1.8.0 (`model-catalog-fastapi`) is archived
- Old model/model_io/model_parameter tables kept for FK compatibility
- Submodules: `model-catalog-api`, `mint-ensemble-manager`, `ui` each have their own CLAUDE.md
- `ui-react/` is NOT a submodule — it lives directly in this repo and has its own CLAUDE.md

## Git Guidelines

- Never indicate code was authored/co-authored by Claude or Anthropic in commit messages
- Keep commit messages clean and simple, no emoji
- Open pull requests against `develop`, not `main`

### Branch model

`develop` is the default branch and the integration line. `main` is production.

- Every feature and every fix branches from `develop` and merges back into `develop`.
- A release is a `develop` -> `main` pull request. release-please then cuts the
  tag and the changelog from `main` (`target-branch: main` in
  `.github/workflows/release-please.yml`).
- A hotfix branches from `main` and merges into `main`, so it ships without the
  unreleased work on `develop`.
- **After every hotfix, merge `main` back into `develop` immediately.** Without
  the back-merge the next release overwrites the fix.

## Agent skills

### Issue tracker

Issues live in the `mintproject/monorepo` GitHub Issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Kubernetes dev instance

Shared MicroK8s cluster: kubectl context `microk8s`, namespace `mint`, helm release `mint` (NOT `testing-mint`, despite `helm-charts/README.md`). Every branch push builds a deployable image, so a branch can be tested before merge. Use the `test-on-k8s-dev` skill.
