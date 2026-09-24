# Single workflow pipeline for adapter-backed model runs

Status: Implementing

## Objective

Make an adapter-backed model run one authoritative workflow pipeline whose
stages include the selected model application itself:

```text
adapter input preparation -> model application -> model-output handoff -> adapter output processing
```

The model must be represented as a first-class workflow stage and submitted by
the workflow coordinator, rather than appearing as an unrelated legacy job
beside the adapter workflow.

## User need

**Primary user:** A modeler or facilitator running a MINT model and requesting
a derived SVO value such as spring flow.

**Secondary users:** Ensemble Manager, SVO Adapter, and MINT maintainers who
need to diagnose failed stages and reproduce a run.

**Job-to-be-done:** Submit one model-and-adapter computation and follow every
stage from inputs through the final derived output.

**Current pain:** Ensemble Manager owns a durable parent record, but the model
is submitted through the legacy Tapis jobs path while adapter work is submitted
through Tapis Workflows. The UI therefore shows a model job alongside adapter
state, and the pre-model path does not persist the model child identifier on
the unified parent.

**Definition of success:** A new adapter-backed run has one server-owned
workflow identity, an explicit model stage, one status graph, and provenance
links for adapter plans, model execution, model outputs, logs, and final
adapter outputs. The existing legacy model-job history remains readable.

## Current code/system summary

- `mint-ensemble-manager/src/api/api-v1/services/unifiedExecutionService.ts`
  creates signed plans and durable parent records. Post-model plans submit a
  model through `submitLegacy`, then reconcile its output before submitting the
  deferred adapter plan. Pre-model plans poll adapter children and submit the
  model after adapter outputs are verified.
- `mint-ensemble-manager/src/api/api-v1/services/executionsTapisService.ts`
  and `TapisExecutionService.ts` create and submit MINT/Tapis jobs, including
  model input binding and output matching.
- `svo-adapter-service/app/tapis.py` generates Tapis Workflows definitions for
  adapter transform steps. It currently has no model task type.
- `svo-adapter-service/app/planner.py` can build a model-run DAG, but its model
  run step is still just another transform specification and is not connected
  to the Ensemble Manager model execution contract.
- `public.unified_execution` stores a parent state, adapter child IDs, model
  child ID, output handoff, errors, and model result. It does not yet store a
  composite workflow definition or per-stage model task metadata.
- The UI now renders deferred post-model adapters clearly and has a previous
  runs/provenance route, but it consumes the existing parent/child snapshot.

## Proposed design

### 1. Composite workflow plan

Extend the unified plan contract with an explicit ordered stage graph. The
graph must identify each stage as `adapter_input`, `model`,
`output_handoff`, or `adapter_output`, with stable stage IDs and dependencies.
The model stage references
the existing MINT thread/model configuration rather than duplicating catalog
metadata.

The Ensemble Manager remains the authoritative coordinator and persists the
composite plan hash. The adapter service remains responsible for generating
adapter task definitions and data-object contracts. The model execution
adapter provides a workflow-compatible model task descriptor or submission
operation derived from the same input/output binding logic used by the legacy
Tapis execution service.

Ensemble Manager is the only lifecycle authority: it creates the canonical
workflow ID, validates transitions, owns retries/cancellation/reconciliation,
and declares the final status. Tapis Workflows/Jobs are execution substrates;
their IDs are stage-level provider references. The SVO Adapter owns transform
planning and adapter execution details, but does not update Ensemble Manager
state directly.

### 2. Model as a first-class task

Add a model task integration that:

- uses the selected model configuration and execution engine;
- consumes verified adapter output resources when an input adapter stage exists;
- records a stable model-stage ID and provider execution ID;
- exposes model status, logs, outputs, and failure details through the unified
  parent;
- rejects unsupported model fan-out until the composite workflow contract can
  represent multiple model tasks deterministically.

The implementation must not silently fall back to an independent model
submission for a plan declared as a composite workflow. Legacy plans without
the composite stage graph continue using the current legacy path.

### 3. Output handoff and post-model adapter

When the model stage completes, the coordinator registers the selected model
output as a server-owned adapter data object, records the handoff, and releases
the dependent adapter stage. The final adapter output remains associated with
the same parent workflow identity.

