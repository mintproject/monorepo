# Canonical ETL variable contract

Status: Implemented

## Objective

Finish the canonical variable contract for the SVO adapter so locally registered
ETLs, MINT-synchronized ETLs, the ETL Pieces UI, and planner/runtime execution
share one vocabulary while existing registered ETLs continue to run.

## User need

ETL authors and UI callers need stable names for spatial sources, spatial scope,
model grids, temporal values, runtime values, and variable metadata. Existing
GMA/DFC pieces currently use several historical names and must not require an
immediate re-seed or behavior-changing migration.

Problem-framing recommendation requests also need an optional `spatial_conditions`
map so spatial parameters can be supplied as structured context without being
flattened into the free-text query.

## Current code/system summary

The adapter stores transform hints in `parameters_schema_json.tapis` and builds
workflow parameters from `env_from_args`. A partial uncommitted change already
adds `/etl/common-variables`, runtime spatial defaults, and UI datalist support,
but it has a duplicate `geometry_area_uri` vocabulary, hardcoded catalog shape,
and separate alias tables in `main.py` and `mint_sync.py`. Task code still reads
legacy environment names directly.

The committed GMA fixture uses `source_uri` for model inputs, `gma_boundary_uri`
for a primary boundary, `dfc_area_boundary_uri` for a second overlay boundary,
`gma_id`, `county_name`, `gcd_name`, `area_type`, and `layer`. The second DFC
boundary is semantically distinct from the primary geometry source and cannot be
collapsed without changing the transform input contract.

## Proposed design

1. Add `app/etl_contract.py` as the single source of truth for canonical variable
   definitions, aliases, label normalization, environment names, and argument
   normalization. Canonical keys take precedence when both canonical and legacy
   forms are supplied.
2. Keep `source_uri` as the runtime/model input URI. Use `geometry_source_uri`
   for spatial feature/boundary/grid sources. Preserve `dfc_area_boundary_uri`
   on two-source DFC transforms as an intentional compatibility alias until a
   multi-source geometry contract exists; it is not treated as a second value for
   the same canonical key in those manifests.
3. Normalize transform `env_from_args` at registration and planner serialization
   where it is safe. Normalize old plan submission arguments at ingress and add
   legacy aliases to the validation allowlist. This allows old registry rows and
   persisted plans to execute without re-seeding.
4. Make generated workflow parameter definitions canonical, while retaining the
   task environment keys used by existing hosted functions. Update task code to
   read canonical environment keys first and legacy keys second.
5. Expose `GET /etl/common-variables` and `GET /spatial/layers`. The latter is
   the backend catalog with id, label, URI, source/geometry type, default filter
   field, CRS, format, and tags. Runtime defaults remain a compatibility surface
   but do not become a second catalog.
6. Make MINT label mapping consume the common catalog. Canonical labels map to
   canonical argument names; legacy labels are accepted. Secret/runtime-only
   metadata is described but no secret value is returned in default UI payloads.
7. Update the adapter UI to load the spatial catalog, support a known-layer
   selection plus custom URI override, emit canonical arguments for new requests,
   and preserve legacy duplicate arguments only where existing DFC task behavior
   requires them.
8. Extend problem-framing recommendation request types and the semantic-search
   API with optional `spatial_conditions: Record<string, unknown>`. Include it in
   context only as structured request metadata (not as a hard spatial filter)
   unless a future search implementation explicitly consumes a field.

## Files likely affected

- `svo-adapter-service/app/etl_contract.py` (new source of truth)
- `svo-adapter-service/app/main.py`, `app/planner.py`, `app/tapis.py`,
  `app/mint_sync.py`, `app/task_code.py`
- `svo-adapter-service/app/config.py`
- `svo-adapter-service/examples/gma_dfc_transforms.json`
- `svo-adapter-service/static/index.html`, `static/js/main.js`, `static/js/state.js`
- focused adapter tests and new contract tests
- `svo-adapter-service/README.md`, `svo-adapter-service/docs/api.md`
- `semantic-search-service/main.py` and problem-framing UI request types/callers

## API/schema changes

- Add `GET /spatial/layers`.
- Complete `GET /etl/common-variables` with canonical definitions, aliases,
  labels, env names, categories, enum values, and secret/runtime-only metadata.
