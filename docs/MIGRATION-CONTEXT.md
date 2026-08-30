# MINT Migration Context

A single reusable briefing on the two migrations that define this repo's current shape.
Paste the [Prompt preamble](#prompt-preamble) into an agent or hand the whole file to a
new contributor. Decisions and rationale live in
[ADR-0001](adr/0001-model-catalog-postgres-hasura-over-fuseki-sparql.md) and
[ADR-0002](adr/0002-react-frontend-replaces-litelement-ui.md); this file is the state of
play.

**Last verified:** 2026-08-08 against `develop` @ `fdbaee5`.

---

## The two migrations in one picture

```
BEFORE                                           AFTER
──────                                           ─────
Fuseki (RDF/TriG)                                PostgreSQL  modelcatalog_*
   │ SPARQL .rq templates                           │
model-catalog-fastapi  v1.8.0  ─── retired ────▶  Hasura GraphQL
   │ REST                                           │
@mintproject/modelcatalog_client                  model-catalog-api  v2.0.0 (REST facade)
   │                                                │
ui/  LitElement + Redux + Webpack ─ still deployed ─┘
                                                  ui-react/  React 18 + Vite + Apollo
                                                     └── talks to Hasura DIRECTLY
```

They are **independent**. The backend migration deliberately left the Lit UI alone; the
frontend migration is not what moved the data. Do not describe one as a phase of the other.

---

## Migration A — Model Catalog: SPARQL → GraphQL

**Status: complete and shipped** (DYNAMO v2.0, 2026-03-15). Record archived at
`.planning/_archive/2026-dynamo-v2/` (12 phases).

| | Before | After |
|---|---|---|
| Store | Apache Jena Fuseki, TriG/RDF | PostgreSQL, `modelcatalog_*` schema |
| Query | SPARQL `.rq` templates per type | GraphQL (Hasura) |
| API | `model-catalog-fastapi` (Python) `v1.8.0` | `model-catalog-api` (TS/Fastify) `v2.0.0` |
| Client | `@mintproject/modelcatalog_client` SDK | GraphQL, or REST facade |
| Load | — | `etl/run.py`, TriG → Postgres, idempotent |

**`v1.8.0` is deprecated (2026-08-29).** The `model-catalog-fastapi` repo is archived and
unmaintained; `v2.0.0` is the only maintained REST API. Fuseki itself is disabled in the
chart (`model_catalog_endpoint.enabled: false`).

### The data model you must know before writing a query

- Hierarchy: **Software → SoftwareVersion → Configuration → Setup**.
- A **Setup is not its own table.** It is a `modelcatalog_configuration` row with non-null
  `model_configuration_id`. A Configuration has it null. No type column exists.
- **All PKs are URI text**, carried over from RDF.
- M:M via junction tables; a few carry payload columns (`is_optional` on `configuration_input`).
- ~38 tables: 17 entity + 18+ junction + `standard_variable` (~303 rows) + `unit` (~107 rows).
- Category data lives on `configuration.categories` (215 rows) far more than on
  `software.categories` (58) — filter on the former.

### How `model-catalog-api` is built

- `service.ts` is a **JavaScript Proxy** intercepting ~245 operationIds → 5 generic CRUD
  handlers + ~15 custom ones. There are no per-resource controllers to look for.
- `resource-registry.ts` maps 46 resource types → table, fields, junction FK columns.
  `field-maps.ts` picks which GraphQL fields are selected per table.
- OpenAPI is **preprocessed** (schemas stripped pre-AJV): startup 31s → <1s. Load-bearing.
- **Reads use the admin secret; writes forward the caller's JWT.** The API never validates
  tokens — Hasura is the only enforcement point.
- Junction tables: insert + delete only. Entity tables: full CRUD.
- `username` is accepted and ignored — no `user_id` column exists anywhere in the schema.

### v2.1.0 write contract (breaking)

- Relationship arrays take objects: `hasInput: [{ id: "…" }]`. Bare strings return
  `400 STRING_ID_DEPRECATED`.
- `POST`/`PUT` accept nested payloads (depth ≤ 8, ≤ 500 nodes, ≤ 200/array) as one atomic
  mutation. `PUT` is **replace-subtree**: the payload is the new state of every
  relationship at every depth.

---

## Migration B — Frontend: `ui` (Lit) → `ui-react`

**Status: in progress.** `ui-react` is the frontend of record for all new work. `ui/` is
deprecated **but still the deployed default** — cutover has not happened.

| | `ui/` (deprecated) | `ui-react/` (current) |
|---|---|---|
| Framework | LitElement + Webpack 4 | React 18 + TS strict + Vite 5 |
| Components | Weightless (`wl-*`), unmaintained | Tailwind 3 + shadcn/ui (Radix) |
| State | Redux, 3 slices | Apollo normalized cache + context. **No Redux.** |
| Data | REST SDK → `model-catalog-api` → Hasura | Apollo → **Hasura directly** |
| Forms | 1,709-LOC `resource.ts` base class | React Hook Form + Zod |
| Tests | Jest | Vitest + RTL + MSW; Playwright E2E |
| Repo | git submodule | **plain directory in this repo** |
| Package mgr | yarn | npm |

### Why it exists

Associating a variable with a model input took **five nested shadow-DOM modals**
(ModelConfiguration → DatasetSpecification → VariablePresentation → StandardVariable →
Unit) with inconsistent save semantics that stranded orphan entities. The SOW's hard
acceptance criterion is one form submission. That is met.

### What is ported

`/` · `/models` (faceted browser) · `/models/register` · `/models/configure/:slug` ·
`/modeling/*` (problem statements, tasks, threads, atomic-step wizard, datasets,
parameters, runs, results) · `/datasets/*` · `/regions/*` incl. editor · `/variables`
(standard-variable-primary catalog) · OAuth2 callback.

### What is not

Analysis · Emulators · Messages · `models-compare` / `models-calibrate` / `models-cromo` ·
thread Visualize and Summary · the 3,256-LOC `model-view` detail screen. Several are dead
or stubbed in the Lit app already. **These are the blocker on retiring `ui/`, and there is
no dated plan for them.** Dataset register and data-transformation pages were dropped
deliberately (PR #60).

### Deployment reality

- Vercel previews first, then containerized (`ui-react/Dockerfile`, `docker/entrypoint.sh`,
  `docker/nginx.conf`); Vite bundle built once via `$BUILDPLATFORM` to keep arm64 off QEMU.
- `helm-charts` `9.0.0-beta.3` adds an **opt-in, disabled-by-default `ui_react` component**
  deriving endpoints from other components' ingress declarations. Legacy `ui` untouched.
- ⚠️ **The `helm-charts` submodule pointer here is still `9.0.0-beta.2`** — the `ui_react`
  component is not reachable from the monorepo until it is bumped.
- Runtime config: nested `window.__MINT_CONFIG__`, one generator shared by Vercel
  (build time) and the container entrypoint (startup). The Lit app's flat
  `window.REACT_APP_*` contract is incompatible.

---

## Traps — read before debugging

**Hasura permissions**

1. The `anonymous` role has no `*_aggregate` fields. No server-side facet counts for
   logged-out users; derive client-side or omit.
2. The `anonymous` role **cannot read `modelcatalog_standard_variable`**. The relationship
   from `variable_presentation` resolves to `null` — it fails silently, not loudly. This is
   why the `/models` "Output variable" facet is empty when logged out while Region and
   Category work.
3. **No row-level security on any `modelcatalog_*` table** — every filter is `{}`. Unlike
   `thread`/`task`/`problem_statement`, which do enforce ownership via `X-Hasura-User-Id`.

**Frontend**

4. Apollo needs explicit `keyFields` for junction types; without them junction rows have
   no stable identity and collapse into each other (PR #62).
5. cmdk emits `data-disabled="false"` on *enabled* items; shadcn's default
   `data-[disabled]:` matches on attribute presence, greying out every option. Use
   `data-[disabled=true]:`. **jsdom cannot catch this** — verify in a browser.
6. `DATA_CATALOG_API` was overloaded (CKAN Action API base vs. browsable iframe URL);
   `DATA_CATALOG_BROWSE_URL` splits them. Issue #59 tracks the rest.
7. `getModelCatalogApiUrl()` in `ui-react/src/lib/config.ts` has **no callers** and still
   defaults to the retired `…/v1.8.0` SPARQL-era endpoint. Dead code that looks live.

**Tooling**

8. `npm run codegen` needs a reachable Hasura **and** `HASURA_ADMIN_SECRET`. Without the
   secret it silently generates a file containing no `modelcatalog_*` types.
9. Resolve catalog URIs by suffix match (`_ilike '%/<slug>'`) — namespaces are mixed, so
   reconstructing a fixed MINT prefix breaks. See `slugFromUri` in `ui-react/src/lib/uri.ts`.

---

## Prompt preamble

Copy this into an agent working anywhere in the monorepo.

```text
MINT monorepo context. Two migrations define the current state; they are INDEPENDENT.

1) MODEL CATALOG BACKEND — DONE (DYNAMO v2.0, shipped 2026-03-15).
   Apache Fuseki (RDF/TriG, SPARQL) → PostgreSQL `modelcatalog_*` + Hasura GraphQL.
   - Legacy `model-catalog-fastapi` v1.8.0 (SPARQL) is DEPRECATED (2026-08-29); its
     repo is archived and unmaintained. `model-catalog-api` v2.0.0 (TS/Fastify) is a
     thin REST facade over Hasura and the only maintained REST API.
   - Hierarchy: Software > Version > Configuration > Setup. A "Setup" is NOT its own
     table — it is a `modelcatalog_configuration` row with non-null
     `model_configuration_id`. No type column.
   - All PKs are URI text. M:M via junction tables.
   - `service.ts` is a JS Proxy dispatching ~245 operationIds to 5 generic CRUD
     handlers; `resource-registry.ts` maps resource type → table.
   - Reads use the Hasura admin secret; writes forward the user's JWT. The API layer
     never validates tokens.
   - Write contract v2.1.0: relationship arrays are [{id}] not [string]; PUT is
     replace-subtree over nested payloads.

2) FRONTEND — IN PROGRESS.
   `ui/` (LitElement + Redux + Webpack, submodule, yarn) is DEPRECATED but still the
   deployed default. `ui-react/` (React 18 + Vite + Tailwind/shadcn + Apollo, plain
   directory in this repo, npm) is the frontend of record. All new frontend work goes
   to `ui-react/`.
   - `ui-react` talks to Hasura DIRECTLY via Apollo. It does NOT use the REST API.
     `ui/` still goes through the REST SDK. Never port Lit patterns (Redux, Webpack,
     Lit decorators) into `ui-react`.
   - Not yet ported, blocking retirement of `ui/`: Analysis, Emulators, Messages,
     models-compare/calibrate/cromo, thread Visualize/Summary, model-view.
   - Cutover has not happened; the primary host still serves mint-ui-lit.

TRAPS:
   - Hasura `anonymous` role: no `*_aggregate` fields, and CANNOT read
     `modelcatalog_standard_variable` (resolves to null, silently).
   - No row-level security on `modelcatalog_*` — all filters are {}.
   - Apollo needs explicit `keyFields` for junction types or the cache collapses rows.
   - shadcn/cmdk: use `data-[disabled=true]:`, not `data-[disabled]:`. jsdom cannot
     catch the bug; verify in a real browser.
   - `npm run codegen` silently emits an empty schema without HASURA_ADMIN_SECRET.
   - Resolve catalog URIs by suffix match (`_ilike '%/<slug>'`), not a fixed prefix.

Full detail: docs/MIGRATION-CONTEXT.md, docs/adr/0001-*, docs/adr/0002-*.
Domain concepts (ontology, SVO, units): knowledge-base/wiki/index.md.
Open PRs target `develop`, never `main`.
```

---

## Where to look next

| Question | File |
|---|---|
| Why each decision was made | `docs/adr/0001-*`, `docs/adr/0002-*` |
| Frontend stack sub-decisions (state, client, component lib, forms, autocomplete) | `.planning/design/adrs/ADR-001..006.md` |
| Every Hasura table, permission, and operationId | `.planning/research/backend-inventory.md` |
| Every Lit screen with LOC and data source | `.planning/research/full-ui-audit.md` |
| The backend migration as executed, phase by phase | `.planning/_archive/2026-dynamo-v2/` |
| API write-contract history | `model-catalog-api/CHANGELOG.md` |
| Working inside the React app | `ui-react/CLAUDE.md` |
| MINT science and ontology concepts | `knowledge-base/wiki/index.md` |

## Open issues touching these migrations

- **#59** — `DATA_CATALOG_API` overloaded: two clients, two defaults, an iframe URL.
- **#64** — arm64 image build via `$BUILDPLATFORM` (PR #66 merged; issue still open).
- **#65** — UI-React CI: Node 20 action deprecations, git exit-128 (PR #67 merged; issue still open).
- **#35** — Results post-processing: indicator comparison across a run ensemble.

No open PRs as of 2026-08-08.
