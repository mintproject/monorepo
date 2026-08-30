# MINT Model Catalog UI Modernization

## What This Is

Migration of the MINT Model Catalog UI from LitElement (Web Components) to React.
Scope is the **model configuration screens only** — not the rest of the platform.
Funded under TWDB / SUBSIDE via TACC. SOW lives at
`metalearn/MINT Model Catalog UI Modernization.md` (180 hrs, Apr 4 – Jun 30, 2026,
$9,000 NTE).

## Core Value

Domain scientists (groundwater, subsidence, hydrology) currently navigate a
5-level nested modal workflow to associate a variable with a model input:

    ModelConfiguration → DatasetSpecification → VariablePresentation
                       → StandardVariable → Unit

The new React UI flattens this into a **single unified form** with autocomplete
for the 303 Standard Variables and 107 Units. The underlying ontology entities
(DatasetSpecification, VariablePresentation, links to StandardVariable / Unit)
are created automatically from the form data via Hasura.

This is the SOW's hard acceptance criterion (§8): *a user can configure a model
input with variable, standard variable, and unit in a single form submission*.

## Phases

| Phase   | Dates              | Profile(s)              | Deliverable                                              |
|---------|--------------------|-------------------------|----------------------------------------------------------|
| Task 1  | Apr 4 – Apr 18     | mint-planner, mint-researcher     | Design Document + ADRs in `.planning/design/`            |
| Task 2  | Apr 21 – May 30    | mint-implementer, mint-reviewer   | Functional React app under `ui-react/`                   |
| Task 3  | Jun 1 – Jun 13     | mint-reviewer, mint-implementer   | Test report; UAT-resolved defects                        |
| Task 4  | Jun 16 – Jun 21    | mint-devops                       | Production deployment                                    |

Routing is performed by the **mint-orchestrator** profile on Kanban board
`mint-ui-react`. See `.planning/hermes-fleet/README.md` for the roster.

## Stack Decisions (to be ratified in Task 1 ADRs)

| Area              | Direction                                                         |
|-------------------|-------------------------------------------------------------------|
| Framework         | React 18 + TypeScript (strict)                                    |
| Build             | Vite (fast HMR; SPA scope; simpler than Webpack 4 / Next.js)      |
| State             | TBD in ADR — likely React Query + Apollo cache; no Redux          |
| GraphQL client    | Apollo Client (same endpoint as legacy)                           |
| Forms             | React Hook Form + Zod for validation                              |
| Component lib     | TBD in ADR — candidates: shadcn/ui, MUI, Mantine                  |
| Autocomplete      | Server-side typeahead against Hasura (303 vars, 107 units)        |
| Auth              | OAuth2 with existing Keycloak/Tapis providers                     |
| Tests             | Vitest + React Testing Library                                    |
| Deploy            | Multi-stage Docker (build → nginx static serve), Helm chart       |

## Layout

    /ui                       # legacy LitElement UI (untouched)
    /ui-react                 # new React app (created in Task 2.1)
    /model-catalog-api        # existing v2.0 REST → Hasura (untouched)
    /graphql_engine           # Hasura migrations/metadata (read-only here)
    /helm-charts              # updated in Task 4

## Git Strategy

- Base branch for ALL work: **`develop`**.
- `main` is release-only.
- Every Kanban card creates an isolated worktree under `.worktrees/<task-id>`.
- PRs target `develop`. Release PRs target `main` and are tagged
  (`ui-react-vX.Y.Z`).
- See SOUL.md files under `.planning/hermes-fleet/souls/` for the per-role
  branching rules.

## Out of Scope (SOW §6 — DO NOT fan out cards for these)

- Model browsing, search, and discovery views
- Migration of non-model-catalog screens (datasets, analysis, emulators, messaging)
- Backend changes beyond what the flattened form strictly requires
- ETL pipeline changes
- CLI tooling for bulk loading Standard Variables / Units
- User training and workshop facilitation

## Backend Context (assumed stable per SOW §5)

- Hasura GraphQL endpoint exposing `modelcatalog_*` tables (4-level hierarchy:
  Software > Version > Configuration > Setup).
- Model Catalog API v2.0 (Fastify/TypeScript) at `/v2.0.0/` proxying to Hasura.
- StandardVariable (303 entries) and Unit (107 entries) tables are pre-loaded.
- New Hasura mutations or Actions may be added by this project if required by
  the flattened form (SOW §5.4).

For the underlying DYNAMO v2.0 migration that produced this backend, see
`.planning/_archive/2026-dynamo-v2/`.

## Key References

- SOW: `metalearn/MINT Model Catalog UI Modernization.md`
- Repo CLAUDE.md: `/CLAUDE.md`
- OpenWolf context: `.wolf/OPENWOLF.md`, `.wolf/cerebrum.md`, `.wolf/anatomy.md`
- Codebase snapshots (as-is): `.planning/codebase/`
- Fleet config: `.planning/hermes-fleet/`
- Design artifacts (Task 1 output): `.planning/design/` (to be created by planner)
- Research dossiers (Task 1 input): `.planning/research/` (to be created by researcher)

---

_Last updated: 2026-05-20 — initial UI modernization PROJECT.md._