- Add optional `spatial_conditions` map to problem-framing recommendation request
  payloads. No database schema change is required.

## Data flow

`MINT labels / local manifest env_from_args / UI args`
→ shared canonical normalization
→ canonical plan parameters and workflow interpolation
→ canonical-first task environment reads with legacy fallback
→ existing transform semantics.

Problem framing sends `spatial_conditions` alongside title, region, dates, and
selected variables when available; the search service preserves it as request
context without turning it into an accidental hard filter.

## Risks and tradeoffs

- A single geometry URI cannot represent both the GMA and DFC-area boundaries;
  retaining the area alias is safer than silently binding both task inputs to one
  value.
- Canonicalizing old schema property names can change persisted plan display, so
  legacy aliases remain accepted by validation and are only converted at the
  workflow boundary.
- MINT labels are user-authored and ambiguous; unknown labels continue to warn
  and skip rather than guessing.
- Spatial conditions are optional and advisory in search until the search index
  defines a stable structured filter contract.

## Alternatives considered

- Maintaining separate alias tables in `main.py`, MINT sync, UI, and task code:
  rejected because they already diverged.
- Renaming every persisted ETL row in-place: rejected because it would require
  coordinated re-seeding and risks changing old task semantics.
- Encoding all spatial context into the free-text problem statement: rejected
  because structured spatial values must remain machine-readable.

## Test plan

- API tests for both catalogs and secret omission.
- Unit tests for canonical-over-legacy precedence, legacy aliases, and
  two-source DFC preservation.
- MINT label-to-canonical mapping tests.
- Planner/workflow tests for canonical parameter emission.
- Generated task-code tests for canonical-first and legacy fallback reads.
- Semantic-search and UI request tests for optional `spatial_conditions`.
- Run the focused adapter pytest suite, semantic-search tests, and the relevant
  UI unit/type checks if dependencies are available.

## Documentation plan

Document the canonical contract, geometry versus spatial scope, alias policy,
catalog endpoints, ETL manifest declaration guidance, runtime-only secrets, and
the intentional DFC secondary-boundary compatibility exception.

## Rollout/rollback plan

The change is additive: deploy the backend catalog and canonical readers first,
then update manifests/UI. Existing plans remain accepted. Rollback is a code
rollback; no database or external catalog mutation is required.

## Open questions

- A future multi-source geometry contract may replace the DFC area alias with a
  first-class named geometry-source map. This change does not invent that schema.

## Decisions

- 2026-09-23: Use one backend catalog module and preserve canonical precedence.
- 2026-09-23: Preserve `dfc_area_boundary_uri` where it is a second geometry
  input; do not map both boundary URIs onto one key.
- 2026-09-23: Add `spatial_conditions` as an optional map to problem framing,
  passed as structured metadata rather than flattened text.
- 2026-09-23: Implemented the shared catalog in `app/etl_contract.py`, with
  canonical planner/workflow parameters and canonical-first task readers.
- 2026-09-23: Kept the DFC secondary boundary as `dfc_area_boundary_uri` and
  made its MINT mapping order-independent so two distinct URIs cannot collapse.
- 2026-09-23: Focused pytest execution was attempted but blocked by the local
  Python/toolchain environment; JSON parsing and `git diff --check` completed
  successfully.
- 2026-09-23: Carry problem-framing region context into UI adapter-plan values
  and apply the backend spatial-layer default for `geometry_source_uri`, so
  canonical parameters are populated before submission.
- 2026-09-24: Have MINT consume `/spatial/layers` through `SVO_ADAPTER_API`;
  the Setup Models map defaults to the catalogued TWDB GMA layer, supports
  switching known boundary layers, and keeps a custom geometry URI usable.
- 2026-09-24: Use registered MINT region geometries as the preferred map source
  for boundary selection. Keep `/spatial/layers` as the ETL/source metadata
  registry and fallback for unregistered external layers. Extend Region Editor
  import to accept remote GeoJSON and ArcGIS layer URLs so external boundary
  sources can be registered in MINT.

## User feedback / decisions

- The user requested completion from the current partially modified branch,
  backward-compatible aliases, and optional spatial conditions as a map during
  problem framing. The user then clarified that the spatial context must be an
  actual cartographic map and that GMA boundaries need to be selectable and
  viewable in MINT.
