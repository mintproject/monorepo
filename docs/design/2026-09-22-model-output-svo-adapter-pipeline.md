# Deferred model-output SVO adapter pipeline

Status: Draft

## Objective

Extend the unified Ensemble Manager/SVO Adapter execution flow so a selected
model output variable, such as `springflow`, can be produced by an SVO adapter
after the model job completes. The user should receive one planned and
trackable execution rather than an apparently successful model-only job.

### Goals

- Discover the output-side adapter and its parameters during plan creation.
- Keep one parent execution owned by Ensemble Manager for a thread run.
- Run one model, verify one selected model output, and run one SVO adapter
  workflow against that output.
- Block submission when the deferred adapter plan or its required parameters
  are missing or invalid.
- Preserve current direct-model and adapter-first behavior outside this slice.

### Non-goals for the first release

- Mixed input-side and output-side adapter plans.
- Multiple selected outputs, model ensembles/fan-out, or aggregate adapters.
- Browser submission directly to `/workflows/submit` for a thread run.
- Automatic retry of an ambiguous external submission without reconciliation.
- Generalizing the unified service into an arbitrary DAG scheduler.

## User need

**Primary user:** A groundwater modeler or facilitator selecting inputs and
outputs in a MINT problem statement.

**Secondary users:** Ensemble Manager maintainers, SVO Adapter operators, and
catalog maintainers.

**Job-to-be-done:** Select an output variable that is inferred through an
adapter, see its adapter parameters in the Parameters step, provide those
values, and submit one workflow that runs the model first and the adapter
second.

**Current pain:** `MintThread.tsx` discovers adapter plans only from model
inputs. A model output such as MODFLOW CBC is not materialized when plan
creation occurs, so the current unified plan contains no post-model adapter
step and submission dispatches only the direct Tapis model job.

**Definition of success:** Plan creation identifies the post-model adapter and
its parameters; missing values can be saved but block submission; one parent
execution reports model and adapter child state; the adapter receives the
model output after completion; and the transformed output is visible in the
same user-facing run/provenance record.

## Current code/system summary

- `ui-react/src/pages/modeling/MintThread.tsx` walks `model.input_files` when
  creating adapter plans. It does not inspect `model.output_files`.
- `ui-react/src/lib/adapter-execution.ts` models every adapter row as an
  input-side source binding with a required `source_resource_id`.
- `mint-ensemble-manager/src/api/api-v1/services/unifiedExecutionService.ts`
  currently submits adapter children first, waits for their outputs, and then
  submits the downstream model with resource overrides.
- `svo-adapter-service/app/main.py` exposes `/plans`,
  `/workflows/submit`, `/data-objects`, and run/output registration routes.
  `/plans` currently resolves a real `data_object_id`, which is unavailable
  for a model output during initial plan creation.
- The direct Ensemble Manager/Tapis path already submits a model job and has
  output matching/status machinery that can be reused for the first stage.
- Existing direct model plans and existing adapter-first plans must remain
  compatible while this path is introduced behind a feature flag.

## Proposed design

### 1. Discover output-side adapter requirements during plan creation

Extend execution discovery to inspect selected model outputs as well as model
inputs. For each selected output, resolve the adapter path from the model
output contract to the selected standard variable/target contract and retain
the transform parameter definitions.

The resulting thread adapter record identifies its stage as `post_model` and
references the model output contract rather than pretending that a source
resource already exists.

The first release accepts exactly one selected output-side adapter chain for
one model. Plan creation rejects multiple output chains, fan-out, or mixed
pre/post stages with a structured `422`.

### 2. Add a deferred-source adapter plan contract

Add `POST /plans/deferred` to the internal SVO Adapter API. This keeps the
existing `POST /plans` contract strict: materialized-source plans still
require `data_object_id`, while deferred plans require a contract snapshot
instead.

The request is:

```json
{
  "source_contract": {
    "standard_variable_uri": "...",
    "format": "...",
    "extension": "cbc"
  },
  "target_contract": {
    "standard_variable_uri": "...",
    "format": "..."
  },
  "target_dataset_specification_id": "...",
  "model_output_key": "..."
}
```

