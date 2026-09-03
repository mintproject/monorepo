# NTGAM Materialized ETLs

## Status: Implemented

## Objective

Make NTGAM aquifer geometry and clay-thickness inputs follow the SVO adapter protocol instead of being treated as ad hoc preprocessing.
Make the same planned branch chain executable in a Tapis Workflows DAG, not only in the local adapter process.

## User need

The forecast planner is incomplete because `aquifer__top_elevation`, `aquifer__thickness`, and `aquitard__clay_thickness` have no registered sources. These values must be produced and registered through the adapter's transform/data-object/provenance path.

## Current code/system summary

- `ntgam/register_forecast_planner.py` seeds forecast-time transforms and registers CKAN resources as adapter data objects.
- The existing `ntgam-trinity-woodbine-v301` package already contains the raw
  `ntgam_dis_geometry.zip` resource.
- `ntgam/ingest_site_inputs.py` contains intended derivations for aquifer geometry and clay thickness, but its CKAN helper imports are stale.
- The forecast planner already knows how to consume grid and point-collection sources through `sample-raster-at-point` and `nearest-point-sample`.
- CKAN writes target `https://ckan.tacc.utexas.edu` and require explicit approval.

## Proposed design

Register materialization transform specs for:

- `derive-ntgam-aquifer-top-grid`: NTGAM DIS geometry to per-layer `aquifer__top_elevation` GeoTIFF grids.
- `derive-ntgam-aquifer-thickness-grid`: NTGAM DIS geometry to per-layer `aquifer__thickness` GeoTIFF grids.
- `derive-sdr-clay-thickness-points`: TWDB SDR lithology to `aquitard__clay_thickness` point collection GeoJSON.

Keep these as batch/materialized transforms. Their CKAN outputs become adapter data objects. Forecast-time planning then uses existing transforms:

- `sample-raster-at-point` for aquifer top/thickness grids.
- `nearest-point-sample` for clay point collections.

For scenario assembly, execute that same registered branch chain. If a published
materialized resource is not available, the adapter may materialize the raw source
into its local cache for the forecast request, then pass that local artifact to the
existing sampler. The branch still comes from the adapter registry and keeps the raw
source plus materialization transform in provenance.

For Tapis Workflows, generate real function tasks for the NTGAM branch steps. The
tasks download public source objects, execute the branch logic remotely, write
`step*.json` outputs to the Open Workflow Engine shared work directory, and the
forecast task merges those outputs before running SUBSIDE. The generated forecast
task removes locally assembled spatial values from its embedded fallback scenario,
so missing remote ETL outputs cause a forecast failure instead of being silently
masked by local values. The Tapis DIS-geometry executor uses point-local geometry
extraction for forecast sampling rather than writing durable GeoTIFF resources;
durable CKAN GeoTIFF materialization remains the publish path.

## Files likely affected

- `ntgam/register_forecast_planner.py`
- `ntgam/ingest_site_inputs.py`
- `monorepo/svo-adapter-service/app/ntgam.py`
- `monorepo/svo-adapter-service/app/sampling.py`
- `monorepo/svo-adapter-service/app/main.py`
- `monorepo/svo-adapter-service/app/tapis.py`
- `monorepo/svo-adapter-service/docs/design/2026-08-11-ntgam-materialized-etls.md`
- Existing focused tests or new dry-run tests under `monorepo/svo-adapter-service/tests/` if needed.

## API/schema changes

No database schema changes. New transform specs are inserted through existing `/transform-specs`. Existing CKAN resource metadata fields carry materialization provenance.

## Data flow

1. Register raw source archive data objects in the adapter registry.
2. Register materialization specs in the adapter registry.
3. Plan materialization ETLs from the raw archive when materialized aquifer geometry resources are missing.
4. Run `ingest_site_inputs.py --only aquifer clay --dry-run` to validate target package/resource metadata.
5. After explicit approval, publish the aquifer geometry and lithology resources into the existing
   `ntgam-trinity-woodbine-v301` CKAN package.
6. Re-run `register_forecast_planner.py` so published CKAN resources become adapter data objects.
7. Forecast planning resolves all required inputs.
8. `/forecast/scenario` executes materialization branches when needed:
   raw DIS ZIP -> cached GeoTIFF -> point sample, and raw SDR ZIP -> cached GeoJSON
   point collection -> nearest point sample.
9. `/forecast/run-tapis` generates a Workflows DAG from the same plan. Each remote
   task writes a step output; the final forecast task consumes those outputs and
   runs SUBSIDE.

## Risks and tradeoffs

- CKAN publishing is an external write and must not happen without approval.
- Aquifer geometry derivation requires local GDAL and the NTGAM geodatabase.
- Clay thickness is estimated from driller descriptions and should carry lower-confidence provenance.
- Recomputing these on every forecast run would be expensive; materialized resources preserve protocol while avoiding repeated work.
- First request against a raw SDR source may download and parse a large archive; cached output avoids repeat cost.
- Tapis function tasks must install Python wheels at runtime. Raster sampling uses
  `rasterio`; DIS point extraction uses `pyogrio`, `pyproj`, and `shapely`. If the
  Workflows runtime cannot install those wheels or cannot reach the source URLs, the
  remote run will fail.