The state machine must distinguish at least:

```text
planned -> adapter_running -> model_running -> output_registering
         -> adapter_running -> completed
```

Failures at any stage are terminal for that run and include a stage-qualified
failure code. Reconciliation is idempotent and must not submit duplicate model
or adapter tasks after an ambiguous provider response.

Each stage has a stable `stage_id`, an `attempt` number, a deterministic
idempotency key, an immutable input manifest, provider references, and an
optimistic state version. The first implementation supports one model task per
workflow; model parameter fan-out requires an explicit fan-out/fan-in extension
before it is enabled.

The minimum persisted state machine is:

| State | Owner/action | Next states |
| --- | --- | --- |
| `planned` | Ensemble Manager validates the graph | `queued`, `failed` |
| `queued` | Coordinator claims the next ready stage | `submitting`, `cancelled` |
| `submitting` | Provider submission with idempotency key | `running`, `unknown`, `failed` |
| `running` | Reconciliation polls provider state | `collecting`, `failed`, `cancelled`, `timed_out`, `unknown` |
| `collecting` | Verify/archive required outputs | `succeeded`, `failed`, `unknown` |
| `unknown` | Reconciliation resolves an ambiguous provider result | `running`, `succeeded`, `failed`, `timed_out` |
| `succeeded` | Release dependent stage | next stage or workflow `completed` |

Workflow-level terminal states are `completed`, `failed`, `cancelled`, and
`timed_out`. Invalid transitions are rejected. A worker restart reclaims only
stale leases; it does not create a new attempt until the provider lookup and
idempotency key have been reconciled.

### 4. Provenance and UI

Extend the unified snapshot and history detail with stage records containing
stage ID, type, status, provider IDs, start/end observations, input/output
references, and log availability. The Runs panel renders the model as part of
the pipeline, not as an unrelated standalone job. The previous-runs page
shows the same composite stage graph and preserves legacy runs as
`legacy_model_job` records.

## Files likely affected

- `mint-ensemble-manager/src/api/api-v1/services/unifiedExecutionService.ts`
- `mint-ensemble-manager/src/api/api-v1/services/unifiedExecutionStore.ts`
- `mint-ensemble-manager/src/api/api-v1/services/executionsTapisService.ts`
- `mint-ensemble-manager/src/classes/tapis/adapters/TapisExecutionService.ts`
- `mint-ensemble-manager/src/api/api-v1/paths/unifiedExecution.ts`
- `svo-adapter-service/app/models.py`
- `svo-adapter-service/app/planner.py`
- `svo-adapter-service/app/tapis.py`
- `svo-adapter-service/app/main.py`
- `ui-react/src/lib/ensemble-manager.ts`
- `ui-react/src/pages/modeling/thread/MintRuns.tsx`
- `ui-react/src/pages/modeling/PreviousRunsPage.tsx`
- relevant Hasura migration/metadata files for durable stage metadata
- focused tests and README/design documentation for each affected service

## API/schema changes

Add a versioned composite-plan field to the Ensemble Manager plan response and
submission request, with a stage list and a model-stage descriptor. Add a stage
list to unified run responses and history details. The first proposed shapes
are:

```text
POST /v1/plans              -> { plan_id, plan_version, workflow_stages[] }
POST /v1/plans/submit       -> { plan_id, idempotency_key, ... }
GET  /v1/runs/{run_id}      -> { run_id, status, workflow_stages[], ... }
```

Each stage includes `stage_id`, `type`, `depends_on`, `status`, `attempt`,
`provider`, `provider_ids`, `input_manifest`, `output_manifest`, timestamps,
and an error envelope. The API must reject a reused idempotency key whose
payload hash differs.

Add durable stage metadata to
`public.unified_execution`, either as a JSONB `workflow_stages` field or as a
related table if querying individual stages is required. Preserve existing
columns for backward compatibility and legacy history.

**[ASSUMPTION — confirm]:** The first migration will use a JSONB stage snapshot
on `unified_execution`; normalize to a child table only if the history/detail
queries require stage-level filtering or transition rows. An append-only
transition history is required either as a JSONB event list or a related table.