The response is `200` for a ready plan or `422` when no valid transform path
exists:

```json
{
  "status": "deferred",
  "plan_id": "...",
  "plan_hash": "...",
  "source_contract": {"...": "..."},
  "target_contract": {"...": "..."},
  "plan_json": {
    "parameters": [
      {"name": "...", "type": "...", "required": true}
    ]
  }
}
```

The adapter snapshots the source/target contracts, transform IDs and
versions, parameter schema, and expected output format. The plan hash covers
those fields, not user-entered parameter values. Parameter values are
submitted separately and are validated against the signed plan snapshot.

The adapter must validate the deferred plan at submission time against the
registered model output data object. The existing `/plans` behavior for a
materialized source remains unchanged.

The target contract and transform path must be resolvable from the catalog
before the model output resource URI exists; if not, plan creation fails
closed with an actionable `422`.

### 3. Represent pre- and post-model stages in the unified plan

Extend the signed Ensemble Manager plan and `thread_adapter_plan` payload to
include a stage and source kind. A post-model step contains the model output
ID/contract and deferred adapter plan ID; it does not require a source resource
ID. Existing input-side steps continue to use their current source binding.

For this first slice, the public request sent by React is still only to
Ensemble Manager. Ensemble Manager calls the adapter's `/plans/deferred`
endpoint during server-side plan creation and later calls
`/workflows/submit`. The adapter owns transform planning, parameter schemas,
and adapter execution; Ensemble Manager owns the parent run and sequencing.

The staged step is discriminated rather than represented by a fake or nullable
resource ID:

```json
{
  "stage": "post_model",
  "depends_on": ["model"],
  "source": {
    "kind": "model_output",
    "model_io_id": "...",
    "contract_hash": "..."
  },
  "adapter_plan_id": "...",
  "parameter_schema_hash": "..."
}
```

The plan snapshot remains immutable. Parameter values remain plan-scoped and
separate from `thread_model_parameter` and dataset metadata.

### 4. Run the model before the post-model adapter

For a plan containing post-model steps, Ensemble Manager owns this state
machine:

```text
model_dispatching
  -> model_running
  -> output_registering
  -> output_verified
  -> adapter_dispatching
  -> adapter_running
  -> completed
```

Each transition is persisted on the parent execution. Failures distinguish
model failure, output registration failure, adapter failure, and unknown
submission state. A retry must resume from an idempotent boundary rather than
blindly submitting a second model or adapter job.

The parent execution record is created and authorized before the model is
submitted. The model child ID is persisted when accepted, and the parent is
never inferred from a thread ID or a caller-supplied execution ID.

The persisted state values for this slice are `planned`,
`model_dispatching`, `model_running`, `model_succeeded`, `output_registering`,
`output_verified`, `adapter_dispatching`, `adapter_running`, `completed`,
`failed`, `cancelled`, and `unknown`. `model_succeeded` is terminal only for a
model-only plan. `output_verified` is persisted as the handoff checkpoint and
is non-terminal when a post-model step exists. A model-only success is never
reported as completed for this plan.

The existing adapter-first state machine remains available for input-side
adapter steps. The first release rejects a mixed plan during creation with a
structured `422`.

### 5. Register and hand off the model output

After the model execution reaches a terminal successful state, Ensemble
Manager uses the existing Tapis output matching/result information to identify
the output resource. It registers or upserts that resource as an SVO adapter
data object with the model output contract, then submits the deferred adapter
workflow with the parent execution ID.

For the deferred plan, Ensemble Manager first calls the internal adapter
binding operation `POST /plans/deferred/{plan_id}/bind` with the server-created
`data_object_id`, `plan_hash`, and parent execution ID. The adapter verifies
the data object's contract and ownership against the deferred snapshot and
returns a bound plan token. Ensemble Manager then submits that bound plan to
`/workflows/submit`. Neither the data object ID nor the bound plan token is
accepted from the browser.

The bind request/response is:

```json
POST /plans/deferred/{plan_id}/bind
{
  "data_object_id": "model-output-...",
  "plan_hash": "...",
  "parent_execution_id": "ue_...",
  "model_child_id": "..."
}

{
  "status": "bound",
  "bound_plan_id": "bound-...",
  "plan_id": "...",
  "plan_hash": "...",
  "data_object_id": "model-output-..."
}
```

The bound plan is an opaque, short-lived adapter-side record keyed by
`(parent_execution_id, model_child_id, deferred_plan_id, plan_hash,
parameter_values_hash)`. Replaying the same request returns the same bound
plan; changing any field returns `409` rather than rebinding another object.
Only Ensemble Manager service credentials may call this endpoint.

For this path, the existing SVO poller's best-effort auto-bind is disabled by
an explicit `orchestration_mode = 'em_deferred_post_model'` on the adapter
workflow plan. Ensemble Manager performs the source registration and bind
itself. Existing standalone/input-side adapter runs retain their current
auto-bind behavior.

The server-side binding is:

```text
model_io_id + model child execution ID
  -> exactly one configured Tapis output key/file
  -> verified resource URI, format, extension, and contract
  -> adapter data object owned by this parent execution
  -> deferred adapter plan ID + parent execution ID
```

The browser cannot provide or replace the output URI, data-object ID,
execution ID, or model IO binding. Ensemble Manager derives them from the
immutable plan and the completed model child. Registration is idempotent on
`(parent_execution_id, model_child_id, model_io_id, plan_hash)` and adapter
submission is idempotent on `(parent_execution_id, adapter_plan_id, plan_hash)`.

The adapter run's output is linked back to the parent execution. The final
parent response exposes the model result, adapter child result, and transformed
output identity without requiring the UI to coordinate separate APIs.

If the output matcher cannot produce a stable adapter-accessible resource and
contract, the parent remains in `output_registering` or `failed`; it does not
fall back to a model-only completion.

### 6. Update the UI plan and Parameters flow

The Parameters step renders post-model adapter parameters alongside, but
separately from, MINT model parameters. It persists values with the deferred
adapter plan. Plan creation and editing remain allowed with missing required
values; unified submission performs authoritative validation and returns a
structured 422 response identifying the missing parameter.

Runs poll only the parent `ue_` execution. The UI should not treat the initial
model submission response as completion when a post-model adapter stage exists.

## Files likely affected

- `ui-react/src/pages/modeling/MintThread.tsx` — discover selected output
  adapters and include staged adapter steps in unified plans.
- `ui-react/src/lib/adapter-execution.ts` — stage/source-contract types,
  persistence fields, and parameter completeness handling.
- `ui-react/src/lib/ensemble-manager.ts` — staged adapter step request and
  structured validation errors if the current client loses them.
- `mint-ensemble-manager/src/api/api-v1/services/unifiedExecutionService.ts`
  — staged plan encoding, model-first reconciliation, output handoff, and
  idempotency.
- `mint-ensemble-manager/src/api/api-v1/services/unifiedExecutionStore.ts`
  — parent stage, model execution identity, and adapter child metadata.
- `mint-ensemble-manager/src/classes/tapis/adapters/TapisExecutionService.ts`
  — expose or reuse terminal output/resource information for handoff.
- `svo-adapter-service/app/main.py` and related models/planner modules —
  deferred source plans, contract validation, data-object registration, and
  workflow submission.
- GraphQL metadata/migrations for `thread_adapter_plan` and unified execution,
  only where existing JSON fields cannot represent staged state.
- Existing service, UI, and integration test suites beside the affected files.
- API/service documentation for the new plan and state contracts.

## API/schema changes

The unified adapter step gains a stage and a source binding shape similar to:

```json
{
  "adapter_plan_id": "...",
  "stage": "post_model",
  "model_io_id": "...",
  "source_contract": {
    "standard_variable_uri": "...",
    "format": "..."
  }
}
```

`source_resource_id` is required for input-side steps and absent for deferred
post-model steps. The exact field names should follow the existing GraphQL and
TypeScript naming conventions after review.