- No live Tapis submission should be performed without explicit approval and a valid
  Workflows grant.

## Alternatives considered

- User overrides only: useful for smoke tests, rejected as the durable path because it drops provenance.
- Runtime derivation during each forecast: rejected for now because the DIS and SDR sources are large and stable.
- Silent preprocessing: rejected because it bypasses the adapter registry.

## Test plan

- Run dry-run validation for `ingest_site_inputs.py --only aquifer clay`.
- Compile changed Python files.
- Verify `/forecast/plan` lists missing sources before publish and can consume registered sources after publish/reseed.
- Verify `/forecast/scenario` can populate aquifer top, aquifer thickness, and clay thickness from planned materialization branches.
- Verify `/forecast/run-tapis` dry-run emits a DAG with real remote executor code
  and no local spatial-value fallback masking.
- Avoid live CKAN writes during tests unless explicitly approved.

## Documentation plan

Update this spec with implementation notes and any publish commands needed. Existing script docstrings should describe dry-run and write modes.

## Rollout/rollback plan

Rollout is dry-run first, then approved CKAN package/resource creation or patch. Rollback for mistaken CKAN writes is resource deletion or metadata patch by explicit approval only. Local code changes can be reverted without touching CKAN.

## Open questions

- The resource target is the existing `ntgam-trinity-woodbine-v301` package under `twdb-gams`, not
  separate CKAN packages.
- Is the local NTGAM geodatabase available in `ntgam/NTGAM_Geodatabase` for aquifer rasterization?

## Decisions

### 2026-08-11 - Materialized ETLs remain adapter transforms

- **Decision:** Register aquifer geometry and clay derivations as transform specs even though their outputs are materialized to CKAN before forecast-time planning.
- **Reason:** The user clarified that materialization timing should not bypass SVO adapter protocol.
- **Alternatives rejected:** Treating the outputs as unmanaged preprocessing.
- **User feedback:** "it should still follow the same protocols for our svo adapter."
- **Impact on implementation:** Add derivation transform specs and provenance metadata before CKAN publish.

## User feedback / decisions

The user explicitly directed implementation with "do it" on 2026-08-11.

## Implementation Notes

- Added materialization transform specs to `ntgam/register_forecast_planner.py`:
  `derive-ntgam-aquifer-top-grid`, `derive-ntgam-aquifer-thickness-grid`, and
  `derive-sdr-clay-thickness-points`.
- Added adapter contract support for raw source `data_type` matching, so the existing
  `ntgam_dis_geometry.zip` resource can satisfy the materialization transform input without matching
  unrelated ZIP archives.
- Added raw data-object registration for the existing NTGAM DIS geometry archive in
  `ntgam-trinity-woodbine-v301`.
- Added materialization provenance metadata to aquifer geometry and SDR clay data-object registration.
- Repaired `ntgam/ingest_site_inputs.py` to use the current `ModflowETLConfig`/`CkanClient` helper
  instead of the stale `register_ntgam_to_ckan.CKAN` import.
- Kept CKAN writes out of validation. The dry run only confirmed the intended resources in the existing
  `ntgam-trinity-woodbine-v301` package.

## Verification

- `python3 -m py_compile ntgam/register_forecast_planner.py ntgam/ingest_site_inputs.py monorepo/svo-adapter-service/app/ntgam.py monorepo/svo-adapter-service/app/main.py`
- `python3 ntgam/ingest_site_inputs.py --only aquifer clay --dry-run`
- `.venv/bin/python -m pytest tests/test_ntgam_heads.py`
- Restarted `./run-ntgam.sh`; seed registered the three materialization transforms.
- `GET /transform-specs` shows all three materialization transforms plus `ntgam-subside-forecast`.
- `POST /forecast/plan` now resolves `aquifer__top_elevation` and `aquifer__thickness` from the
  existing raw `ntgam_dis_geometry.zip` archive through materialization transforms, then
  `sample-raster-at-point`.
- `POST /forecast/plan` resolves `aquitard__clay_thickness` from the authoritative TWDB SDR ZIP URL
  through `derive-sdr-clay-thickness-points`, then `nearest-point-sample`.
- `POST /forecast/scenario` for `lat=32.7767`, `lon=-96.7970`, `model_layer=2` returned
  `missing: []` after executing materialization branches:
  `aquifer_top_ft_msl=-82.3367004394531`,
  `aquifer_thickness_ft=336.239288330078`, and `clay_thickness_ft=5.0`.
- `POST /forecast/run` with that assembled scenario returned `200` with `risk_score=4.0`,
  `resolved_inputs_count=30`, and `annual_len=61`.
- `POST /forecast/run-tapis` dry-run for `lat=32.7767`, `lon=-96.7970`, `model_layer=2`
  returned `200` and generated one self-contained forecast function task. The generated task code
  includes the registry-derived ETL sequence, `rasterio`, `geopandas`/`pyogrio`, SDR parsing, and
  WQP query executors. The task has no embedded spatial fallback keys and requires remote ETL
  outputs before running the forecast.

