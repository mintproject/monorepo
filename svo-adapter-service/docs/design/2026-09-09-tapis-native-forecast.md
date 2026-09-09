# Make NTGAM Forecast Execution Tapis-Native

Status: Implementing

## Objective

Move the NTGAM forecast data-plane execution into Tapis Workflows. The SVO Adapter
will construct and submit the workflow, but it will not locally fetch forecast
sources, sample or materialize them, assemble the numeric scenario, or execute the
SUBSIDE model.

## User need

**Primary user:** Water-planning and hydrology users operating the SVO Adapter UI;
secondary users are developers and operators who inspect registry plans and Tapis
workflow provenance.

**Job-to-be-done:** Submit a reproducible NTGAM forecast whose inputs and model
execution run in the Tapis execution environment.

**Current pain:** The UI and adapter mix local Python execution with Tapis workflow
generation. The current local fixture path depends on a laptop Conda environment
and local scientific packages, while the current Tapis pipeline does not own the
complete scenario assembly path.

**Definition of success:** The UI exposes one forecast execution action that submits
a Tapis Workflow performing source acquisition, registered ETL, scenario assembly,
SUBSIDE execution, and output/provenance handling. No forecast calculation requires
the adapter host's NumPy, GDAL, Conda, local source cache, or a demo backend.

## Current code/system summary

- `static/js/main.js` calls `/forecast/scenario` locally, stores the returned
  scenario, and then calls either `/forecast/run` or `/forecast/run-tapis`.
- `app/ntgam.py` performs source download, raster sampling, point sampling,
  materialization, physical derivations, and local SUBSIDE subprocess execution.
- `app/tapis.py` can build a multi-task Tapis pipeline, but its current forecast
  task embeds a scenario and its ETL tasks are not yet the complete source-to-scenario
  execution path.
- `app/main.py` exposes separate local (`/forecast/run`) and Tapis
  (`/forecast/run-tapis`) execution paths.
- The registry/planner and `/forecast/plan` provide the reusable control-plane
  resolution used to describe the forecast DAG.
- The service uses the configured Hasura/CKAN/MINT/Tapis services; there is no
  in-memory or fixture-backed runtime mode.

## Proposed design

1. Make `/forecast/run-tapis` the single forecast execution API. It accepts the
   location, model-layer selection, user overrides, and a dry-run flag; it does not
   require a preassembled numeric scenario.
2. Keep registry lookup and workflow planning in the adapter control plane. The
   resulting workflow carries source references, transform names, model metadata,
   and non-secret run arguments—not computed forecast values or bearer tokens.
3. Build a Tapis Workflow with explicit stages:
   - source acquisition/materialization inside the Tapis task runtime;
   - registered transform and point/raster extraction tasks;
   - a scenario-assembly task that reads the resolved branch outputs and model
     configuration defaults;
   - a SUBSIDE forecast task that runs the model in Tapis;
   - output/provenance publication or registration using the existing adapter/Tapis
     contract.
4. Pass credentials through the supported Tapis runtime mechanism. Do not embed the
   user's Tapis JWT in pipeline JSON, generated code, logs, or task arguments.
5. Remove the local forecast execution route, local-run UI action, in-memory
   backend, fixture seed endpoints, and demo-mode configuration. Dry-run remains an
   explicit request option for inspecting a workflow without registering or running
   it; it is not a separate runtime mode.
6. Preserve polling and result rendering in the adapter UI; those are control-plane
   operations and do not calculate the forecast.

## Files likely affected

- `app/main.py` — consolidate forecast execution API and remove local execution
  route; build/submit the Tapis-native request.
- `app/ntgam.py` — split reusable input metadata from local execution, or move the
  execution helpers into task code suitable for Tapis runtime packaging.
- `app/tapis.py` — define the complete forecast task DAG, runtime inputs, secret
  handling, task dependencies, and output contract.
- `static/index.html` and `static/js/main.js` — remove the local-run action and send
  run inputs rather than a locally assembled scenario.
- `tests/test_forecast_plan.py`, `tests/test_ntgam_tapis.py`, and API tests —
  cover the complete generated DAG and ensure no local execution path remains.
- `docs/api.md`, `README.md`, and the NTGAM design/API documentation — document the
  Tapis-only runtime boundary and dry-run behavior.
- `Dockerfile` / `run-ntgam.sh` — require configured live service dependencies and
  remove demo startup/seed behavior.
- `app/hasura.py`, `app/config.py`, `app/store.py` — remove the demo client,
  configuration, and in-memory backend.

## API/schema changes

- Remove `POST /forecast/run`, which executes SUBSIDE locally.
- Change `POST /forecast/run-tapis` to accept run inputs (`lat`, `lon`,
  `model_layer`, optional overrides, and `dry_run`) and have the workflow assemble
  the scenario in Tapis.
- Keep `POST /forecast/plan` as a control-plane planning/preview endpoint unless
  implementation review determines that planning must also move into a workflow
  task.
- Preserve the Tapis run-detail endpoint and existing workflow polling contract.
- Remove `/admin/seed-ntgam-forecast`, `/admin/seed-gma-dfc`, and
  `/admin/reset`; registry contents must come from Hasura/MINT/CKAN integrations.
