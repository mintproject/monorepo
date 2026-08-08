# ADR-0001: Model Catalog moves from Fuseki/SPARQL to PostgreSQL/Hasura GraphQL

- **Status:** Accepted — implemented and shipped (DYNAMO v2.0, 2026-03-15)
- **Deciders:** MINT platform engineering (ISI)
- **Supersedes:** the RDF triplestore data path (`model-catalog-endpoint` + `model-catalog-fastapi`)
- **Related:** [ADR-0002](0002-react-frontend-replaces-litelement-ui.md), `.planning/_archive/2026-dynamo-v2/`

---

## Context

The MINT Model Catalog stored all model metadata as RDF in an Apache Jena Fuseki
triplestore (`model-catalog-endpoint`, dataset `modelcatalog`), loaded from a TriG
dump. `model-catalog-fastapi` (Python/FastAPI, API `v1.8.0`) served REST by executing
per-resource SPARQL query templates — one directory of `.rq` files per ontology type
(`queries/ModelConfiguration/`, `queries/DatasetSpecification/`, `queries/custom/…`).
Clients consumed it through the generated `@mintproject/modelcatalog_client` SDK.

This worked but constrained the platform:

- **Two stores, two query languages.** Workflow data (problem statements, tasks,
  threads, executions, regions, datasets) already lived in PostgreSQL behind Hasura.
  Model catalog data lived in Fuseki behind SPARQL. Nothing could join across them,
  and every integration had to speak both.
- **No referential integrity.** RDF has no foreign keys. `execution` and `thread_model`
  rows referenced model catalog entities as opaque URIs with nothing enforcing they
  resolved.
- **Query cost.** Every REST endpoint was a hand-written SPARQL template. Adding a
  field or a relationship meant editing `.rq` files by hand; there was no schema to
  generate types from.
- **Operational weight.** Fuseki was an extra stateful service in every deployment
  whose only consumer was one API.

## Decision

**Move the model catalog into PostgreSQL under a `modelcatalog_*` schema, expose it
through the existing Hasura GraphQL engine, and keep REST alive as a thin facade.**

Four parts:

### 1. A purpose-built relational schema, not a translation of the old tables

Fresh `modelcatalog_*` tables (~38: 17 entity + 18+ junction, plus `standard_variable`
and `unit`) modelling the Software Description Ontology's four-level hierarchy directly:

```
Software → SoftwareVersion → Configuration → Setup
```

- A **Setup is not a separate table** — it is a `modelcatalog_configuration` row with a
  non-null `model_configuration_id` (its parent config). A Configuration has that column
  null. There is no type discriminator column.
- **All primary keys are URI text fields**, preserving the RDF identity of every entity
  so external references and `owl:sameAs` links survive the move.
- **Many-to-many relationships become junction tables** (`modelcatalog_configuration_input`,
  `…_category`, `…_region`, …). A few carry extra columns (`is_optional` on
  `configuration_input`).
- The `modelcatalog_` prefix avoids collision with the pre-existing flat `model`,
  `model_io`, `model_parameter` tables.

### 2. A one-time Python ETL, not a live bridge

`etl/run.py` reads the TriG dump and loads PostgreSQL. It is idempotent
(`ON CONFLICT DO NOTHING`), so it is safe to rerun, and does two-pass loading for
self-referential FKs (`region.part_of`, `model_category.parent_category`,
`configuration.model_configuration_id`).

### 3. REST survives as a facade over Hasura, in a new implementation

`model-catalog-api` (TypeScript/Fastify, API `v2.0.0`) replaces the FastAPI service.
Request path:

```
HTTP → Fastify + openapi-glue (operationId routing) → Proxy (service.ts)
     → CatalogServiceImpl (generic CRUD) → Apollo Client → Hasura → PostgreSQL
```

Design points that are load-bearing and easy to break:

- **`service.ts` is a JavaScript `Proxy`.** It intercepts ~245 operationIds and
  dispatches them to five generic CRUD handlers (list / getById / create / update /
  delete) plus ~15 custom handlers. There is no per-resource controller file.
- **`resource-registry.ts` is the map**: 46 resource types → Hasura table name, fields,
  relationship metadata, junction FK columns (with an optional `targetFkColumn` override).
  `field-maps.ts` controls which GraphQL fields are selected per table.