### 2026-08-12 - Tapis forecast ETL is fused into one function task

- **Decision:** For the NTGAM forecast Tapis path, keep the registry-derived ETL plan but execute the
  planned ETL sequence inside the forecast function task instead of splitting each ETL step into a
  separate hosted function task.
- **Reason:** A live Tapis run showed `derive-sdr-clay-thickness-points` completed and printed its
  artifact path, but dependent `nearest-point-sample` could not read the upstream `step10.json` from
  `/mnt/open-workflow-engine/pipeline/work`. Hosted function task filesystems are therefore not a
  reliable artifact handoff mechanism for this path.
- **Alternatives rejected:** Continuing to depend on local `step*.json` files across function tasks;
  publishing every intermediate artifact to CKAN during a forecast run.
- **Impact on implementation:** `build_forecast_pipeline()` now emits one `stepN-forecast` function
  task for planned NTGAM forecasts. That task embeds the plan, executes each ETL in order, and only
  prints the final forecast JSON to stdout so UI polling can parse the result.

### 2026-08-11 - Raw source archive is already in CKAN

- **Decision:** Register the existing `ntgam_dis_geometry.zip` CKAN resource as a raw source data
  object with `data_type=ntgam_dis_geometry`, and match materialization transform inputs by
  `data_type` plus format/spatial contract.
- **Reason:** The user clarified the archive is already loaded, so the adapter should plan from that
  resource instead of assuming a manual local download.
- **Alternatives rejected:** Matching raw sources by `format=ZIP` alone, which could accept unrelated
  archives.
- **User feedback:** "we already have the zip archive loaded"
- **Impact on implementation:** Add `data_type` to adapter contract compatibility and seed the raw
  archive source data object.

### 2026-08-11 - Raw SDR source is an authoritative external archive

- **Decision:** Register the TWDB SDR download URL as an adapter raw source data object with
  `data_type=twdb_sdr_lithology`.
- **Reason:** `ntgam-trinity-woodbine-v301` does not currently contain an SDR/clay/lithology resource,
  and the forecast can still follow adapter protocol by planning from the authoritative source URL.
- **Alternatives rejected:** Uploading the 143 MB SDR archive into CKAN immediately; this can still be
  done later, but it is a CKAN write and is not required for planner completeness.
- **User feedback:** "so we need to do this?"
- **Impact on implementation:** Seed a raw lithology data object and test the raw
  `twdb_sdr_lithology` materialization path.

### 2026-08-11 - Scenario executor runs materialization branches

- **Decision:** `/forecast/scenario` executes materialization steps from the planner branch before
  invoking the existing sampler step. Raw DIS geometry materializes to cached GeoTIFF rasters; raw
  SDR lithology materializes to a cached GeoJSON point collection.
- **Reason:** Planning completeness alone did not populate `aquifer_top_ft_msl`,
  `aquifer_thickness_ft`, or `clay_thickness_ft`.
- **Alternatives rejected:** Publishing derived CKAN resources as a prerequisite for scenario testing,
  because that adds external writes; bypassing the branch DAG with hidden provider defaults, because
  it would break adapter provenance.
- **User feedback:** "do it"
- **Impact on implementation:** Add local execution support in `app/ntgam.py`, local-file sampling in
  `app/sampling.py`, and focused unit coverage for materialization branch handoff.

### 2026-08-11 - Tapis DAG uses remote branch executors

- **Decision:** Replace NTGAM Tapis placeholder ETL tasks with generated function-task code that
  performs the branch work remotely and passes values through shared `step*.json` files.
- **Reason:** The dry-run pipeline had the right DAG shape but embedded locally assembled values,
  so it did not prove that materialization and sampling could execute under Tapis.
- **Alternatives rejected:** Submitting a live Tapis run during implementation, because that is an
  external mutation; requiring CKAN-published derived resources first, because the user asked to run
  the current process through the adapter pipeline.
- **User feedback:** "do it"
- **Impact on implementation:** Add forecast field metadata to NTGAM plan steps, generate real
  remote executor code in `app/tapis.py`, allow `/forecast/run-tapis` to start from `lat`/`lon`,
  and validate using dry-run and unit tests before any live Workflows submission.

### 2026-08-12 - Tapis DIS executor accepts raw MODFLOW archive layout

- **Decision:** Keep the FileGDB path when a `.gdb` is present, but add a Tapis remote fallback for
  CKAN `ntgam_dis_geometry.zip` archives that contain `ntgam.dis` plus `Bot*.ref` files.
- **Reason:** A live Tapis forecast run failed at the aquifer geometry step because the CKAN archive
  does not contain a `.gdb`; it contains the raw MODFLOW DIS geometry package.
- **Alternatives rejected:** Requiring a new CKAN upload before remote forecasts can run; treating the
  failure as a pipeline/auth problem.
- **User feedback:** The user provided the failed Tapis run output on 2026-08-12.
- **Impact on implementation:** The generated Tapis helper now computes the rotated MODFLOW row/column
  from lat/lon and reads the requested `top`/`Bot*.ref` cell directly for aquifer top and thickness.