- No database schema change is expected; workflow/task output and provenance fields
  must remain compatible with the existing run and data-object registration model.

## Data flow

```text
UI + Tapis JWT
      |
      v
SVO Adapter control plane
  registry -> plan -> workflow definition -> submit
      |
      v
Tapis Workflows
  acquire/materialize -> transform/sample -> assemble scenario -> run SUBSIDE
                                      |                         |
                                      +------ provenance/output+
      |
      v
SVO Adapter polls and renders the Tapis result
```

## Risks and tradeoffs

- Tapis task runtimes must be able to reach CKAN, STAC, MINT, and any source
  archives; unreachable resources become workflow failures rather than local
  fallback behavior.
- Runtime credentials and private-source access need a supported injection path;
  putting tokens in generated code would create a security and provenance risk.
- Moving sampling and model execution remotely increases workflow latency and
  packaging complexity, but removes laptop-specific dependency failures and makes
  runs reproducible.
- Dry-run workflow generation does not execute or fabricate a forecast result; a
  live run requires reachable registered sources and Tapis runtime credentials.
- Output registration must be explicit so remote results can re-enter the shared
  SVO data-object/provenance model without adapter-local files.

## Alternatives considered

- **Keep both local and Tapis execution:** rejected for the primary path because it
  preserves two execution environments and the NumPy/GDAL drift that caused the
  current failure.
- **Keep local scenario assembly but submit only the model task:** rejected because
  it leaves source access, sampling, and numeric input creation outside Tapis.
- **Run the entire adapter API inside a Tapis task:** not proposed; registry auth,
  planning previews, submission, and polling are control-plane responsibilities and
  do not need to be duplicated inside every workflow.

## Test plan

- Unit-test the workflow builder for the complete dependency order and required
  runtime inputs; assert that source acquisition, transforms, scenario assembly,
  and SUBSIDE execution are represented as Tapis tasks.
- Test that generated workflow JSON contains no bearer token and no laptop-only
  paths, Conda interpreter paths, or adapter-local cache references.
- Update API tests for the consolidated `/forecast/run-tapis` request shape and the
  removal/deprecation behavior of `/forecast/run`.
- Test `dry_run=true` only generates a redacted workflow definition and never calls
  the Tapis submission client.
- Run JavaScript syntax checks, Python compilation, focused planner/workflow tests,
  and the live-service API suite with mocked external clients where appropriate.
- Perform a live Tapis submission only as an explicitly approved external-write
  smoke test after code and QA are complete.

## Documentation plan

- Update `docs/api.md` to mark `/forecast/run-tapis` as the sole forecast execution
  path and document the dry-run/live distinction.
- Update the service README and NTGAM design record with the control-plane/data-plane
  boundary and required Tapis runtime access.
- Update startup/environment documentation to remove any claim that the adapter
  host's Conda/NumPy environment is required for forecast execution.
- Keep Swagger tags and descriptions aligned with the new endpoint contract.

## Rollout/rollback plan

- Verify generated workflows without submitting them first, then run a live smoke
  test only after explicit external-write approval.
- Deploy only after focused tests, QA, and documentation are complete.
- Roll back by restoring the previous endpoint/UI version if the workflow task
  contract or remote source access is not ready. Do not delete existing run or
  provenance records during rollback.

## Open questions

- Does “all in Tapis” include the registry planner itself, or only forecast data
  acquisition, scenario assembly, ETL, model execution, and output handling?
- Which supported Tapis mechanism should supply CKAN/MINT/STAC credentials to task
  runtimes in this deployment (service grant, workflow secret, or task input)?
- Should remote outputs be registered by a final workflow task or by the adapter
  after polling the completed run?

## Decisions

- Demo mode is removed from the adapter. The persistent Hasura registry and live
  Tapis/CKAN/MINT integrations are the supported runtime path.
- Explicit workflow dry-run support remains available as an API safety feature;
  it is not a separate runtime mode.
- The local `POST /forecast/run` endpoint is removed so forecast execution cannot
  bypass Tapis.

The demo-removal slice is implemented. This spec remains in progress until the
forecast endpoint itself assembles inputs inside Tapis rather than accepting a
scenario assembled by the adapter.

## User feedback / decisions

### 2026-09-09 - Tapis-only forecast execution requested

- **Decision:** User stated that the forecast path should all be in Tapis.
- **Impact:** The proposed implementation removes local forecast execution and
  moves the complete forecast data plane into Tapis Workflows; the adapter remains
  the control plane.

### 2026-09-09 - Demo mode removed

- **Decision:** Remove the in-memory Hasura client, demo configuration flag,
  fixture seed/reset routes, demo-only UI branches, and local forecast route.
- **Impact:** The UI now requires the persistent Hasura registry and uses Tapis
  workflow execution. The existing forecast workflow contract still accepts an
  assembled scenario; moving scenario assembly itself into Tapis remains a
  follow-up to this broader cleanup. The local SUBSIDE environment is no longer
  part of the adapter runtime.
