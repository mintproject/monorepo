# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MINT (Model INTegration) platform - a scientific modeling system. The services live
directly in this repository. **This repository holds no git submodules.** The project
has completed the DYNAMO v2.0 migration: model catalog data moved from Apache Fuseki
(RDF triplestore) to PostgreSQL with Hasura GraphQL.

## Repository Structure

Directories marked in the last column carry their own `CLAUDE.md`. Read it before you work
there. A plain `git clone` is complete; there is nothing to `git submodule update`.

| Directory | Purpose | Language | Own `CLAUDE.md` |
|-----------|---------|----------|-----------------|
| `model-catalog-api/` | REST API v2.0.0 backed by Hasura | TypeScript/Fastify | yes |
| `mint-ensemble-manager/` | Execution orchestration | TypeScript/Express | yes |
| `ui-react/` | Frontend (current) | TypeScript/React + Vite | yes |
| `graphql_engine/` | Hasura schema, migrations, metadata | SQL/YAML | - |
| `etl/` | One-time RDF-to-PostgreSQL migration. Complete | Python | - |
| `knowledge-base/` | MINT domain wiki | Markdown | yes |
| `docs/` | ADRs, runbooks, agent guides | Markdown | - |
| `scripts/` | Deployment and maintenance utilities | Shell/SQL | - |
| `backups/` | Committed PostgreSQL dump (23 MB) | SQL | - |

> **The MINT chart and `ui` are not here.** Both were submodule stubs. Both are gone
> ([ADR-0004](docs/adr/0004-no-submodule-stubs-for-external-repositories.md)).
>
> - **The MINT chart** — [`mintproject/mint`](https://github.com/mintproject/mint),
>   published at `https://mintproject.github.io/mint` (chart name `MINT`). It has
>   external consumers, so it stays external. Install it from the Helm repository.
>   `dynamo` pins the deployed version; nothing in this repository does.
> - **`ui`**, the deprecated LitElement frontend —
>   [`mintproject/mint-ui-lit`](https://github.com/mintproject/mint-ui-lit), removed
>   from TACC by [#81](https://github.com/mintproject/monorepo/issues/81).

> **Four repositories left this checkout in the single-repo cutover**
> ([#146](https://github.com/mintproject/monorepo/issues/146)):
> `model-catalog-ontology/`, `MINT_USERGUIDE/`, `model-catalog-fetch-api-client/` and
> `dynamo-experiment-may/`. Two stay maintained, and both keep outside forks. Read them
> where they live. Do not copy their content here:
>
> - The OWL ontology for the model catalog schema:
>   [`mintproject/Mint-ModelCatalog-Ontology`](https://github.com/mintproject/Mint-ModelCatalog-Ontology)
> - The user documentation:
>   [`mintproject/MINT_USERGUIDE`](https://github.com/mintproject/MINT_USERGUIDE)
>
> `model-catalog-fastapi` (legacy REST API v1.8.0, RDF/SPARQL) is archived. Use
> `model-catalog-api/` (v2.0.0). `model-catalog-endpoint` (the Fuseki triplestore) also
> left this checkout, but its repository stays live. It holds the TriG source file.

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
Not in this repository. Clone
[`mintproject/mint-ui-lit`](https://github.com/mintproject/mint-ui-lit) separately, and
only for maintenance of the old app. New frontend work goes in `ui-react/`.
```bash
git clone https://github.com/mintproject/mint-ui-lit.git
cd mint-ui-lit
yarn install && yarn start          # Development with hot reload
yarn test                           # Jest
yarn build                          # Production build
```

### ETL Pipeline
This moved the catalog from RDF/Fuseki to PostgreSQL. **The migration is finished.**
Nothing in a deployment runs it. It survives to seed a new database, to reload after a
schema change, and to audit the migration. See `etl/README.md`.

The TriG source file is not in this repository, and the Fuseki endpoint it came from is
retired. Download it from
[`mintproject/model-catalog-endpoint`](https://github.com/mintproject/model-catalog-endpoint)
at `data/model-catalog.trig`, then pass the path. Prefer the wrappers in `scripts/`; they
handle credentials and take a backup first.
```bash
python3 etl/run.py --trig-path <path>/model-catalog.trig
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

Shared MicroK8s cluster: kubectl context `microk8s`, namespace `mint`, helm release `mint` (NOT `testing-mint`, despite the chart's own README). Every branch push builds a deployable image, so a branch can be tested before merge. Use the `test-on-k8s-dev` skill.