The deferred adapter plan response must include the same typed parameter
definitions used by materialized plans. Submission must reject missing,
unknown, stale, or invalid values before creating an adapter workflow.

The public Ensemble Manager request for this slice is:

```json
POST /v1/plans
{
  "executor": "ensemble_manager",
  "thread_id": "...",
  "model_id": "...",
  "execution_engine": "tapis",
  "post_model_adapter": {
    "model_io_id": "...",
    "source_contract": {"standard_variable_uri": "...", "format": "..."},
    "target_contract": {"standard_variable_uri": "...", "format": "..."}
  }
}
```

Ensemble Manager calls `/plans/deferred` and returns one signed plan ID plus
the adapter parameter definitions. Submission is:

```json
POST /v1/plans/submit
{
  "plan_id": "em_...",
  "adapter_parameter_values": {"step-id": {"parameter": "value"}},
  "idempotency_key": "client-generated-or-server-reused-key"
}
```

The response is a parent `ue_...` run with `status: "model_dispatching"` or
the current persisted status. The response never exposes an adapter-only run
as the thread's completion when a post-model step exists.

The existing migrations are
`graphql_engine/migrations/1771300000015_thread_adapter_plan`
and `graphql_engine/migrations/1771300000016_unified_execution`. Add a new
additive migration rather than rewriting either migration:

- `thread_adapter_plan`: add `stage`, `source_kind`, nullable
  `source_resource_id`, `source_contract`, `source_contract_hash`,
  `parameter_schema_hash`, and `plan_revision`; preserve existing input rows
  with `stage = 'pre_model'` and `source_kind = 'resource'`. Explicitly drop
  the existing `thread_adapter_plan_binding_key`, make `source_resource_id`
  nullable, then add separate partial unique constraints for pre-model
  resource bindings and post-model `(thread_model_id, model_io_id,
  adapter_plan_id, plan_revision)` rows.
- `unified_execution`: add `schema_version`, `state_revision`,
  `model_child_id`, `model_output_id`, `output_handoff`, and `failure_code`.
  Use `state_revision` for compare-and-set updates.
- Add `unified_execution_step` for per-stage external IDs, idempotency keys,
  attempts, status, `parameter_values_hash`, and output references. The
  required invariant is one row per `(execution_id, step_key)` and one launch
  intent per `(execution_id, step_key, plan_hash, parameter_values_hash)`.
- Adapter persistence: add nullable `owner_execution_id`, `owner_model_child_id`,
  and `owner_tenant` to adapter data objects (or an equivalent ownership
  relation). Objects created for deferred handoff must populate these fields;
  catalog objects remain unowned. The bind endpoint accepts only an object
  owned by the same parent/model child and matching contract/hash.

The public submit error envelope is:

```json
{
  "error": {
    "code": "PARAMETER_VALIDATION_FAILED",
    "message": "required adapter parameters are missing",
    "fields": [{"step": "...", "name": "...", "reason": "required"}]
  }
}
```

It is returned as `422` before any external model or adapter submission.
Unknown, stale, unauthorized, or mismatched output bindings fail closed with
their own stable error codes.

The parent execution record needs a persisted stage/state, model execution
identity, and enough output-handoff metadata to make retries safe. Secrets and
bearer tokens must not be stored in plans, thread rows, or execution JSON.

## Data flow

```text
Problem statement selects MODFLOW output + springflow
  -> unified plan discovery inspects output contract
  -> SVO Adapter resolves deferred transform path + parameters
  -> thread plan stores post_model adapter step
  -> Parameters step stores adapter values
  -> unified submit validates the complete plan
  -> parent dispatches the Ensemble Manager/Tapis model job
  -> model completes and output is identified/registered
  -> parent submits the SVO adapter workflow
  -> adapter output is linked to the parent run
  -> UI polls one parent execution and shows final provenance
```

## Ownership and idempotency

