# Unified Ensemble Manager and SVO Adapter execution API

Status: Implementing

## Objective

Expose one execution API to the modeling UI that can plan and submit either a
normal Ensemble Manager run or an SVO-adapter-backed run. Adapter-derived
variables must contribute their required parameters during plan creation, and
workflow submission must reject a plan with missing or invalid required values.

## User need

**Primary user:** A groundwater modeler or facilitator using the Problem
Formulation workflow.

**Secondary users:** MINT/Ensemble Manager maintainers, SVO Adapter operators,
and catalog maintainers.

**Job-to-be-done:** Select an input or output variable such as springflow and
have the system determine whether an adapter chain can satisfy it, collect the
chain's required parameters, and execute the resulting model workflow from one
place.

**Current pain:** The UI's Parameters step understands MINT model parameters,
while adapter parameters are stored in `env_from_args` and are only consumed by
the SVO Adapter workflow API. The UI therefore cannot show or validate those
parameters as part of the selected plan.

**Definition of success:** The UI uses one plan/submission contract. An
adapter-backed plan displays its required parameters, can be saved before all
values are supplied, and cannot be submitted until server-side validation
passes. Existing non-adapter Ensemble Manager runs continue unchanged.

## Current code/system summary

- `ui-react/src/pages/modeling/MintThread.tsx` loads the thread execution
  state, renders Datasets/Parameters/Runs, and currently submits runs through
  `lib/ensemble-manager.ts`.
- `MintParameters.tsx` derives parameters from
  `modelcatalog_configuration.parameters` and persists values in
  `thread_model_parameter`; those rows reference MINT catalog parameters.
- `useScopedStandardVariables.ts` and `outcome-driver-inference.ts` already
  use adapter contracts to infer reachable variables, but query only contract
  fields and discard adapter parameter metadata.
- `svo-adapter-service` owns adapter planning and Tapis workflow generation via
  `/plans`, `/plans/model-run`, `/workflows/generate`, and `/workflows/submit`.
- Adapter transform specs expose `env_from_args`, `file_inputs`, and
  `parameters_schema_json`; the adapter binds these to workflow run arguments.
- The adapter database already separates source data objects, transform specs,
  workflow plans, and workflow runs. Existing MINT thread parameter tables are
  not suitable for arbitrary adapter arguments because their parameter IDs are
  foreign-keyed to `modelcatalog_parameter`.

## Proposed design

### 1. One public orchestration API

Add a unified orchestration surface at the Ensemble Manager/application API
boundary. The React UI calls this surface for plan creation, validation,
submission, and status. Ensemble Manager remains the user-facing coordinator;
the SVO Adapter remains an internal adapter-planning/execution service.

The unified plan contains an explicit executor route:

```json
{
  "executor": "ensemble_manager" | "svo_adapter",
  "inputs": [],
  "adapter_steps": [],
  "parameters": [],
  "parameter_values": {}
}
```

Only one executor is selected for a logical plan. The UI never submits to both
systems and never chooses an arbitrary adapter or workflow ID.

### 2. Adapter-aware plan creation

When variable/model selection requires an adapter chain, plan creation resolves
the chain and snapshots:

- transform IDs/names and contract version or hash;
- selected source/resource bindings;
- output bindings required by the downstream model;
- typed parameter definitions, including name, type, requiredness, default,
  allowed values/range, units, and originating transform;
- executor route and plan version.

Adapter parameters are plan-scoped orchestration parameters. They are not
inserted into `thread_model_parameter` or dataset metadata.

### 3. Parameters and submission

The Parameters step renders MINT model parameters and adapter plan parameters
as separate groups. Saving a plan does not require every adapter value.

Submission sends only the plan ID and user-entered values to the unified API.
The server revalidates the immutable plan, rejects missing/unknown/invalid
parameters, checks source authorization, and then dispatches exactly one
executor. UI validation is supplementary, not authoritative.

### 4. Execution and provenance

Ensemble Manager owns the user-facing execution identity and state. Adapter
workflow IDs and status are retained as child execution details. Adapter output
registration must bind the materialized output to the model input before the
downstream model run is submitted.

Submission is idempotent using a server-generated plan-bound key. A retry after
an ambiguous response must return the existing execution rather than create a
second workflow.

### 5. Legacy isolation

Plans without adapter steps retain the current Ensemble Manager request and
execution behavior. The adapter route is opt-in and feature-gated until the
adapter-to-model output handoff and reconciliation path are verified.

## Files likely affected

- `mint-ensemble-manager/src/api/api-v1/paths/` — unified plan, submit, and
  status endpoints plus adapter dispatch.
- `mint-ensemble-manager/src/classes/` — orchestration client, execution state,
  idempotency, and adapter status/output reconciliation.
- `svo-adapter-service/app/main.py` — typed plan/submit validation and an
  internal-service-facing contract if the existing endpoints are too broad.
