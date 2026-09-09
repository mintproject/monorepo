# SVO Adapter API reference

The service is a FastAPI application. When running locally, the machine-readable
OpenAPI document is available at `/openapi.json` and the interactive reference at
`/docs` (ReDoc is at `/redoc`). The lists below are the maintained human index, with
endpoints grouped by scope.

Most endpoints accept an optional `Authorization: Bearer <tapis-token>` header. The
token is forwarded to Hasura/Tapis where the operation needs caller authorization.
Use the generated OpenAPI document for the exact Pydantic request and response
schemas.

## Core API — reusable across SVO Adapter deployments

Swagger UI splits the Core API into five task-oriented groups: Registry, Planning,
Workflows, Runs, and Catalog/objectives.

### Service and registry

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service health. |
| POST | `/data-objects` | Register a data object and its variable contracts. |
| GET | `/data-objects` | List registered data objects. |
| GET | `/transform-specs` | List registered transform specs and contracts. |
| POST | `/transform-specs` | Register one transform spec and its contracts. |
| POST | `/transform-specs/{id}/test` | Generate a one-piece Tapis workflow for dry-run inspection, or submit it when `dry_run` is false. |
| GET | `/standard-variables` | List standard variables known by the registry. |
| GET | `/reachable/{data_object_id}` | List SVO variables reachable from a registered source. |

### Readiness, planning, and discovery

| Method | Path | Purpose |
|---|---|---|
| POST | `/readiness/check` | Check a source data object against a model-input requirement. |
| POST | `/plans` | Find and persist an ETL plan that closes compatibility gaps. |
| GET | `/plans/{plan_id}` | Retrieve a stored plan. |
| POST | `/plans/discover` | Discover reachable target variables from a source. |
| POST | `/plans/discover-sources` | Discover sources that can reach a target. |
| POST | `/plans/model-run` | Build a multi-input model-run plan. |

### Workflow execution and provenance

| Method | Path | Purpose |
|---|---|---|
| POST | `/workflows/generate` | Generate and persist a Tapis Workflows definition for a plan. |
| POST | `/workflows/submit` | Register/run a generated workflow, or return a dry-run. |
| GET | `/runs` | List recent adapter workflow runs. |
| GET | `/runs/{run_id}` | Retrieve one run. |
| POST | `/runs/{run_id}/poll` | Poll Tapis and persist the run status transition. |
| GET | `/runs/{run_id}/provenance` | Retrieve provenance events for a run. |
| POST | `/runs/{run_id}/register-output` | Register a workflow output as a data object. |

### Generic catalog/objective helpers

| Method | Path | Purpose |
|---|---|---|
| GET | `/objectives` | List bundled objective definitions. |
| GET | `/objectives/{objective_id}` | Retrieve one objective definition. |
| GET | `/runtime-defaults` | Return runtime defaults used by the service. |
| POST | `/objectives/{objective_id}/evaluate-plan` | Evaluate an objective plan. |
| POST | `/datasets/find` | Find catalog datasets for a request. |
| POST | `/datasets/dataset_resources` | List resources for a catalog dataset. |

## Integration API — optional shared deployment plumbing

These endpoints support synchronizing or operating the shared adapter services. They
are not specific to one scientific use case, although the records they load may be.

| Method | Path | Purpose |
|---|---|---|
| POST | `/admin/sync-from-mint` | Dry-run or apply MINT model-configuration to transform-registry sync. |
| GET | `/admin/sync-status` | Report synchronization state, including unresolved Tapis apps. |
| POST | `/admin/sync-from-ckan` | Dry-run or apply CKAN resource-to-data-object sync. |
| POST | `/admin/recompute-edges` | Rebuild the registry compatibility edge cache. |
| POST | `/admin/validate-tapis` | Probe Tapis authentication, Workflows, group, and registration access. |
| POST | `/admin/poll` | Trigger one background Tapis run-status polling pass. |

## Use case: DFC/GAM

This surface exists for the Texas GMA/GAM DFC workflow and should not be presented as
required for a general SVO Adapter installation.

| Method | Path | Purpose |
|---|---|---|
| GET | `/dfc-targets` | List adopted DFC target records/contracts. |
| POST | `/plans/dfc-fanout` | Build a DFC fan-out plan for multiple targets. |
| GET | `/qaqc/modflow6` | Produce the MODFLOW 6/NTGAM DFC QA/QC report. |
| POST | `/qaqc/modflow6/tapis` | Submit or dry-run the QA/QC report as a Tapis workflow. |
| GET | `/qaqc/modflow6/tapis/{run_uuid}` | Fetch QA/QC Tapis run details. |

## Use case: NTGAM forecast

These endpoints implement the NTGAM location-to-subsidence-forecast flow. They use
the shared registry/planner, but their scenario fields, spatial source selection, and
forecast execution are bespoke to NTGAM.

| Method | Path | Purpose |
|---|---|---|
| GET | `/forecast/ntgam/options` | Return NTGAM layers, extents, defaults, and available inputs. |
| POST | `/forecast/plan` | Resolve NTGAM forecast inputs and ETL branches for a location. |
| POST | `/forecast/scenario` | Assemble an NTGAM scenario from resolved registry branches. |
| POST | `/forecast/run-tapis` | Generate or submit the NTGAM forecast as a Tapis workflow. |
| GET | `/forecast/run-tapis/{run_uuid}` | Fetch NTGAM forecast Tapis run details. |

## Related implementation references

- Generic request models and contracts: `app/models.py`
- Generic planner: `app/planner.py`
- Workflow generation and submission: `app/tapis.py`
- MINT/CKAN synchronization: `app/mint_sync.py`, `app/ckan_sync.py`
- NTGAM profile: `app/ntgam.py`
- DFC/GAM and QA/QC profile: `app/qaqc.py` and the DFC sections in `app/main.py`
