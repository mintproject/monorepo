# MINT Model Catalog → SVO Adapter Transform Registry

**Status:** Implemented

---

## Objective

Wire the MINT model catalog (`model-catalog-api`) as the **sole** source of transform specs in the SVO adapter, so that any `ModelConfiguration` registered in MINT with typed I/O `DatasetSpecification`s automatically becomes an available edge in the BFS transform graph and a deployable Tapis Workflows task.

---

## User Need

A user says: "forecast subsidence for lat 29.76, lon -95.37."

The adapter should:
1. Look up which data objects exist near that location and what SVOs they carry
2. Consult the MINT catalog for all registered `ModelConfiguration`s that can bridge gaps in format, unit, or variable between what's available and what the subsidence model needs
3. Assemble the optimal ETL + model-run DAG via BFS
4. Emit and submit the Tapis Workflows pipeline using the Tapis app IDs already stored in MINT

No human writes fixture files or adapter-level transform specs. If a transform is not registered in MINT, it is not available to the BFS — and that is the intended constraint.

---

## Current System Summary

### What's built

**`adapter_transform_spec` table** — the BFS graph's edges. Currently populated by hand from `subside_forecast_transforms.json` via `register_forecast_planner.py`. Fields:
- `id`, `name`, `transform_type`, `method` (`tapis_function` | `tapis_job`)
- `tapis_app_id` — null on all current specs
- `contracts` (JSONB array) — `{role, standard_variable_uri, unit, format}`
- `env_from_args` (JSONB) — maps pipeline arg names to task env var names
- `stage` — STAGE env var passed to multi-mode Tapis apps

**`adapter_data_object` table** — registered data sources with SVO-tagged variables, resource URIs, and source catalogs.

**BFS planner (`planner.py`)** — `find_path(source, target, transforms)` walks the transform graph. `plan_model_run` resolves all inputs for a multi-input model. Works correctly; the graph has few edges because specs are hand-written.

**`generate_tapis_workflow` (`tapis.py`)** — already handles both task types:
- `tapis_app_id` present → `tapis_job` task referencing the registered app
- `tapis_app_id` absent → `function` task placeholder (currently missing `code`)

**MINT model-catalog-api** — REST API backed by Hasura/PostgreSQL. Relevant surfaces:
- `GET /modelconfigurations` — `ModelConfiguration` list with `inputs`/`outputs` (DatasetSpecifications) and `has_software_image`
- `GET /datasetspecifications?configurationid=…` — I/O specs per config, each with `presentations[].presentation.standard_variable.id`, `unit.id`, `has_format`
- `GET /custom/tapis-apps/{tenant}` — flat proxy to Tapis Apps API, returns `{id, version}` only. **No filter by software image; no JOIN to MINT configs.** (See Q2 decision below.)

### The gap

`adapter_transform_spec` is populated from fixture files, not MINT. `tapis_app_id` is always null. There is no link between a MINT `ModelConfiguration` and its Tapis app ID anywhere in the current system. `generate_tapis_workflow` produces task skeletons with no code for function tasks.

---

## Decisions Made During Review

**D1 — MINT is the only source of truth.**
Hand-created specs outside MINT are not supported. If a transform isn't registered in MINT, it does not exist in the adapter. There is no fallback population of `adapter_transform_spec` from fixture files. Existing fixture-based specs are deprecated; they are replaced by MINT-registered equivalents.

**D2 — env_from_args: convention required, no override column.**
Tapis apps registered in MINT must follow the standard parameter label convention (see §3). If an app's parameters don't follow the convention, the sync will emit a warning and skip the env_from_args mapping — the transform spec row is created but with an empty `env_from_args`. No `env_override` mechanism is added to the adapter. The fix is to update the MINT catalog entry (correct the parameter labels).

**D3 — geo_actor handles rasterio / GDAL.**
`point_extract` and all GDAL-based transforms call the `geo_actor` service from `mcp_suite` via HTTP rather than installing rasterio inline in OWE function tasks. The function task code makes an HTTP request to the geo actor's endpoint. This avoids the 100MB/30s pip install per run and centralises geospatial capability.

