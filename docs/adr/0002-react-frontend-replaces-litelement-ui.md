# ADR-0002: `ui-react` replaces the LitElement `ui`, talking directly to Hasura

- **Status:** Accepted — in progress. `ui-react` is the frontend of record; `ui` is deprecated but still the deployed default.
- **Deciders:** MetaLearn engineering, TACC stakeholders (SOW: MINT Model Catalog UI Modernization)
- **Related:** [ADR-0001](0001-model-catalog-postgres-hasura-over-fuseki-sparql.md); design ADRs 001–006 in `.planning/design/adrs/`

---

## Context

The MINT UI (`ui/`, shipped as the `mintproject/mint-ui-lit` image) is a LitElement /
Web Components app: Webpack 4, Redux, Weightless components, and the generated
`@mintproject/modelcatalog_client` REST SDK. The audit found ~110 files across 8 screen
modules, with `model-view.ts` at 3,256 LOC and a 1,709-line generic base class
(`resource.ts`) driving all model-catalog CRUD by programmatically instantiating
components.

The concrete user problem, and the SOW's hard acceptance criterion (§8): associating a
variable with a model input requires walking **five levels of nested shadow-DOM modals** —

```
ModelConfiguration → DatasetSpecification → VariablePresentation
                   → StandardVariable → Unit
```

— with mixed save semantics along the way (parameters and dataset specs batch on parent
save; variable presentations, standard variables and units save eagerly on modal close),
which strands orphan entities on partial saves. Domain scientists on SUBSIDE could not
reliably complete it.

[ADR-0001](0001-model-catalog-postgres-hasura-over-fuseki-sparql.md) had just put the
whole catalog behind Hasura, which made a different data path possible. Note that the
backend migration was explicitly **out of scope** for the UI: the Lit app kept using the
REST SDK throughout and was never touched by it. The two migrations are independent.

## Decision

**Build a new React app at `ui-react/` alongside the untouched `ui/`, and have it talk
directly to Hasura with Apollo Client — not through the Model Catalog REST API.**

### Stack

| Area | Choice |
|---|---|
| Framework / build | React 18 + TypeScript strict (`noUncheckedIndexedAccess`) + Vite 5 |
| UI | Tailwind CSS 3 + shadcn/ui (Radix primitives) — replaces Weightless |
| Data | Apollo Client 3 → Hasura directly; GraphQL Code Generator for types |
| State | Apollo normalized cache + React context. **No Redux.** |
| Routing | React Router 6 |
| Forms | React Hook Form + Zod |
| Tests | Vitest + Testing Library + MSW; Playwright for E2E smoke |
| Auth | OAuth2 (Keycloak / Tapis) |
| Node | ≥ 20 |

`ui-react/` is **not a submodule** — it lives directly in this repo, unlike `ui/`,
`model-catalog-api`, and `mint-ensemble-manager`.

### Data path: direct Hasura, both reads and writes

This is the decision with the most downstream consequence, and it is where the two
frontends diverge:

```
ui  (Lit)   →  @mintproject/modelcatalog_client  →  model-catalog-api v2.0.0  →  Hasura
ui-react    →  Apollo Client                     ────────────────────────────→  Hasura
```

- **Reads** go anonymously (no auth header ⇒ Hasura applies the `anonymous` role).
- **Writes** attach the user's JWT via an Apollo `setContext` link that reads the token
  **at request time**, not at client construction — this fixes the legacy UI's stale-token
  bug, where auth headers were baked in at Apollo client creation.
- Rationale over REST: the REST facade caps nesting at 2 levels and fixes field selection
  per `field-maps.ts`, while the flattened form needs 3-level reads and Hasura's full
  nested-insert syntax for writes. Going direct also drops a hop and makes types
  generatable from schema introspection.

The REST API keeps its value for the legacy UI and external integrations. `ui-react`
simply does not need it.

### Redux dies with the SDK

The legacy `modelCatalog` Redux slice was a hand-rolled normalized entity cache over REST
responses (40+ `IdMap`s, two action types). Apollo's normalized cache subsumes it
entirely, with cache invalidation, optimistic updates, and query deduplication for free.

### The flattened form

The 5-level modal chain collapses into a single form. Underlying ontology entities
(`DatasetSpecification`, `VariablePresentation`, and the links to `StandardVariable` and
`Unit`) are created automatically from form data in one nested Hasura mutation, with
server-side typeahead over the ~303 standard variables and ~107 units.

### Not a Lit rewrite

Do **not** port LitElement patterns — Redux, Webpack, Lit decorators,
`@lit/reactive-element` — into `ui-react`. Screens ported "1:1" mean behaviour parity,
not structural parity.

## Current state (2026-08-09)

**Ported and merged** (route → page): `/` home, `/models` faceted configuration browser,
`/models/register` and `/models/configure/:slug` (config-first registration replacing the
3-step wizard), `/modeling/*` problem statements → tasks → threads with the atomic-step
thread wizard and the datasets/parameters/runs/results steps, `/datasets/*`, `/regions/*`
including the editor, `/variables` as a standard-variable-primary searchable catalog,
plus OAuth2 callback and login-required routes.