React calls Ensemble Manager only for thread plan creation, submit, and status.
Ensemble Manager owns the parent identity, authorization decision, state
transitions, output handoff, and calls to the adapter. The SVO Adapter owns
transform-path resolution, adapter parameter schemas, data-object contracts,
and workflow execution. Standalone adapter workflows remain available only
through their existing API and are not part of a thread parent run.

The `unified_execution.id`/`ue_...` value is the parent identity. The MINT
`execution.id` returned by the model executor is stored as the model child
identity and is linked to that parent; it is not used as the parent identity.
The adapter receives the `ue_...` parent value as its `execution_id`.

Before an external launch, Ensemble Manager atomically claims the corresponding
step using a compare-and-set on `state_revision`. It persists the model or
adapter external ID when known. If the response is ambiguous, the state is
`unknown` and reconciliation searches by the server-generated idempotency key
before any retry. Client idempotency keys are namespaced to the authenticated
user and canonical plan hash; they cannot select another plan or output.

At parent creation, Ensemble Manager canonicalizes and stores the submitted
adapter parameter values and their `parameter_values_hash`. Values cannot be
changed after the model child is dispatched. Every adapter launch intent
includes that hash and sends an `Idempotency-Key` header; the SVO Adapter
persists and honors the same key for `/plans/deferred/{id}/bind` and
`/workflows/submit`. A changed parameter set requires a new plan/parent.

The existing Tapis execution polling/output matcher advances the model child.
The unified execution reconciler invokes `GET /runs/{id}` (and
`POST /runs/{id}/poll` when needed) for the adapter child. After an ambiguous
external response, reconciliation searches the corresponding step/adapter
store by the persisted idempotency key; no blind resubmission is permitted.

For model outputs, Ensemble Manager records the native MINT model result and
its `execution_result`/resource identity, then creates the adapter data object
through the internal `/data-objects` operation with an owner binding to the
parent and model child. The deferred path does not write the existing
`execution_data_binding` used for adapter-output-to-model-input auto-binding.
The final transformed output is linked to the parent execution result and
adapter provenance; a separate `execution_data_binding` is added only by a
later, explicitly supported downstream model-input stage.

The first slice rejects model fan-out and multiple output candidates. A plan
must resolve exactly one model child and one configured output file before
adapter dispatch.

## Risks and tradeoffs

- Tapis output matching may expose a URI that the adapter cannot access or a
  format that is insufficient for contract registration.
- A model can succeed while output registration or adapter submission fails;
  the parent state must preserve this distinction and support safe retry.
- Replanning after a catalog/transform change can invalidate a saved deferred
  plan; plan hashes and contract versions must be checked.
- A model-first chain increases execution latency and orchestration state, but
  avoids browser-side coordination and gives the user one provenance record.
- Concurrent polling requests can race on state transitions; updates need
  conditional/idempotent behavior.
- A model output can be valid but belong to another execution or tenant;
  server-derived ownership checks are required before adapter registration.
- The first-slice restrictions reduce generality, but make the handoff and
  retry semantics testable before introducing a general DAG scheduler.
- The current `unified_execution` GraphQL exposure must be verified in the
  local database before relying on additional persisted fields.

## Alternatives considered

- **Submit the model and adapter directly from React:** rejected because it
  creates split ownership, duplicate-execution risk, and incomplete parent
  provenance.
- **Create the adapter plan only after the model finishes:** rejected because
  adapter parameters would not be part of plan creation and could not block
  submission as required.
- **Make the Tapis model app invoke the adapter internally:** rejected because
  it couples catalog/model application definitions to adapter orchestration.
- **Require two explicit user actions:** rejected because the selected output
  should represent one logical workflow.
- **Treat an output adapter as an input-side adapter with a placeholder file:**
  rejected because it obscures lifecycle and makes invalid source binding
  errors likely.

## Test plan