The model stage must retain the MINT execution reference, Tapis job/workflow
reference, model configuration/version, input fingerprint, output manifest,
and log/artifact references. Requested parameters and effective parameters are
stored separately.

### Security and trust boundaries

Ensemble Manager validates the caller and performs object-level authorization
for the thread, workflow, inputs, outputs, logs, and provider references. The
browser never receives provider access tokens, refresh tokens, client secrets,
or long-lived signed URLs. Provider credentials remain server-side and are
scoped per service/tenant.

Plans, stage records, logs, errors, and provenance packets must not persist
credentials. User-supplied resource URLs are validated against configured
provider allowlists and fetched with bounded timeouts and payload limits to
avoid SSRF. If callbacks are introduced, they require signature validation,
timestamp/replay protection, event deduplication, and out-of-order handling.

The API must continue accepting old signed plans and legacy model jobs. New
composite workflow responses must identify the model stage without requiring
the UI to infer it from child IDs.

## Data flow

1. UI requests an adapter-backed composite plan for the selected thread/model.
2. Ensemble Manager validates model engine, adapter contracts, and stage
   dependencies, then persists a signed versioned composite plan.
3. Submission creates one durable parent and stage records, then submits the
   first ready adapter/model stage through the workflow coordinator.
4. Provider reconciliation updates the parent and stage records using stable
   idempotency keys.
5. Verified adapter outputs become model inputs; the model stage runs under the
   same workflow identity.
6. The model output is registered server-side and handed to the dependent
   adapter stage.
7. The final stage completes the parent and exposes the complete stage graph,
   logs, outputs, and errors to both active-run and previous-run views.

The model task may be implemented using a Tapis Workflows `tapis_job` task or a
server-side workflow-compatible wrapper, but it must use the existing MINT
model input/output contract and must not call the legacy standalone submission
path as an untracked fallback.

## Risks and tradeoffs

- Tapis Workflows currently generates adapter `tapis_job` tasks, while MINT
  model submission has richer input binding, fan-out, output matching, and
  execution-row side effects. Reusing the legacy submission code directly may
  not produce a workflow-compatible task.
- A composite workflow may need a new model-task adapter or a provider-side
  wrapper. This adds integration code but avoids two competing orchestration
  authorities.
- Persisting stage metadata increases schema and migration surface. A JSONB
  stage snapshot is simpler; a related table is more queryable and auditable.
- Existing runs cannot be retroactively converted into composite workflows.
  Legacy records must remain visible with an explicit provenance boundary.
- User tokens must not be persisted in plans, workflow arguments, logs, or
  provenance payloads.
- A model job may complete before the coordinator receives its acknowledgement;
  provider lookup and deterministic idempotency keys are therefore required
  before retrying submission.

## Alternatives considered

1. **UI-only relabeling:** Rejected. It would hide the separate provider-job
   submission and would not satisfy the execution/provenance requirement.
2. **Keep the Ensemble Manager parent and model child, but improve metadata:**
   Useful as an interim repair, but it still leaves model execution outside
   the adapter workflow and does not satisfy the approved direction.
3. **Make the SVO Adapter own model submission:** Rejected because model
   catalog binding, MINT execution records, and legacy compatibility belong to
   Ensemble Manager/MINT execution services.

## Test plan

- Unit-test composite-plan validation, stage dependency ordering, idempotency,
  fan-out rejection, and legacy-plan compatibility.
- Test workflow generation with adapter → model → handoff → adapter stages and
  assert that no independent model submission is made for composite plans.
- Test provider reconciliation for running, success, failure, timeout, and
  ambiguous submission responses.
- Test durable stage persistence and history assembly, including old legacy
  rows and partially available provider artifacts.
- Add UI tests proving the model appears as a pipeline stage and that logs and
  provenance link to the appropriate stage.
- Run focused service tests, TypeScript/Python checks, container builds, and a
  local end-to-end dry-run without executing a real production model.

Acceptance cases must include:

- Given a composite plan, when it is submitted, then exactly one model task is
  created as a dependent stage and no standalone model submission occurs.
- Given a lost provider acknowledgement, when reconciliation runs, then the
  existing provider task is adopted and no duplicate task is created.