> **Correction (2026-08-09, issue #104).** Until this date the parameters, runs and results
> steps were listed above but were **stubs**: their component was rendered, and nothing ever
> loaded the execution state it reads, so the wizard dead-ended at Parameters. The Datasets
> step wrote no binding either. Both are fixed — `GetThreadExecution` loads the pipeline and
> the two steps persist what they collect. Do not read the paragraph above as a porting
> inventory: a route being listed means a component exists at it, not that its data path is
> wired.

**Not ported** (still Lit-only): Analysis, Emulators, Messages, `models-compare` /
`models-calibrate` / `models-cromo`, thread Visualize and Summary, and the 3,256-LOC
`model-view` detail screen. Some of these are dead or stubbed in the Lit app anyway
(Messages has no backend since Firebase was removed; several Analysis screens are
placeholders).

**Deliberately dropped:** dataset register and data-transformation pages (PR #60).

**Deployment.** Vercel previews came first (with a dedicated OAuth path for preview
origins). `ui-react` is now containerized — `Dockerfile`, `docker/entrypoint.sh`,
`docker/nginx.conf` — and the Vite bundle is built once via `$BUILDPLATFORM` so the arm64
image does not run the build under QEMU. `helm-charts` gained an **opt-in, disabled-by-default
`ui_react` component** in `9.0.0-beta.3`, deriving service endpoints from the other
components' own ingress declarations. The legacy `ui` component is byte-for-byte unchanged.

**Cutover has not happened.** The primary host still serves `mint-ui-lit`. Flipping it and
retiring the legacy component is explicitly out of scope of the deployment work.

### Runtime configuration

Both deployment targets read a single nested `window.__MINT_CONFIG__` object (the Lit app
used flat `window.REACT_APP_*` globals — the two contracts are incompatible). One
generator function is the source of truth: Vercel invokes it at build time, the container
entrypoint at startup. `getRuntimeConfig()` reads `window.__MINT_CONFIG__` at call time
and falls back to `VITE_*` env vars for local dev.

## Consequences

**Good**

- The acceptance criterion is met: a model input's variable, standard variable, and unit
  are configured in one form submission.
- ~40% of the legacy surface is gone rather than ported — dead screens were not carried over.
- Type-safe queries end to end; no hand-maintained SDK.
- Both UIs run side by side against the same live data, so the replacement can be
  validated before any cutover.

**Costs and open risks**

- **Two frontends are maintained at once**, and the deprecated one is the one users get.
- `ui-react` inherits ADR-0001's permission gaps directly, with no REST layer to hide
  them (see Traps).
- The un-ported screens are a hard blocker on retiring `ui/`. There is no dated plan for
  them.
- The `helm-charts` submodule pointer in this repo is still at `9.0.0-beta.2`; the
  `ui_react` chart component landed in `9.0.0-beta.3` upstream and needs a bump here
  before it is reachable from the monorepo.
- `getModelCatalogApiUrl()` in `ui-react/src/lib/config.ts` **has no callers** and its
  default still points at the retired SPARQL-era `…/v1.8.0` endpoint. It is dead code
  that reads as a live dependency.

## Traps for anyone working here

- **No `_aggregate` for anonymous users.** Facet counts must be derived client-side or omitted.
- **`standard_variable` is unreadable anonymously**, so the `/models` "Output variable"
  facet is empty when logged out while Region and Category work. It fails as `null`, not
  as an error.
- **Apollo cache normalization needs junction `keyFields`.** Junction rows have no single
  `id`; without explicit `keyFields` in type policies they collapse into each other (PR #62).
- **cmdk + shadcn `command.tsx`:** cmdk emits `data-disabled="false"` on enabled items,
  and the shadcn default uses the attribute-presence variant `data-[disabled]:`, which
  matches regardless of value — every enabled option renders greyed and unclickable. Use
  `data-[disabled=true]:`. jsdom cannot catch this (no Tailwind applied, and `userEvent.click`
  ignores `pointer-events`); verify in a real browser.
- **`DATA_CATALOG_API` is overloaded** — the CKAN Action API base and the human-browsable
  iframe URL are different things and were conflated. `DATA_CATALOG_BROWSE_URL` splits
  them (PR #63); issue #59 tracks the remaining cleanup.
- Regenerating types requires a reachable Hasura **and** the admin secret; otherwise
  codegen silently emits a file with no `modelcatalog_*` types.

## References

- Design ADRs 001–006 (framework, state, GraphQL client, component library, forms,
  autocomplete): `.planning/design/adrs/`
- UI audit (full Lit screen inventory with LOC and data sources): `.planning/research/full-ui-audit.md`
- Project scope and phases: `.planning/PROJECT.md`
- App-level guidance: `ui-react/CLAUDE.md`