- `svo-adapter-service/app/models.py` and `app/planner.py` — typed adapter
  parameter requirements and plan snapshots.
- `ui-react/src/pages/modeling/MintThread.tsx` — unified plan/submit wiring.
- `ui-react/src/pages/modeling/thread/MintParameters.tsx` and
  `src/lib/thread-execution.ts` — render and validate adapter plan parameters
  separately from MINT parameters.
- `ui-react/src/components/autocomplete/useScopedStandardVariables.ts` and
  `src/lib/modeling/outcome-driver-inference.ts` — preserve adapter transform
  metadata needed for parameter discovery.
- `graphql_engine/migrations/` — only if execution metadata cannot be stored in
  existing Ensemble Manager plan/run JSON or adapter plan records.
- Focused tests beside each affected service and UI component.

## API/schema changes

The public API gains a unified plan/submit/status contract with:

- executor route;
- immutable plan ID/version/hash;
- adapter transform steps and source bindings;
- typed plan-scoped parameter definitions and values;
- idempotency key;
- parent execution ID and adapter child execution ID/status.

The implementation should first use existing JSON plan/run fields where they
provide the required isolation. A relational migration is added only where
immutability, uniqueness, authorization, or queryability cannot be enforced in
the current schema.

The SVO adapter submission contract must reject unknown parameters and bind
values only to the server-created plan. Raw bearer tokens and secrets must not
be persisted in plan or parameter records.

## Data flow

```text
Problem statement / thread
  -> unified plan request
  -> Ensemble Manager resolves model + adapter requirements
  -> plan snapshot with executor and typed parameters
  -> UI Parameters step
  -> unified submit(plan_id, parameter_values)
  -> server validation + idempotency
  -> Ensemble Manager executor OR SVO Adapter executor
  -> adapter output registration, if needed
  -> downstream model execution
  -> one user-facing execution status/provenance record
```

## Risks and tradeoffs

- A unified API adds orchestration responsibility to Ensemble Manager and
  requires reconciliation across service boundaries.
- Adapter contract changes between plan and submission require contract
  versioning and replanning.
- Adapter outputs may complete while model submission or registration fails;
  the state machine must represent this explicitly.
- Direct browser-to-adapter submission would be simpler initially but creates
  token, authorization, duplicate-execution, and provenance risks and is
  rejected.
- Keeping adapter parameters separate from MINT parameters avoids foreign-key
  and semantic collisions but requires a new UI/persistence path.

## Alternatives considered

- **Direct React calls to both APIs:** rejected because one user action could
  create duplicate or untracked executions and would expose a privileged
  submission API to the browser.
- **Put adapter parameters into `thread_model_parameter`:** rejected because
  those IDs are MINT catalog parameter IDs and adapter arguments have different
  ownership and semantics.
- **Merge the SVO Adapter service into Ensemble Manager:** rejected for the
  first implementation; retaining a service boundary keeps adapter planning,
  Tapis execution, and catalog responsibilities isolated.
- **Keep the APIs completely separate:** rejected because the UI cannot present
  one coherent plan or execution state for adapter-backed model runs.

## Test plan

- Plan creation returns adapter parameters with stable names, types, defaults,
  requiredness, and originating transform.
- Adapter parameters appear in the Parameters step without changing ordinary
  MINT parameter behavior.
- A plan can be saved with missing adapter values.
- Unified submission rejects missing, blank, unknown, or invalid adapter values
  before dispatch.
- Complete adapter values are passed once to the adapter and adapter output is
  bound to the downstream model input.
- Retry with the same idempotency key returns the existing execution.
- Adapter status and output failures reconcile to the parent execution state.
- Non-adapter plans still submit the unchanged Ensemble Manager request and do
  not call the adapter.
- Authorization, token redaction, contract-version mismatch, and dataset
  access checks are covered at the API boundary.

## Documentation plan

Update Ensemble Manager and SVO Adapter API documentation with the unified plan
contract, executor routing, adapter parameter schema, state transitions,
idempotency behavior, and output handoff. Document the UI distinction between
dataset inputs, model parameters, and adapter parameters.

## Rollout/rollback plan

1. Ship plan/parameter discovery and validation without enabling adapter
   execution.
2. Enable one adapter-backed path behind a feature flag in local/dev
   environments.
3. Verify output registration, status reconciliation, retry safety, and legacy
   Ensemble Manager regression tests.
4. Expand the allowlist of adapter routes only after the first path is stable.

Rollback disables the adapter executor route and leaves existing Ensemble
Manager plans/runs unchanged. Adapter child runs that already started require
status reconciliation or cancellation; database rollback alone cannot undo an
external execution.

## Open questions

- Which Ensemble Manager API module is the canonical public boundary for the
  new plan/submit endpoints?