**D4 — Common transforms (GDAL, rolling averages, unit conversion) will be registered in MINT.**
They don't exist in MINT today. Registering them as `ModelConfiguration`s in MINT is part of this work's scope (see §6, Rollout). Once registered, the sync pulls them automatically.

**D5 — tapis_app_id: new field on ModelConfiguration in MINT.**
`/custom/tapis-apps/{tenant}` is a flat proxy to the Tapis API (`{id, version}` only). It has no link to MINT's `has_software_image`. The resolution `has_software_image → tapis_app_id` does not exist and cannot be derived without per-app roundtrips. Decision: add a `tapis_app_id` field directly to the `ModelConfiguration` table in the MINT catalog. When an admin registers a Tapis app, they record its ID on the MINT config. The sync reads this field. If it is null, `generate_tapis_workflow` uses a function task.

**D6 — One contract per (DatasetSpecification, VariablePresentation) pair.**
A DatasetSpec can carry multiple presentations (e.g. water level in m and ft MSL). Generating one contract per presentation pair is correct: it gives the BFS both units as valid edges from a single data object. One contract per spec (using only the first presentation) would silently drop alternative units. The mapper iterates `spec.presentations` and emits one contract per presentation.

**D7 — lat/lon as standard pipeline parameters.**
`lat` and `lon` are added to `STANDARD_PARAMS` in `tapis.py` alongside the existing params (`start_date`, `end_date`, etc.). They flow through the pipeline to any task that declares `LAT`/`LON` in its `env_from_args`. This matches how MINT model parameters work — they are pipeline-level inputs, not data-object properties.

**D8 — Tapis app registration owned by admin.**
The SVO adapter discovers existing app IDs from MINT (via the new `tapis_app_id` field). It cannot register new apps. When a MINT `ModelConfiguration` has a Docker image (`has_software_image`) but no `tapis_app_id`, the sync logs it as an unresolved config. An admin must register the Tapis app and update the MINT config.

---

## Proposed Design

### 1. MINT → transform spec mapping

A `ModelConfiguration` in MINT maps to one `adapter_transform_spec` row:

| MINT field | adapter_transform_spec field |
|---|---|
| `id` (URI) | `mint_model_config_id` (new column) |
| `label[0]` | `name` |
| `software_version.label` | part of `description` |
| Per (input spec, presentation): `presentation.standard_variable.id` | `contracts[role=input].standard_variable_uri` |
| Per (input spec, presentation): `presentation.unit.id` | `contracts[role=input].unit` |
| `input.has_format` | `contracts[role=input].format` |
| Same for output specs/presentations | `contracts[role=output].*` |
| `tapis_app_id` (new MINT field, see D5) | `tapis_app_id` |
| `parameters` mapped by label convention (see §3) | `env_from_args` |
| `tapis_app_version` (new MINT field) | `tapis_app_version` |

### 2. New field on ModelConfiguration in MINT catalog

Two new columns are added to `modelcatalog_configuration`:

```sql
-- In model-catalog-api's Hasura migration
ALTER TABLE modelcatalog_configuration
  ADD COLUMN tapis_app_id      TEXT,   -- registered Tapis app ID (e.g. "modflow-head-extractor-v2")
  ADD COLUMN tapis_app_version TEXT;   -- Tapis app version string
```