- Given a model output, when archive and contract validation succeed, then the
  post-model adapter receives an immutable output manifest.
- Given a failed, cancelled, timed-out, or partially available stage, then the
  parent reaches an explicit terminal or reconciliation-needed state with a
  stage-qualified error and no false completion.
- Given a legacy execution row, then history displays it as a standalone
  legacy record without fabricating a workflow relationship.
- Given an unauthorized user or expired provider reference, then the API
  returns the appropriate authorization/availability state without exposing
  credentials or arbitrary provider URLs.

## Documentation plan

Update Ensemble Manager, SVO Adapter, and UI README sections describing plan
submission, workflow stages, local startup, provenance, and legacy behavior.
Update the architecture/design documentation with the composite stage contract
and the provider boundary.

## Rollout/rollback plan

Introduce a versioned composite-plan feature flag. Continue routing existing
legacy and old unified plans through their current paths. Enable the composite
path for the initial MODFLOW adapter-backed scenario after local dry-run and focused
integration checks. Roll back by disabling composite-plan creation; existing
parent records remain readable because their old schema/version is preserved.
Already-submitted provider tasks are not automatically rolled back by an
application rollback; a reconciliation/cleanup operation must explicitly
cancel or adopt them.

## Open questions

- Can the target Tapis Workflows tenant run a model application as a
  `tapis_job` task with the same input and output contract currently produced
  by `TapisJobService`?
- Should the model stage create a normal MINT execution row in addition to its
  workflow task record, or should the composite workflow record become the
  canonical execution row?
- Is the supported first release limited to exactly one model execution per
  composite workflow, matching current post-model orchestration constraints?
- Should stage metadata be JSONB on `unified_execution` or a normalized child
  table?
- Which model logs and archived files can be retrieved through the workflow
  provider versus the existing MINT execution-log path?
- Can the current Tapis tenant expose a secure workflow-compatible model task
  without passing a long-lived user token into the task?
- What retry, polling, timeout, and artifact-retention limits are acceptable
  for the first model-family release?

## Decisions

- The user approved pursuing the true single-workflow direction on
  2026-09-24: the model must be a stage in the adapter-backed pipeline and
  must not be submitted as an unrelated standalone job.
- The active UI clarification remains necessary: a post-model adapter is
  deferred until model output exists, but the eventual model stage belongs to
  the same composite workflow.
- The workflow contract is model-agnostic; MODFLOW is the initial rollout
  target, not a restriction on future MINT model configurations.
- Ensemble Manager is the sole lifecycle authority; Tapis is an execution
  substrate, not a competing workflow owner.
- The first implementation supports one model task per composite workflow and
  stores a durable stage snapshot with transition history while preserving
  legacy execution compatibility.

## Implementation notes

- Implemented the first parent-owned stage integration: unified run responses
  now expose adapter/model/handoff stages, stage snapshots persist through
  `unified_execution_step`, pre-model orchestration retains its model child ID,
  and history details include durable stage records.
- Unified run responses now also expose `tapis_workflow` as a provider tracking
  reference when exactly one adapter workflow has been submitted. The local
  `ue_...` ID remains the Ensemble Manager correlation ID; the Tapis workflow
  definition ID and run UUID are shown separately in the UI. Deferred
  post-model runs explicitly report that their Tapis pipeline has not been
  submitted until model output is available.
- Model reconciliation now retains both the MINT execution UUID and the
  provider Tapis Job UUID. `GET /plans/runs/{run_id}` polls the provider Job
  when available, so local GraphQL webhook state cannot leave the parent
  indefinitely at `model_running` when the webhook target is unavailable.
- The current model stage still uses the existing MINT/Tapis job adapter as its
  provider execution mechanism. A provider-native composite Tapis workflow
  task descriptor remains an open implementation step; it is not treated as a
  separate top-level workflow identity.

## User feedback / decisions

- User requested that the model be added and submitted as part of the workflow
  rather than run separately.
- User accepted that this is a larger architectural change than the UI state
  correction.
- User clarified that the model stage must support any model, with MODFLOW as
  the first concrete case.
- User requested that the Tapis-native pipeline/run identity be tracked in the
  UI instead of presenting the local `ue_...` identifier as a portal pipeline.