- What existing Ensemble Manager object should own the immutable plan snapshot
  and parent/child execution linkage?
- Which adapter outputs can be registered automatically as model inputs, and
  what resource identity does the model runner require?
- What service-to-service authentication and user-delegation mechanism is
  available between Ensemble Manager and the SVO Adapter?
- Which adapter-backed variable/path should be the first feature-flagged
  vertical slice (springflow is the current example)?

## Decisions

### 2026-09-22 — Use one public orchestration API

- **Decision:** Present one plan/submit/status API to the UI while retaining
  Ensemble Manager and SVO Adapter as separate internal services.
- **Reason:** The UI needs one execution contract, but the services have
  distinct planning, catalog, and Tapis responsibilities.
- **Alternatives rejected:** Direct dual submission and service merger.
- **User feedback:** The user approved combining the two APIs with “lets do it”.
- **Impact on implementation:** Add an explicit executor route and parent/child
  execution linkage; preserve the existing non-adapter path.

### 2026-09-22 — Keep adapter parameters plan-scoped

- **Decision:** Adapter parameters are discovered during plan creation and
  stored with the plan; they are not dataset metadata or MINT model parameters.
- **Reason:** Adapter arguments describe orchestration and transform execution,
  and `thread_model_parameter` is foreign-keyed to MINT parameters.
- **Impact on implementation:** The Parameters UI and submit API need a separate
  adapter-parameter contract and validation path.

### 2026-09-22 — Block only submission

- **Decision:** Plan creation may succeed with missing adapter values, but
  workflow submission must fail until all required values pass server validation.
- **Reason:** Users need to inspect and complete a plan before execution.
- **Impact on implementation:** Separate plan completeness from submission
  readiness in both UI state and API validation.

### 2026-09-22 — User approved implementation

- **Decision:** Proceed with implementation of the unified execution API in
  this spec.
- **Reason:** The user explicitly approved the design and asked to implement
  it.
- **Alternatives rejected:** Continue with separate UI-facing submission APIs
  or store adapter parameters as dataset metadata / `thread_model_parameter`
  rows.
- **Impact on implementation:** Implementation may begin. The existing
  Ensemble Manager execution path remains the rollback path.

### 2026-09-22 — Implement the contract/proxy slice first

- **Decision:** Implement the unified public plan/submit/status boundary,
  persisted adapter parameter definitions, submission validation, and legacy
  executor dispatch as the first rollout slice.
- **Reason:** The current thread data stores CKAN resource identifiers and MINT
  model bindings, but does not yet store the adapter data-object identity,
  immutable parent plan, or output-to-model-input handoff required to safely
  submit an adapter chain and then launch the downstream model.
- **Deviation:** The React Parameters step now submits ordinary runs through
  the unified boundary and the client exposes adapter-plan APIs, but adapter
  parameter fields are not yet rendered from a thread-created adapter plan.
  Adapter-backed execution remains opt-in through the new API until the
  output registration and parent execution linkage are implemented.
- **Impact:** No adapter workflow can be started accidentally from the existing
  modeling wizard. The server-side adapter contract is ready for the next
  feature-flagged slice; legacy runs retain their existing behavior.

## User feedback / decisions

- The user clarified that parameters required by adapter-inferred variables
  must be identified in the Parameters step.
- The user clarified that missing parameters should not block plan creation but
  must block workflow submission.
- The user approved combining the Ensemble Manager and SVO Adapter APIs behind
  one public orchestration contract.
- The implementation uses Ensemble Manager `/v1/plans`, `/v1/plans/{plan_id}`,
  `/v1/plans/runs/{run_id}`, and `/v1/plans/submit` as that boundary. Adapter
  plans retain their persisted SVO Adapter ID behind a public `svo_` prefix;
  ordinary plans use an opaque, plan-bound legacy identifier.

### 2026-09-22 — Persist adapter plans per thread model and input binding

- **Decision:** Add a dedicated `public.thread_adapter_plan` table keyed by
  `thread_model_id`, model input (`model_io_id`), and selected source resource.
- **Reason:** Adapter arguments are neither dataset metadata nor MINT catalog
  parameters. A thread-scoped record is needed so plan creation can happen
  before submission and so the Parameters step can render the immutable plan
  snapshot and saved values after reload.
- **Scope:** The first vertical slice plans selected CKAN-backed model inputs.
  A source that is already model-ready produces a `ready` record without an
  adapter child plan; a transform-required source stores the adapter plan ID,
  parameter definitions, and user values. Output-side adapter handoff remains
  feature-gated until a parent execution identity can be created safely.
- **Submission behavior:** Missing adapter values make the Parameters step
  incomplete and are rejected again by the unified server boundary. No adapter
  workflow is started by the existing Runs action until output registration and
  downstream model submission are wired together.