The model-catalog-api REST layer exposes these through the existing `ModelConfiguration` GET/PUT/POST endpoints (they're plain columns on the unified configuration table — no new handler needed beyond adding to `CONFIGURATION_FIELDS` and `SETUP_FIELDS` in `custom-handlers.ts`).

Admins set these when registering a new model configuration that has a corresponding Tapis app.

### 3. env_from_args convention

The standard parameter label → pipeline arg → task env var mapping:

| Tapis task env var | MINT parameter `label` must be | Pipeline arg name |
|---|---|---|
| `SOURCE_URI` | `source_uri` | `source_uri` |
| `OUTPUT_URI` | `output_uri` | `output_uri` |
| `LAT` | `lat` | `lat` |
| `LON` | `lon` | `lon` |
| `SOURCE_UNIT` | `source_unit` | `source_unit` |
| `TARGET_UNIT` | `target_unit` | `target_unit` |
| `VARIABLE_NAME` | `variable_name` | `variable_name` |
| `LAYER` | `model_layer` | `model_layer` |
| `TAPIS_TOKEN` | `tapis_token` | `tapis_token` |

The mapper iterates `parameters` in MINT, matches each parameter's `label` against this table (case-insensitive), and builds `env_from_args`. Parameters with `has_fixed_value` set are skipped (baked into the app). If a parameter has no matching label, it is skipped and a sync warning is emitted.

`lat` and `lon` are added to `STANDARD_PARAMS` in `tapis.py` so they flow into every forecast pipeline.

### 4. point_extract via geo_actor

The `point_extract` transform type calls the `geo_actor` service (from `mcp_suite`) instead of running rasterio inline:

**Function task code** (generated by `task_code.build_point_extract_code`):
```python
import json, os, urllib.request

geo_actor_url = os.environ.get("GEO_ACTOR_URL", "http://geo-actor:8080")
source_uri = os.environ.get("SOURCE_URI")
lat = float(os.environ.get("LAT"))
lon = float(os.environ.get("LON"))
variable = os.environ.get("VARIABLE_NAME", "value")
token = os.environ.get("TAPIS_TOKEN", "")

payload = json.dumps({
    "source_uri": source_uri,
    "lat": lat, "lon": lon,
    "variable_name": variable,
    "tapis_token": token,
}).encode()

req = urllib.request.Request(
    f"{geo_actor_url}/extract-point",
    data=payload, method="POST",
    headers={"Content-Type": "application/json"},
)
resp = json.loads(urllib.request.urlopen(req).read())
print(json.dumps(resp))
```

`GEO_ACTOR_URL` is a setting on the adapter service (and added to `STANDARD_PARAMS`). The geo actor handles the rasterio/GDAL work, downloads Tapis/CKAN files, and returns `{value, unit, variable, source_uri, lat, lon}`.

### 5. Sync mechanism

**New module: `app/mint_sync.py`**

```
MintCatalogClient
  .list_configurations(limit, offset)
      GET /modelconfigurations (paginated)
      Includes: id, label, has_software_image, tapis_app_id, tapis_app_version,
                inputs.input.{id, has_format, presentations.presentation.{standard_variable.id, unit.id}},
                outputs (same shape),
                parameters.parameter.{label, has_fixed_value, position}

  .get_dataset_specifications(config_id)
      GET /datasetspecifications?configurationid={id}
      Returns full presentation tree for input + output specs

mint_config_to_spec_row(config) → dict | None
  Maps one ModelConfiguration to an adapter_transform_spec row.
  Returns None if the config has no input OR no output presentations
  (not a transform — it's a standalone model without typed I/O).

sync_mint_to_adapter(hasura_client, mint_client) → SyncResult
  For each MINT config:
    row = mint_config_to_spec_row(config)
    upsert into adapter_transform_spec ON CONFLICT (mint_model_config_id) DO UPDATE
  Deletes adapter_transform_spec rows whose mint_model_config_id no longer
  exists in MINT (configs that were removed).
  Returns {created, updated, deleted, skipped, unresolved_tapis_apps: list[str]}
```

**No hand-created rows are preserved.** The sync is a full reconciliation against MINT. Rows from the old fixture-based workflow are removed by this sync on first run unless their `ModelConfiguration` has been registered in MINT.

**New endpoint: `POST /admin/sync-from-mint`**
```
Request:  { dry_run?: bool }
Response: { created: int, updated: int, deleted: int, skipped: int,
            unresolved_tapis_apps: list[str], warnings: list[str] }
```

**Startup sync** — `SVO_ADAPTER_MINT_SYNC_ON_STARTUP=true` runs sync once at startup (background, non-blocking). Errors are logged; startup is not blocked.

### 6. Schema changes

**`adapter_transform_spec` table:**
```sql
ADD COLUMN mint_model_config_id  TEXT UNIQUE,  -- MINT ModelConfiguration URI
ADD COLUMN mint_synced_at        TIMESTAMPTZ,  -- last successful sync
ADD COLUMN tapis_app_version     TEXT;         -- from MINT tapis_app_version field
```

**`modelcatalog_configuration` table (in model-catalog-api):**
```sql
ADD COLUMN tapis_app_id      TEXT,
ADD COLUMN tapis_app_version TEXT;
```

**`STANDARD_PARAMS` in `tapis.py`:**
```python
STANDARD_PARAMS = {
    "start_date":    {"type": "string", "required": False},
    "end_date":      {"type": "string", "required": False},
    "allocation":    {"type": "string", "required": False},
    "lat":           {"type": "number", "required": False},  # ← new
    "lon":           {"type": "number", "required": False},  # ← new
    "tapis_token":   {"type": "string", "required": False},  # ← new
    "geo_actor_url": {"type": "string", "required": False},  # ← new
    ...
}
```

### 7. Inter-task data passing

**`tapis_job` tasks** — Tapis archives outputs to:
```
tapis://{exec_system}/archive/{pipeline_id}/{run_name}/{task_id}/
```
`generate_tapis_workflow` wires each job's archive URI as the `source_uri` arg for dependent tasks via `file_inputs`.

**`function` tasks** — write to the OWE shared workspace:
```
/mnt/open-workflow-engine/pipeline/work/step{N}.json
```

**Mixed chains** — a `function` task that follows a `tapis_job` receives the archive URI via `source_uri` pipeline arg and calls the geo actor (or other service) to retrieve the file content.

### 8. Common transforms to register in MINT

As part of rollout, the following `ModelConfiguration`s are created in the MINT catalog so the BFS has edges for standard operations. Each gets a matching `tapis_app_id` once its Tapis app is registered by an admin:

| MINT label | transform_type | Input contract | Output contract |
|---|---|---|---|
| `point-extract-geotiff` | `point_extract` | `format=geotiff` | `format=scalar-json` |
| `gdal-reproject-epsg4326` | `gdal_reproject` | `format=geotiff, crs=any` | `format=geotiff, crs=EPSG:4326` |
| `unit-convert-m-to-ft` | `unit_convert` | `unit=m` | `unit=ft` |
| `unit-convert-ft-to-m` | `unit_convert` | `unit=ft` | `unit=m` |
| `rolling-average-annual` | `rolling_average` | `format=timeseries-json` | `format=timeseries-json` |
| `modflow-head-extract` | `model_extract` | `format=modflow-binary, SVO=groundwater__hydraulic_head` | `format=geotiff, SVO=groundwater__hydraulic_head` |

For point-extract and GDAL transforms: `tapis_app_id = null` (function tasks, code from `task_code.py` calling geo_actor). For modflow-extract: `tapis_app_id` set by admin once the app is registered.

---

## Files Likely Affected

| File | Change |
|---|---|
| `app/mint_sync.py` | **new** — MINT catalog client, mapper, sync function |
| `app/task_code.py` | **new** — per-`transform_type` function code builders (dispatched when `tapis_app_id` is null) |
| `app/tapis.py` | `generate_tapis_workflow`: call `task_code.get_code` for function tasks; fill archive URI for tapis_job outputs; add `lat`, `lon`, `tapis_token`, `geo_actor_url` to `STANDARD_PARAMS` |
| `app/config.py` / settings | `MINT_CATALOG_BASE_URL`, `SVO_ADAPTER_MINT_SYNC_ON_STARTUP`, `GEO_ACTOR_URL` |
| `app/main.py` | `POST /admin/sync-from-mint`, `GET /admin/sync-status` endpoints; startup sync hook |
| `graphql_engine/migrations/` | Migration adding `mint_model_config_id`, `mint_synced_at`, `tapis_app_version` to `adapter_transform_spec` |
| `graphql_engine/metadata/` | Track new columns in Hasura |
| `model-catalog-api` (separate PR) | Migration adding `tapis_app_id`, `tapis_app_version` to `modelcatalog_configuration`; expose in `CONFIGURATION_FIELDS` / `SETUP_FIELDS` |
| `examples/subside_forecast_transforms.json` | **deprecated** — replaced by MINT-registered configs; remove once MINT entries are live |

---

## API / Schema Changes

### New columns on `adapter_transform_spec`
```sql
mint_model_config_id  TEXT UNIQUE  -- MINT ModelConfiguration URI (null = pending migration)
mint_synced_at        TIMESTAMPTZ
tapis_app_version     TEXT
```

### New columns on `modelcatalog_configuration` (model-catalog-api)
```sql
tapis_app_id      TEXT
tapis_app_version TEXT
```

### New adapter endpoints
```
POST /admin/sync-from-mint
  Body:     { dry_run?: bool }
  Response: { created, updated, deleted, skipped, unresolved_tapis_apps, warnings }

GET /admin/sync-status
  Response: { last_sync, spec_count, mint_synced_count, unresolved_count, warnings }
```

### New settings
```
SVO_ADAPTER_MINT_CATALOG_URL      # base URL of model-catalog-api
SVO_ADAPTER_MINT_SYNC_ON_STARTUP  # bool, default false
GEO_ACTOR_URL                     # base URL of geo_actor service (default: http://geo-actor:8080)
```

---

## Data Flow

```
MINT model-catalog-api
  GET /modelconfigurations (paginated, includes tapis_app_id + full I/O specs)
          ↓  mint_sync.py
  Map each ModelConfiguration → adapter_transform_spec row
    contracts:    from (spec × presentation) pairs
    env_from_args: from parameter labels via convention table
    tapis_app_id: from ModelConfiguration.tapis_app_id (set by admin)
  Full reconciliation upsert into Hasura (adapter_transform_spec)
          ↓
  BFS planner reads transform specs from Hasura  [no changes needed]
  plan_model_run resolves ETL DAG for a given lat/lon request
          ↓
  generate_tapis_workflow / build_forecast_pipeline
    tapis_app_id set  → tapis_job task  (app runs in Tapis)
    tapis_app_id null → function task   (code from task_code.get_code(transform_type))
      point_extract   → calls geo_actor HTTP API
      unit_convert    → inline arithmetic
      other           → stub with warning
          ↓
  Tapis Workflows pipeline submitted
  lat/lon flow as pipeline params → point_extract tasks → geo_actor
```

---

## Risks

**MINT catalog completeness is the gate.** The BFS can only chain transforms that are registered. Until the common transforms (§8) are registered in MINT and their Tapis apps are created by an admin, those edges don't exist. This is by design (D1) but means the NTGAM pipeline will have reduced coverage until registration is done.

**SVO URI alignment.** MINT uses `https://w3id.org/okn/i/mint/…` URIs. Data objects must use the same namespace for the BFS to match. The mapper normalises URIs (lowercase, https://); mismatches are logged as sync warnings.

**geo_actor availability.** Function tasks that call the geo actor will fail if the service is unreachable at task runtime. The pipeline has no retry on the task itself. Mitigation: the geo actor runs as a stable service in the TACC environment; health is monitored separately.

**ModelConfiguration without I/O specs.** Some MINT configs may have no typed DatasetSpecifications (e.g. legacy entries, documentation-only records). The mapper skips these (`mint_config_to_spec_row` returns None). They appear in `sync-status` as `skipped`.

---

## Alternatives Considered

**Hand-created specs as fallback alongside MINT-synced ones.** Rejected (D1): creates two populations with different maintenance paths, unclear authority, and divergence over time. MINT is the authority. Gap in MINT = gap in the adapter.

**env_override column for apps that don't follow the convention.** Rejected (D2): puts the fix in the wrong place. If an app's parameters aren't labelled correctly, the fix belongs in MINT. The adapter doesn't carry workarounds for upstream data quality issues.

**rasterio inline in function tasks.** Rejected (D3): 100MB/30s per run, duplicated per task. The geo_actor is the right home for geospatial operations.

**Derive tapis_app_id from has_software_image via /custom/tapis-apps.** Rejected (D5): the endpoint is a flat proxy returning {id, version} only with no container image field. Full resolution would require N per-app API calls. The correct fix is to store the Tapis app ID directly on the MINT ModelConfiguration.

---

## Test Plan

1. **Unit: `mint_sync.py` mapper** — Mocked MINT API responses → assert correct `adapter_transform_spec` row: right number of contracts per (spec × presentation), correct env_from_args, correct tapis_app_id passthrough.

2. **Unit: `task_code.py` builders** — Each builder emits valid Python (`ast.parse`); base64 payloads roundtrip; geo_actor call code uses correct env vars.

3. **Integration: sync endpoint** — `POST /admin/sync-from-mint?dry_run=true` against a local MINT mock returns expected counts; no DB writes.

4. **Integration: BFS regression** — After sync with MINT containing the NTGAM transforms, `POST /plans/model-run` resolves the same plan as today.

5. **Integration: tapis_job task generation** — A synced config with `tapis_app_id` set produces a `tapis_job` task (not function) in the generated pipeline.

6. **Integration: point-extract chain** — Register a geotiff data object + `point-extract-geotiff` + `unit-convert-m-to-ft` in MINT; BFS resolves the chain; function task code calls geo_actor endpoint.

7. **Integration: lat/lon pipeline params** — `build_forecast_pipeline` with lat/lon in STANDARD_PARAMS; generated pipeline JSON includes lat/lon params; point-extract task env_from_args maps LAT/LON.

---

## Documentation Plan

- `README.md` in `svo-adapter-service/`: "MINT catalog sync" section — how to run the sync, startup flag, unresolved app warning
- `model-catalog-api/README.md`: document `tapis_app_id` / `tapis_app_version` fields on ModelConfiguration
- `docs/design/` (this file): update Status to Implemented after rollout
- Runbook for admins: how to register a Tapis app + update its MINT config entry

---

## Rollout Plan

**Phase 0 — Schema** (parallel, two repos)
- Adapter: migrate `adapter_transform_spec` (new columns)
- model-catalog-api: migrate `modelcatalog_configuration` (tapis_app_id, tapis_app_version); expose in API

**Phase 1 — Sync infrastructure**
- `mint_sync.py` + `task_code.py` + endpoints
- Deploy with `SVO_ADAPTER_MINT_SYNC_ON_STARTUP=false`
- Run `POST /admin/sync-from-mint?dry_run=true`; verify mapping

**Phase 2 — Register common transforms in MINT**
- Create ModelConfiguration entries for the transforms in §8
- Admin registers corresponding Tapis apps; sets `tapis_app_id` on each config
- Run live sync; verify BFS resolves NTGAM plan with MINT-sourced specs

**Phase 3 — Cut over**
- Remove fixture-based seed scripts and `subside_forecast_transforms.json`
- Enable `SVO_ADAPTER_MINT_SYNC_ON_STARTUP=true`
- Verify end-to-end NTGAM forecast pipeline runs with no hand-created specs

**Rollback:** Schema additions are non-breaking (nullable columns). Fixture-based seed scripts are kept until Phase 3; rollback before that point is re-running the seed. After Phase 3, rollback requires re-running the fixtures and disabling startup sync.

---

## Open Questions

*(All resolved — see Decisions above.)*

---

## User Feedback / Decisions

- D1: MINT is sole source of truth. No hand-created spec fallback.
- D2: env_from_args convention is required. No override column.
- D3: rasterio/GDAL handled by geo_actor from mcp_suite.
- D4: Common transforms (GDAL, rolling averages) will be registered in MINT as part of this work.
- D5: `/custom/tapis-apps` is a flat list with no software image link. Add `tapis_app_id` field directly to `ModelConfiguration` in MINT.
- D6: One contract per (DatasetSpecification, VariablePresentation) pair.
- D7: lat/lon as standard pipeline params, same pattern as MINT model params.
- D8: Tapis app registration owned by admin. Adapter surfaces unresolved configs in sync-status.

## Implementation Notes (post-merge deviations)

- `MintCatalogClient` queries Hasura directly (same instance) instead of the model-catalog-api REST layer. The REST endpoint path and pagination format were not stable; Hasura direct is simpler and removes the REST dependency.
- `SVO_ADAPTER_HASURA_ADMIN_SECRET` must be set in the service `.env`; the anonymous Hasura role does not have column-level access to the new `tapis_app_id`/`tapis_app_version` fields on `modelcatalog_configuration`.
- After adding new columns via migration, Hasura requires a metadata reload via `POST /v1/metadata {type: reload_metadata, reload_sources: true}` — the CLI `hasura metadata reload` alone did not expose the new fields.
- `POST /admin/sync-from-mint` now fires a background `recompute-edges` task when any rows are created, updated, or deleted, so multi-hop BFS planning is consistent after every sync.
- `unresolved_count` in `/admin/sync-status` reflects specs with no `tapis_app_id` (they use OWE function tasks until an admin registers the app).