- **The OpenAPI spec is preprocessed** (schemas stripped before AJV compilation).
  This took startup from ~31s to under 1s and is not cosmetic.
- **Auth is split by operation.** Reads use `X-Hasura-Admin-Secret`; writes forward the
  caller's `Authorization: Bearer` JWT to Hasura. **The API layer never validates the
  token itself** — Hasura is the single enforcement point.
- **Junction tables get insert+delete only; entity tables get full CRUD.** A junction
  row is a link, not a thing you edit.
- **`username` is accepted and ignored.** There is no `user_id` column on any
  `modelcatalog_*` table; the catalog is not user-owned.

### 4. `v1.8.0` stays up, permanently

External consumers depend on the FastAPI contract. It remains served for parallel
validation and backward compatibility. Fuseki itself is now disabled by default in the
Helm chart (`model_catalog_endpoint.enabled: false`).

## Nested writes (v2.1.0, 2026-05-09)

The first cut only wrote one level deep, which forced clients to orchestrate multi-step
creates and leak orphans. v2.1.0 changed the write contract:

- `POST`/`PUT` accept **arbitrarily nested payloads** (depth ≤ 8, ≤ 500 nodes, ≤ 200 per
  array), executed as a **single atomic Hasura mutation**.
- `PUT` has **replace-subtree semantics**: the payload *is* the new state of every
  relationship at every depth. Junction updates are delete-then-insert.
- `update_columns` is computed per nested row from the keys actually supplied, so an
  id-only link does not clobber the target's scalars (bug-087).
- **Breaking:** relationship arrays no longer accept bare strings. Send
  `hasInput: [{ id: "…" }]`; `hasInput: ["…"]` returns `400 STRING_ID_DEPRECATED`.

## Consequences

**Good**

- One endpoint, one query language, one schema. Model catalog and workflow data are
  joinable and share a permissions model.
- Real foreign keys. `execution` and `thread_model` FKs now point at
  `modelcatalog_configuration`; orphans were deleted before constraints were added.
- Types are generated, not hand-maintained (`npm run codegen` against Hasura).
- Fuseki left the deployment.
- `@mintproject/modelcatalog_client` was removed from `mint-ensemble-manager`, which now
  issues GraphQL directly.

**Costs and open debt**

- Two REST APIs are alive at once (`v1.8.0` FastAPI/SPARQL, `v2.0.0` Fastify/Hasura).
  This is deliberate and indefinite, not a transitional state anyone is racing to end.
- Old `model` / `model_io` / `model_parameter` tables still exist for FK compatibility.
- Docker Compose and CI still carry Fuseki references that were never cleaned up.
- One `model_io` row of 136 did not match during migration — accepted as a data quality issue.
- `username` being a no-op will need revisiting if catalog entries ever become user-owned.
- **No row-level security on any `modelcatalog_*` table.** Every permission filter is `{}`.
  This differs sharply from `thread`/`task`/`problem_statement`, which enforce ownership
  via `X-Hasura-User-Id`. Any client that writes must not assume Hasura will scope it.

## Traps for anyone working here

- The `anonymous` Hasura role can `SELECT` `modelcatalog_*` and use `distinct_on`, but
  **`*_aggregate` fields are not exposed to it** — no server-side facet counts for
  logged-out users. The public ISI endpoint (`graphql.mint.isi.edu`) is stricter still.
- The `anonymous` role **cannot read `modelcatalog_standard_variable`**, so the
  relationship from `variable_presentation` silently resolves to `null` rather than erroring.
- Catalog URIs mix namespaces. Resolve a slug with a suffix match
  (`_ilike '%/<slug>'`), never by reconstructing a fixed MINT prefix.
- `npm run codegen` needs both `HASURA_ENDPOINT` and `HASURA_ADMIN_SECRET`. Without the
  secret, introspection returns no `modelcatalog_*` types and silently generates a
  broken file.

## References

- Archived migration record: `.planning/_archive/2026-dynamo-v2/` (12 phases, PROJECT.md, ROADMAP.md)
- Backend inventory (tables, permissions, operationIds): `.planning/research/backend-inventory.md`
- API changelog: `model-catalog-api/CHANGELOG.md`
- Domain concepts (ontology, SVO, units): `knowledge-base/wiki/index.md`