### 2026-09-22 — Make Ensemble Manager the adapter handoff coordinator

- **Decision:** Persist a server-owned unified execution parent and have
  Ensemble Manager reconcile adapter child runs before dispatching the existing
  model executor. The browser sends adapter plan references and values only;
  it never sequences the two services.
- **Reason:** A browser sequence cannot safely handle retries, ambiguous
  responses, child completion, output verification, or provenance. The adapter
  already persists child runs, while Ensemble Manager is the user-facing owner
  of downstream model submission.
- **Alternatives rejected:** In-memory orchestration, direct React-to-adapter
  submission, and submitting the model before adapter output is verified.
- **User feedback:** The user asked to continue implementation after approving
  the unified API.
- **Impact on implementation:** Add a persisted unified execution state record,
  adapter child reconciliation, explicit output-resource overrides for the
  existing model executors, and feature-gated UI submission. The legacy path
  remains unchanged when no adapter steps are present.

### 2026-09-22 — Implement the first adapter-to-model handoff

- **Decision:** Enable the first input-side handoff slice behind
  `SVO_ADAPTER_ENABLED`: Ensemble Manager stores a unified parent record,
  submits each selected adapter child, reconciles child status and output data
  objects, then invokes the existing model executor with in-memory resource
  overrides.
- **Reason:** This provides the requested springflow-style vertical path while
  preserving the existing thread and dataset tables and leaving ordinary runs
  untouched.
- **Alternatives rejected:** Persisting generated outputs back into the user's
  thread before execution, or making the browser poll and sequence both APIs.
- **User feedback:** The user asked to continue implementation after the
  unified API and parameter-discovery slices were in place.
- **Impact on implementation:** Add `unified_execution` state and the
  `adapter -> output_verifying -> model_dispatching` transitions. Adapter
  output binding to an already-created MINT execution is not used; the
  existing model executor creates its normal execution records after the
  verified output override is available. `adapter_unknown` and `model_unknown`
  require operator/user reconciliation and are not retried automatically.

### 2026-09-22 — Preserve adapter validation failures at unified submission

- **Decision:** If the first adapter child rejects submitted parameters with a
  4xx response, Ensemble Manager marks the parent failed and returns that
  validation response to the caller. It does not return an ambiguous parent
  run or start the downstream model.
- **Reason:** Parameter discovery belongs in plan creation and the Parameters
  step, but submission must remain server-authoritative. A user must be able
  to correct a missing or invalid value before any workflow is accepted.
- **Scope:** If an earlier child was already accepted in a multi-step parent,
  a later dispatch failure remains `adapter_unknown` and is not retried
  automatically; reconciliation is required because partial acceptance is
  ambiguous.

### 2026-09-22 — Register the unified boundary with the live OpenAPI validator

- **Decision:** Document the unified plan and run routes in Ensemble Manager's
  generated OpenAPI contract, including JSON error response schemas.
- **Reason:** The service route can be registered in Express while still being
  rejected by the global request/response validator if it is absent from the
  generated contract. The local smoke test exposed this before any adapter
  workflow was accepted.
- **Impact:** `/v1/plans`, `/v1/plans/{planId}`,
  `/v1/plans/runs/{runId}`, and `/v1/plans/submit` are now validated and
  preserve adapter 4xx responses for the UI.

### 2026-09-22 — Align the selected MODFLOW-2005 component with Tapis

- **Decision:** Point the base `modflow_2005_cfg` catalog configuration at the
  reachable Tapis app descriptor instead of the legacy WINGS ZIP.
- **Reason:** The selected spring-flow problem statement uses the base
  configuration. The Tapis executor expects JSON from `has_component_location`;
  parsing the legacy ZIP produced the observed `PK... is not valid JSON` 500.
- **Impact:** Catalog migrations `1771300000018` and `1771300000019` update
  the local/fresh fixture contract to
  `https://tapis.tapis.io/v3/apps/modflow-2005/0.0.6`. WINGS/local execution
  metadata remains in `has_implementation_script_location`.

### 2026-09-22 — Block incompatible Tapis component contracts explicitly

- **Decision:** Treat a mismatch between Tapis `jobAttributes.fileInputs` and
  the selected catalog model inputs as a submission validation error. The
  unified Ensemble Manager boundary returns `422 COMPONENT_CONTRACT_MISMATCH`
  instead of a generic 500 after all jobs fail.
- **Reason:** The local smoke test exposed that the published MODFLOW apps
  still declare package/name-file inputs while the catalog configurations use
  complete simulation archives and semantic overrides. Silently skipping or
  position-matching those inputs could submit the wrong files to a model.
- **Impact:** The MODFLOW6 output-position metadata is repaired locally, but a
  compatible Tapis app/catalog input contract is still required before a real
  MODFLOW6 or MODFLOW-2005 job can be accepted.