| Area | Test | Pass condition |
|---|---|---|
| Discovery/UI | Select CBC-derived `springflow` | One `post_model` row, typed parameters appear, no fake `source_resource_id` |
| Deferred planning | Create without `data_object_id` | Stable plan ID/hash, source/target contracts, and parameter definitions returned |
| Validation | Missing, unknown, wrong-type, stale, and out-of-range values | Structured `422`; no external launch |
| Happy path | Fake Tapis model completion with CBC output | Output registered once, adapter submitted afterward, both children under one parent |
| Retry boundaries | Ambiguous model, registration, and adapter responses | Reconciliation finds existing external work; no duplicate launch |
| Failure paths | Model, output, URI/access, and adapter failures | Distinct persisted states; downstream stage does not start incorrectly |
| Authorization | Other user submits/polls or substitutes output | Request rejected; no cross-user data object or execution binding |
| Regression/flag | Direct model, adapter-first, flag off, mixed, and fan-out plans | Existing paths unchanged; unsupported plans rejected explicitly |

Use deterministic fixtures for the MODFLOW CBC output contract and the
`springflow` transform, fake model/adapter clients with controllable ambiguous
responses, and a local Hasura migration/reset fixture that exposes
`unified_execution`. Required stage telemetry includes parent ID, child IDs,
output data-object ID, stage, attempt, failure category, and idempotency key;
tokens and sensitive URIs must not be logged.

## Documentation plan

Update the unified execution API design and service documentation with the
deferred plan shape, state machine, output handoff, idempotency rules, and
parameter behavior. Add local test/setup notes for the first model-output
adapter vertical slice.

## Rollout/rollback plan

1. Add contract and plan discovery behind a local/dev feature flag.
2. Validate a single MODFLOW CBC-to-`springflow` path with fake or controlled
   Tapis and SVO Adapter responses.
3. Enable model-first orchestration only for plans containing `post_model`
   steps.
4. Expand to other output adapters after output registration and retries are
   verified.

Rollback disables post-model adapter execution and returns to direct model
submission. Already-started parent executions require reconciliation; a
database rollback cannot cancel external Tapis or adapter jobs. In-flight
parents remain visible as `unknown`/`failed` and are reconciled or manually
terminated; they must not be rewritten as completed model-only runs.

## Open questions

- What exact MODFLOW output resource/contract and output key are available from
  the existing Tapis output matcher for CBC output?
- Can the model output be registered by URI alone, or must Ensemble Manager
  copy/stage it into an adapter-accessible location?
- Does the adapter's internal service authentication support server-owned
  data-object registration and workflow handoff without forwarding a raw user
  token?
- Is `unified_execution` queryable in the local Hasura metadata after the
  additive migration, and should stage rows be normalized immediately?
- Which exact `springflow` transform/model-output mapping is the first
  feature-flagged vertical slice?

## Decisions

- Ensemble Manager is the sole coordinator for thread runs: React calls it;
  it calls the SVO Adapter for deferred planning, output registration, and
  workflow submission.
- Deferred planning uses a separate internal `POST /plans/deferred` endpoint;
  the existing materialized-source `POST /plans` contract remains strict.
- This phase is model-first: the model materializes the source output before
  the SVO Adapter workflow is submitted.
- The first release is limited to one model, one verified output, and one
  post-model adapter; mixed pre/post plans and fan-out are rejected.
- Output resources and execution IDs are server-derived and cannot be supplied
  by the browser.
- The current checkpoint is commit `5945183`; the tracked worktree was clean,
  so no additional commit was created.
- Adapter parameters remain plan-scoped and are not added to dataset metadata
  or `thread_model_parameter`.
- The UI submits one parent plan and polls one parent execution.
- Direct model runs and existing adapter-first plans remain unchanged unless a
  plan explicitly contains a `post_model` step.

## User feedback / decisions

- User requested that a selected output such as `springflow` identify its
  required adapter parameter during plan creation, allow plan creation with
  missing values, block workflow submission until values are complete, and
  combine the Ensemble Manager and SVO Adapter APIs.
- User reported that the current submission created a model job but not the
  expected pipeline; this spec addresses that observed failure mode.
- **Pending user approval:** Confirm the narrowed first-release scope and the
  explicit Ensemble Manager/SVO Adapter ownership and endpoint decisions before
  implementation begins.
