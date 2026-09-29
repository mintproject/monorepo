# Problem-formulation runs facilitator and diagnostics views

Status: Implemented

## Objective

Rework the problem-formulation Runs experience so the default view helps a
Decision Support facilitator answer three questions quickly:

1. What did we run?
2. What is happening now, or what happened?
3. What should we do next?

Preserve the existing run, workflow, provenance, log, file, and failure data
for modelers, maintainers, and operators through an explicit advanced
diagnostics surface rather than presenting all technical detail by default.

This plan covers the embedded Runs step, the existing Previous Runs page, and
a new run diagnostics page. It also completes the result contract needed by
those views: provider output discovery is verified before success, scalar
adapter results are persisted in the existing workflow handoff JSON, and
facilitator-facing answer cards render the scalar separately from artifacts.

## User need

**Primary user:** A Decision Support facilitator who may understand the
scientific problem and model purpose but should not need to understand Tapis,
Ensemble Manager, adapter plans, provider IDs, or workflow internals to monitor
a run.

**Secondary users:** Modelers reviewing configuration and results; maintainers
and operators diagnosing failed or incomplete executions.

**Job-to-be-done:** Monitor one or more model runs, distinguish waiting,
running, completed, and failed work, understand the consequence for the
decision workflow, and open technical evidence only when needed.

**Success:** A facilitator can open the Runs step and identify the current
status, current stage, relevant configuration, and next action without reading
provider IDs or raw workflow JSON. An advanced user can still reach the exact
workflow stages, provider references, errors, artifacts, and raw provenance
needed to reproduce or diagnose the run.

**Non-goals:** This work does not change model submission semantics, workflow
orchestration, provenance storage, provider retention, authorization policy, or
the meaning of existing run states. It also does not remove technical data
from the server.

## Current code/system summary

- `ui-react/src/pages/modeling/thread/MintRuns.tsx` renders the active Runs
  step, submission controls, aggregate counts, the unified workflow panel,
  workflow graph, execution table, log dialog, and files dialog.
- `ui-react/src/pages/modeling/PreviousRunsPage.tsx` renders the protected
  `/modeling/thread/:id/runs` route, a newest-first history list, and a selected
  provenance detail view.
- `ui-react/src/pages/modeling/MintThread.tsx` owns current thread execution
  state, workflow polling, cached unified snapshots, and the Runs/Results
  navigation.
- `ui-react/src/lib/ensemble-manager.ts` already defines
  `UnifiedRunSnapshot`, `RunHistorySummary`, `RunHistoryDetail`, and the
  authenticated run-history and run-detail clients.
- `ui-react/src/App.tsx` already protects the existing run-history route.
- `docs/design/2026-09-24-subtask-run-history-provenance.md` defines the
  server-owned run-history contract and is implemented. This design builds on
  that contract rather than creating a second history authority.
- `docs/design/2026-09-24-single-model-workflow-pipeline.md` and
  `docs/design/2026-09-27-svo-adapter-reliability.md` establish the model,
  handoff, adapter, provider, and failure-stage semantics that the UI must
  preserve.

The current live page presents several representations of the same state:
aggregate counters, a workflow header, repeated provider IDs, a graph, stage
cards, and a run table. The current history page presents useful provenance,
but defaults to raw workflow JSON and low-level status observations.

## Proposed design

### 1. Establish one shared run presentation model

Add a small UI-only normalization layer for user-facing run states and labels.
It will map provider and persisted values such as `model_running`,
`adapter_running`, `workflow_pipeline`, `SUCCESS`, `FAILURE`, and `unknown` to
consistent display concepts:

- Waiting to start
- Running
- Completing / registering output
- Completed
- Failed
- Unknown / needs attention

The normalization layer will preserve the original value for diagnostics. It
will also provide stage labels in plain language:

- Prepare inputs
- Run model
- Register outputs
- Transform results

Legacy model jobs will be described as legacy execution records, not as broken
workflow records.

The normalized view model must preserve these dimensions separately:

- raw server status;
- normalized display status;
- source (`workflow` or `legacy_execution`);
- provenance completeness (`complete`, `partial`, `unavailable`, or `unknown`);
- status scope (overall run versus workflow stage).

Overall status precedence is terminal and evidence-based: a failed stage makes
the run failed; a completed model stage does not make the overall run complete
while handoff or adapter stages are pending; a run is complete only when the
server snapshot supports completion of all required stages; and missing stage
data is shown as Unknown or Not reported rather than inferred as success.
Unknown provider statuses remain Unknown / Needs review and are never treated
as either success or failure by fallback.

### 2. Redesign the embedded Runs step around facilitator questions

Refactor `MintRuns` into a compact hierarchy:

#### Run status summary

For each model, show:

- model name;
- a single prominent status badge;
- submitted/completed/failed counts;
- start time and elapsed or last-updated time when available;
- a short next-action sentence, such as “The model is running; results will
  appear when it completes.”;
- primary actions appropriate to state: Refresh, View results, Review failure,
  View log, or View files.

Do not show provider IDs in this summary. Correct the displayed run-count
language so fixed inputs are not presented as zero inputs and singular/plural
grammar is correct.

#### Stage timeline

Replace the combination of large graph, selected-stage detail, repeated stage
cards, and repeated ID rows with one compact, accessible stage timeline. Each
stage has one status, one plain-language description, and an optional short
failure message. The timeline remains capable of showing model, output
handoff, and adapter stages for composite workflows, while legacy jobs show a
single model stage and an explicit legacy label.

The timeline uses workflow-provided stage order when available. For active
snapshots without explicit ordering, it uses the deterministic semantic order
Prepare inputs → Run model → Register outputs → Transform results. It does
not claim a stage is complete unless the snapshot provides evidence for that
stage. Missing stages are Not reported / Unavailable.

The semantic SVO source/target relationship may appear as a readable label in
the timeline when it helps explain the result being produced. Full URIs remain
available in diagnostics.

#### Configuration summary

Show a concise snapshot of the run context:

- sub-task goal when available;
- region and time period;
- response/output variable;
- selected model;
- input scenario and material parameter values.

This section should not recreate the full Framing, Datasets, or Parameters
steps. It should summarize them and provide links or navigation back to those
steps for editing.

#### Run records

Keep the execution table for multiple input/parameter combinations. For a
single run, render a more readable run card or compact table with:

- status;
- start and end;
- scenario/input labels;
- key parameter values;
- log and file actions;
- result availability.

Keep pagination and reload behavior. Do not use “Downloading software image
and data…” as the only explanation when execution rows are still loading; use
“Loading run records” and, when available, a separate execution-stage status.

#### Advanced diagnostics entry point

Add a clearly labeled “Technical details” or “Open diagnostics” action for the
selected active run. This opens the dedicated diagnostics route described
below. Keep the existing Previous Runs link adjacent to the history action.

The diagnostics route is protected by the existing authenticated application
route boundary (`ProtectedRoute`). It does not create a new authorization
boundary or imply that hiding a link is security. The existing server-owned
detail endpoint remains authoritative for access to the run and its artifacts.

### 3. Refine the Previous Runs page as a facilitator history page

Keep the existing route:

```text
/modeling/thread/:threadId/runs
```

Change its default presentation to emphasize comparison and selection:

- title it “Run history” with a short facilitator-oriented description;
- show model, readable status, started time, duration when available, and a
  concise outcome or next action;
- preserve source/model/status filters and bounded pagination;
- avoid exposing raw source names, opaque IDs, or provenance-completeness
  terminology in every list row unless they affect the user’s next action;
- distinguish legacy execution and workflow runs with readable labels;
- make failed runs visually scannable and show a short failure summary when
  the API provides one;
- keep the selected-run detail summary focused on inputs, parameters, stages,
  outputs, errors, logs, and files;
- collapse technical identifiers and raw payloads by default;
- link the selected run to the diagnostics page.

When a filter change removes the selected run from the visible list, clear the
detail selection and select the first visible run, or show the empty detail
state when no runs remain. Do not keep showing a hidden run without labeling
that it is outside the current filter.

The page should remain useful when a run is incomplete or partially available.
It should explain missing artifacts in plain language, for example “The model
record is available, but provider logs are no longer available.”

### 4. Add a dedicated advanced diagnostics page

Add a protected route:

```text
/modeling/thread/:threadId/runs/:runKey/diagnostics
```

The page will use the existing authenticated
`fetchRunHistoryDetail` request and will not introduce a second data source.
It will contain explicit diagnostic sections:

- Run identity and source;
- model/configuration identity;
- workflow and stage records;
- provider references, including Tapis pipeline/run/model job IDs;
- plan, parameter-value, and idempotency hashes;
- raw workflow/provenance JSON in a bounded scrollable viewer;
- error code, provider message, stage, and status history;
- artifact availability and authenticated log/file links;
- provenance completeness and missing-record warnings.

The page should support copying individual identifiers and copying/downloading
bounded JSON where the existing application conventions permit it. It must
not expose credentials, tokens, signed URLs, or unsafe provider payloads.

The page must handle an invalid or missing run key with the existing protected
route/error behavior and must verify the selected detail belongs to the thread
through the existing thread-scoped endpoint. Direct navigation and browser
refresh must work without relying on the active Runs step having been visited.

The diagnostics page is for authorized users who can already view the run. It
does not create a new authorization boundary; it simply changes the default
presentation of data the existing detail endpoint already returns.

### 5. Share components and preserve behavior

Extract shared presentation components so active runs, history details, and
diagnostics use the same status vocabulary and stage rendering. Likely shared
components include:

- `RunStatusSummary`;
- `RunStageTimeline`;
- `RunConfigurationSummary`;
- `RunArtifactActions`;
- `RunDiagnosticsSections`;
- status/label formatting helpers.

### 6. Restore modular transform handoffs

The current fused DFC function is a reliability workaround, not the target
architecture. Replace it for ordinary linear transform chains with explicit
typed task outputs using the Tapis Workflows task-output reference mechanism.

Each hosted transform task will receive its declared input contract, emit a
named `result` task output containing versioned JSON, and print the same
bounded result for diagnostics and archived provenance.

For a chain such as `budget_extract_drain -> flow-m3s-to-cfs`:

1. The extraction task consumes the model CBC URI and emits a scalar result in
   `m3s`.
2. The conversion task receives that prior task's `result` through
   `value_from.task_output`, validates the input value/unit, and emits the
   converted `cfs` result.
3. The adapter poller treats the final task's result as the adapter answer and
   the archived task stdout as evidence, rather than conflating the source CBC
   URI with the transformed result.

The workflow generator will only use task-output chaining for supported linear
chains. Branching or multi-input plans retain their DAG shape and will not be
silently fused. The existing fused builder remains only as backward-compatible
legacy code and is no longer selected by the ordinary workflow generator.

#### Composite model output identity

The composite output-handoff must not infer a provider archive from the
Ensemble Manager execution ID or from a predictable job name. The generated
function task declares Tapis Workflows' standard pipeline/run environment
values as `env`-bound inputs. After the model task completes, the handoff uses
that exact workflow run and model task execution to obtain the provider Tapis
Job UUID, then lists the job output through the Jobs API. The planned archive
URI remains a run-scoped fast path, but a missing planned directory is resolved
through the authoritative provider job identity. Name-based `MY_JOBS` discovery
is not a correctness fallback.

Submission, polling, authenticated artifact access, files promotion, results
navigation, legacy compatibility, and the existing server-owned history
identity remain unchanged.

## Files likely affected

Primary UI files:

- `ui-react/src/pages/modeling/thread/MintRuns.tsx` — facilitator-first active
  run layout and entry points.
- `ui-react/src/pages/modeling/PreviousRunsPage.tsx` — history-first list and
  summary detail.
- `ui-react/src/pages/modeling/MintThread.tsx` — pass available thread/context
  information to the active run summary and preserve navigation behavior.
- `ui-react/src/App.tsx` — register the protected diagnostics route before the
  broad thread route.
- `ui-react/src/lib/ensemble-manager.ts` — reuse existing types and add only
  missing optional display fields if the current response requires them.
- `ui-react/src/components/modeling/runs/RunAnswerCard.tsx` — facilitator-facing
  scalar answer projection, kept separate from file artifacts.

Execution/result boundary files:

- `svo-adapter-service/app/tapis.py` and `app/task_code.py` — generate modular
  function tasks with named typed outputs and task-output references for linear
  DFC chains.
- `svo-adapter-service/app/result_contract.py` and `app/poller.py` — parse only
  bounded scalar fields and turn JSON task errors into failed runs.
- `svo-adapter-service/app/task_code.py` — emit named task outputs and consume
  typed intermediate JSON for reusable unit conversions.
- `mint-ensemble-manager/src/classes/tapis/adapters/TapisExecutionService.ts`
  and `src/api/api-v1/services/unifiedExecutionService.ts` — honor the selected
  model output, verify it exists in the provider archive, and persist adapter
  results in the existing handoff.

New UI files, following the existing modeling conventions:

- `ui-react/src/lib/modeling/run-status.ts`;
- `ui-react/src/components/modeling/runs/RunConfigurationSummary.tsx`;
- `ui-react/src/components/modeling/runs/RunStatusSummary.tsx`;
- `ui-react/src/components/modeling/runs/RunStageTimeline.tsx`;
- `ui-react/src/pages/modeling/RunDiagnosticsPage.tsx`.

Tests:

- `ui-react/src/pages/modeling/thread/__tests__/MintRuns.test.tsx`;
- `ui-react/src/pages/modeling/__tests__/PreviousRunsPage.test.tsx`;
- a new `ui-react/src/pages/modeling/__tests__/RunDiagnosticsPage.test.tsx`;
- `ui-react/src/lib/modeling/__tests__/run-status.test.ts`;
- route/auth coverage in `ui-react/src/__tests__/modeling-routes-auth.test.tsx`;
- direct-load, detail-load error, filter-selection, and accessibility coverage.

Documentation likely affected:

- this design spec;
- `ui-react/CLAUDE.md` or the repository UI documentation only if the project
  documents modeling routes or UI conventions that change.

No backend files are expected in the first UI implementation unless a required
facilitator context field is missing from the existing GraphQL thread query or
run-history response.

## API/schema changes

No database migration is required. The execution request now carries the
user-selected `start_date`, `end_date`, and boundary URI into
the existing adapter workflow argument map. The existing thread date fields
remain the source of truth; no new schema fields are introduced.
The implementation will use:

- the existing `UnifiedRunSnapshot` for the active-run monitor;
- the existing `RunHistorySummary` and `RunHistoryDetail` endpoints for history
  and diagnostics;
- the existing thread GraphQL query for goal, region, dates, and variable
  context.

The existing JSON run contracts are extended additively: the adapter poll
response may expose a bounded `result` object (`schema_version`, `status`,
numeric `value`, and optional `unit`/`operation`), and the unified run's
`output_handoff` stores that object as `result`. Composite model output
selection uses the requested `model_output_key`; a missing archived output is
an explicit `MODEL_OUTPUT_NOT_FOUND` failure rather than a successful handoff.

Hosted function task definitions additionally declare a named `result` output.
Dependent tasks reference that output with Tapis Workflows' existing
`value_from.task_output` contract. No database migration is required.

Composite output-handoff function tasks additionally bind
`TAPIS_WORKFLOWS_PIPELINE_ID` and `TAPIS_WORKFLOWS_PIPELINE_RUN_UUID` from the
Workflows environment so the function can correlate the preceding model task
to its runtime Tapis Job UUID. The final URI is therefore the provider-returned
output path, including job outputs resolved under the user's `$SCRATCH`, rather
than a synthesized URI based on the logical execution ID.

If the history route cannot obtain the minimum human-readable context from the
existing GraphQL query, add the smallest read-only client query or optional
server response fields needed to show it. Do not duplicate current catalog
metadata as historical execution values; execution-time snapshots remain
authoritative.

## Data flow

```text
Active Runs step
  -> existing thread execution query + unified workflow snapshot
  -> status/stage normalization
  -> facilitator summary + stage timeline + run records
  -> optional diagnostics route

Run history
  -> GET /threads/{threadId}/runs
  -> readable history list
  -> GET /threads/{threadId}/runs/{runKey}
  -> facilitator summary detail
  -> /diagnostics route for the same immutable detail packet

Composite model/adapter execution
  -> verify the declared model output in the provider archive
  -> run the modular DFC extraction and conversion tasks
  -> parse the bounded scalar result from the final task output
  -> persist it in `output_handoff.result`
  -> render it as a facilitator answer card alongside, but separate from,
     downloadable file artifacts

Modular transform chain
  -> task N consumes the declared source/artifact input
  -> task N emits typed result JSON as named task output `result`
  -> task N+1 receives `value_from.task_output(task N, result)`
  -> final task result becomes the adapter scalar answer
```

The UI must not infer workflow parentage, merge runs, or treat browser cache as
history authority. The server remains authoritative as defined by the existing
run-history design.

For model-output adapter runs, the Datasets step can derive the common date
window across selected CKAN archives. The user may apply that window to the
thread before saving and running. Submission forwards the saved thread dates
and selected spatial boundary to the adapter so workflow validation happens
before the model run rather than after a long model execution.

## Risks and tradeoffs

- Hiding IDs by default may make support conversations slower if users do not
  know where to find them. Mitigation: provide copyable identifiers in
  diagnostics and a clear “Open diagnostics” path.
- A compact timeline may oversimplify adapter failures. Mitigation: show a
  stage-specific failure summary and link directly to diagnostics/logs.
- A single-run card and multi-run table have different strengths. Mitigation:
  choose the layout based on run cardinality while keeping the same status and
  action components.
- Active workflow status and provenance completeness can be confused if they
  share one badge. Mitigation: render them as separate fields; a completed run
  may still have partial provenance.
- Existing statuses mix provider and application semantics. Mitigation:
  normalize only for presentation and preserve raw values in the diagnostic
  payload.
- The workflow graph may be useful to technical modelers even when it is too
  dense for facilitators. Mitigation: replace it in the default view with a
  timeline and retain graph/raw workflow information on diagnostics, with the
  option to add a visual graph there if needed.
- Legacy and partial-provenance runs may not have enough data for every summary
  field. Mitigation: render explicit “not recorded” or “no longer available”
  states rather than guessing.
- Extracting components can unintentionally change polling, artifact access, or
  files promotion behavior. Mitigation: keep data-fetching and mutation logic
  in the existing containers and add focused regression tests before removing
  old markup.
- Archive metadata may be incomplete or incompatible across selected inputs.
  Mitigation: offer the archive-date action only when every selected archive
  declares bounded, overlapping coverage; keep manual Framing date editing
  available.
- Older generated adapter workflows may retain a required AOI argument even
  when the DFC task consumes `geometry_source_uri`. Mitigation: forward the
  selected boundary URI to that compatibility argument while retaining the
  canonical DFC boundary argument.
- Provider completion can contain an error JSON payload while the workflow
  wrapper reports `COMPLETED`. Mitigation: inspect structured task output and
  fail the adapter run with a bounded error message.
- A model can complete while its declared output is absent from the resolved
  archive. Mitigation: list the provider archive and fail with an explicit
  output-resolution code before dispatching the adapter stage.
- Scalar results are useful to facilitators but must not become untrusted raw
  stdout in the UI. Mitigation: accept only finite numeric scalar fields and
  keep provider logs in the technical diagnostics path.
- Tapis task-output references may differ by task type or tenant version.
  Mitigation: generate them only for hosted function tasks, assert the shape in
  dry-run tests, and fail clearly if a required intermediate result is absent
  rather than falling back to the original source URI.
- Tapis Workflows may expose its standard run identifiers only through declared
  task inputs, not the function process environment. Mitigation: bind the
  identifiers explicitly with `value_from.env`, resolve the exact model task
  execution, and fail closed when that context is unavailable instead of
  selecting a same-name job from a broad user job listing.

## Alternatives considered

- **Only reduce text in `MintRuns`:** Rejected because history and diagnostics
  would remain mixed and the same duplication would recur on the provenance
  page.
- **Delete provider and provenance information:** Rejected because maintainers
  and modelers need it for reproducibility and support.
- **Create a separate diagnostics backend:** Rejected for the first phase; the
  existing server-owned detail packet already contains the required data.
- **Keep the workflow graph as the primary representation:** Rejected for the
  facilitator default because it requires implementation knowledge and repeats
  the stage cards.
- **Role-based authorization for diagnostics:** Deferred. The first phase uses
  existing run authorization and presentation-level progressive disclosure.

### 2026-09-27 - Use one evidence-based status model

- **Decision:** All facilitator, history, and diagnostics surfaces will use a
  shared pure status/view-model layer that preserves raw status and provenance
  completeness separately.
- **Reason:** Independent status calculations would recreate the duplication and
  could incorrectly mark a partially observed workflow as successful.
- **Alternatives rejected:** Per-component status logic; treating unknown or
  missing stage data as success; using provenance completeness as run status.
- **User feedback:** User approved implementation of the plan; this refinement
  incorporates the architecture and skeptic review before code changes.
- **Impact on implementation:** Add a pure `run-status` or `run-view-model`
  module and test it independently from React rendering.

### 2026-09-27 - Keep diagnostics behind the existing route guard

- **Decision:** The diagnostics page uses the existing `ProtectedRoute` and
  thread-scoped history endpoint; no new authorization boundary or backend
  endpoint is introduced.
- **Reason:** The data is already authorized by the existing server-owned
  detail contract, and the change is presentation-level progressive
  disclosure.
- **Alternatives rejected:** Link-only hiding; a new UI-only permission model;
  a second diagnostics API.
- **User feedback:** User approved implementation; no separate authorization
  requirement was requested.
- **Impact on implementation:** Add direct-load and route/auth tests, while
  preserving server-side thread scoping.

### 2026-09-27 - Clear history selection when filters exclude it

- **Decision:** Changing filters clears a selected run that is no longer
  visible, then selects the first visible run when one exists.
- **Reason:** Showing hidden detail alongside a filtered list makes the page
  appear inconsistent and obscures which run the user is inspecting.
- **Alternatives rejected:** Keep hidden detail silently; retain it with no
  explanation.
- **User feedback:** User approved implementation; this is an implementation
  default from the architecture review.
- **Impact on implementation:** Add an effect or derived selection guard and
  test filter changes in `PreviousRunsPage.test.tsx`.

### 2026-09-28 - Correlate composite output through the provider job UUID

- **Decision:** Bind the Workflows pipeline/run identifiers into the
  output-handoff function and use the preceding model task execution to obtain
  the exact Tapis Job UUID. Remove name-based Jobs-list association from the
  handoff.
- **Reason:** The observed model output is under the provider job's resolved
  `$SCRATCH` directory (`.../<job-uuid>/output`), while the handoff was using a
  logical `ue_<execution-id>` archive path and could not find a matching job by
  name. A same-name fallback can associate another retry or user's output.
- **Alternatives rejected:** Reconstructing the `$SCRATCH` path; broad
  `MY_JOBS` name matching; fusing extraction and conversion; running another
  live model before the identity contract is corrected.
- **User feedback:** User supplied the actual `$SCRATCH` output path and
  approved fixing the handoff boundary.
- **Impact on implementation:** Update generated SVO task inputs and lookup,
  preserve the provider-returned URI through Ensemble Manager reconciliation,
  and add mock coverage for the exact UUID and missing-context failure.

## Test plan

### Status and shared components

- Normalize all current provider/application statuses into the agreed display
  states.
- Preserve raw status values for diagnostics.
- Render running, completed, failed, waiting, unknown, legacy, and partial
  provenance cases.
- Verify singular/plural run counts and fixed-input count handling.

### Active Runs step

- Verify the facilitator summary shows one canonical overall status.
- Verify the stage timeline renders composite and legacy runs correctly.
- Verify refresh, log, file, results, and diagnostics actions remain wired to
  their existing callbacks.
- Verify polling and cached workflow restoration are unchanged.
- Verify multi-run configurations still paginate and display input/parameter
  columns.

### History and diagnostics

- Verify newest-first history, filters, pagination, selection, and empty/error
  states.
- Verify a selected run shows a concise summary without requiring raw JSON.
- Verify the diagnostics route loads the same run key and renders IDs, hashes,
  raw workflow data, errors, status observations, and artifacts.
- Verify legacy runs explain missing workflow stages without implying failure.
- Verify unavailable artifacts are described clearly and do not break the page.
- Verify protected route behavior and authenticated artifact requests.

Run focused Vitest/Jest suites first, then the UI typecheck/build and the
relevant route/auth tests. Backend coverage verifies the result contract,
provider-error propagation, modular spring-flow task-output wiring, and
Python syntax. No provider or MINT execution is required for this change.

## Documentation plan

- Keep this design spec as the source of truth during implementation.
- Update UI route or contributor documentation only if the diagnostics route or
  component conventions need to be documented for maintainers.
- Document the facilitator-versus-diagnostics information hierarchy in the UI
  code comments only where the separation is not obvious from the component
  structure.

## Rollout/rollback plan

Roll out as a UI-only change behind the existing local/build workflow. The
existing `/modeling/thread/:id/runs` route remains available and the active
Runs step remains the entry point, so no data migration is needed.

If the new presentation causes a regression, rollback is a frontend revert to
the previous `MintRuns`, `PreviousRunsPage`, and route/component changes. The
server-owned run history and existing run records remain readable throughout.

## Implementation result

- The active Runs step now presents one normalized status summary, a compact
  run-configuration summary, and a plain-language stage timeline. Technical
  identifiers and the workflow graph remain available in collapsed sections.
- Run history now uses facilitator-facing status/source labels, keeps the useful
  provenance sections readable, collapses the raw workflow by default, and
  reselects a visible run when filters hide the current selection.
- The protected diagnostics route loads the same thread-scoped detail packet on
  direct navigation or refresh and exposes identifiers, hashes, provenance,
  status history, artifacts, and bounded raw JSON.
- Adapter workflow submission now receives the saved thread dates and selected
  boundary context, and missing dates are rejected before model dispatch.
- The Datasets step can apply the common bounded date range declared by the
  selected CKAN archives to the sub-task.
- No database migration, authorization, deployment, or external provider
  mutation was made.
- The spring-flow path now keeps extraction and unit conversion as separate
  hosted tasks, propagates the final bounded scalar result through the adapter
  poll response and unified output handoff, and displays the value/unit in both
  Runs and Results.
- Hosted transforms now declare a named `result` output; scalar consumers use
  explicit `task_output` references and explicit DAG edges, so reusable
  transforms no longer depend on shared filesystems or UI stdout parsing.
- Composite model output selection now honors the adapter's requested output
  name and verifies the corresponding archived file before adapter dispatch.
- Deferred post-model orchestration now submits the model through the normal
  Tapis execution service, resolves and registers the provider's actual output
  URI in Ensemble Manager, then submits a source-only SVO adapter workflow.
  The adapter rejects new composite `model_task` submissions so generic
  function tasks cannot be asked to infer their parent workflow run.
- Composite output handoff now receives the Workflows pipeline/run identifiers
  through declared task inputs, resolves the exact model task provider job,
  and returns the provider's materialized `$SCRATCH` output URI. The manager
  trusts that authenticated handoff URI instead of re-deriving the logical
  archive path.
- Verification passed with the exact provider job UUID from the reported
  `$SCRATCH` path; the adapter and manager focused tests/build passed. The
  environment still lacks pytest, so Python coverage was validated with
  compile checks and a direct generated-workflow harness.

## Open questions

1. Should the facilitator summary be the default for every authorized user,
   with diagnostics always available, or should there be a user preference for
   a technical default?
2. For a single run, should the run table become a compact run card, or should
   the table remain for consistency with multi-run ensembles?
3. Should the stage timeline include readable SVO variable labels by default,
   or should semantic contracts appear only when the facilitator asks for
   them?
4. Should diagnostics support copy/download of bounded raw JSON in the first
   release, or only on-screen inspection and existing artifact links?
5. Is “Decision Support facilitator” the correct primary role label for this
   experience, or should the UI use a broader term such as “facilitator” or
   “modeling facilitator”?

## Decisions

### 2026-09-27 - Use progressive disclosure for technical run data

- **Decision:** Keep technical IDs, raw workflow JSON, hashes, provider status
  history, and provenance warnings available, but move them out of the default
  facilitator view into a dedicated diagnostics surface.
- **Reason:** The information is valuable for debugging and reproducibility but
  currently competes with the facilitator’s need to understand progress and
  next action.
- **Alternatives rejected:** Deleting technical data; keeping all details
  visible by default.
- **User feedback:** The user asked for a plan covering the facilitator view
  and advanced pages; implementation was approved in the current conversation.
- **Impact on implementation:** Add shared facilitator/diagnostic components
  and a protected diagnostics route while preserving the existing detail API.

### 2026-09-27 - Prefer existing server-owned run data

- **Decision:** Treat the existing run-history and unified workflow contracts as
  the data authority for the redesign.
- **Reason:** The repository already provides immutable run keys, workflow
  stages, inputs, parameters, outputs, artifacts, and errors.
- **Alternatives rejected:** Browser-only history; a new UI-specific backend
  projection in the first phase.
- **User feedback:** The user approved implementation using the existing
  server-owned run data.
- **Impact on implementation:** The UI continues to use the existing
  server-owned history/detail contracts; the additive scalar handoff fields
  are produced by the adapter and unified orchestration layers.

### 2026-09-27 - Keep first release focused on on-screen diagnostics

- **Decision:** Implement on-screen technical diagnostics and existing
  authenticated artifact links in the first release; defer copy/download
  controls for raw JSON and identifiers.
- **Reason:** The existing detail packet already supports diagnosis, while
  copy/download behavior needs a shared interaction convention and does not
  change the facilitator-facing hierarchy.
- **Deviation from proposal:** The active Runs step links to the existing run
  history, where the immutable run key is known, rather than guessing a
  diagnostics URL from an active execution ID. Diagnostics are directly
  reachable from each selected history record.

### 2026-09-27 - Use compact existing context for the active summary

- **Decision:** Show input-resource, parameter-combination, and output counts
  in a reusable configuration summary rather than adding a second query for
  goal, region, or time-period context.
- **Reason:** The current execution-focused thread data does not carry all
  framing fields, and the count summary is available without changing the
  data contract or duplicating wizard content.
- **Deviation from proposal:** Goal, region, and time-period labels remain in
  the existing framing/context steps until the thread query exposes a stable
  execution-time snapshot for them.

### 2026-09-27 - Treat archive coverage as an explicit run-date choice

- **Decision:** Keep dates editable in Framing, and add a Datasets-step action
  that applies the common bounded coverage of the selected archives.
- **Reason:** A facilitator should be able to align a run with the actual CKAN
  archive without manually transcribing dates, while still being able to choose
  a narrower valid window.
- **Alternatives rejected:** Automatically changing dates whenever an archive
  is selected; inferring a range when one archive has an open-ended or missing
  bound.

### 2026-09-28 - Carry scalar answers separately from artifacts

- **Decision:** Store the parsed adapter scalar under the existing JSON
  `output_handoff.result` field and render it with a dedicated answer card.
- **Reason:** A facilitator needs the modeled value, while technical users
  still need the downloadable output URI. Treating the URI as the value caused
  the current omission.
- **Alternatives rejected:** Browser-side stdout parsing; a new database column;
  encoding the scalar into an artifact filename.
- **User feedback:** User asked to implement the missing spring-flow value.
- **Impact on implementation:** Add a bounded result parser at the adapter
  boundary, propagate it through unified reconciliation, and add active Runs /
  Results rendering and tests.

### 2026-09-28 - Superseded: fuse the spring-flow extraction/conversion chain

- **Decision:** Generate one hosted DFC function task for a linear chain of
  supported extraction and unit-conversion transforms.
- **Reason:** Hosted function tasks do not reliably pass actor-produced files
  between steps, while the fused implementation keeps the numeric actor result
  in memory and emits a canonical scalar payload.
- **Impact:** The source CBC remains the input evidence; the adapter's archived
  stdout is the discoverable output artifact, and the numeric result is stored
  separately in the handoff.
- **Superseded by:** The modular task-output decision below. The fusion remains
  only as backward-compatible builder code and is no longer selected for the
  ordinary spring-flow workflow.

### 2026-09-28 - Replace the fusion workaround with modular task outputs

- **Decision:** Supersede fusion for ordinary linear DFC chains. Each hosted
  transform emits a named typed `result` output, and the next task consumes it
  through Tapis Workflows' `task_output` reference.
- **Reason:** Reusable transform pieces must remain independently executable,
  composable, and testable. The original failure was a missing inter-task
  output binding, not an inherent need to combine extraction and conversion.
- **Alternatives rejected:** Keep the fused DFC task as the general solution;
  rely on shared function-task filesystems; parse provider stdout in the UI.
- **User feedback:** User explicitly requested the modular architecture be
  fixed properly rather than retaining the fusion workaround.
- **Impact on implementation:** Update workflow generation, task-code output
  contracts, unit-conversion input handling, and focused chain tests. Preserve
  the fused builder only for backward-compatible legacy callers.

### 2026-09-28 - Verify model archive output before adapter dispatch

- **Decision:** Resolve the model output from the provider job archive listing
  and fail the run if the declared output is absent.
- **Reason:** The current logical `model/cbb` URI returned 404 while the
  provider wrapper reported completion.
- **Alternatives rejected:** Continue using the guessed URI; register a
  placeholder output; treat a completed workflow wrapper as model success.
- **User feedback:** User asked to implement the fix.
- **Impact on implementation:** Extend the Tapis execution service handoff
  contract and update unified orchestration tests.

### 2026-09-28 - Resolve composite handoff from the provider job at runtime

- **Status:** Superseded for new post-model runs by the deferred orchestration
  decision below. Retained only for compatibility with previously generated
  definitions.

- **Decision:** The composite output-handoff task resolves the completed model
  job by its server-owned job name, lists its real archived files through the
  Tapis Jobs API, and publishes the selected resource URI through a typed
  `result` task output. The first adapter task consumes that task output rather
  than the planned URI stored in the submission descriptor.
- **Reason:** Tapis assigns the provider job UUID only after submission, and
  the declared MINT output key (`cbb`) may differ from the archived filename
  (`*.cbc`). A precomputed `model/cbb` path is therefore not a reliable input.
- **Failure behavior:** Missing credentials, an undiscoverable job, an empty
  archive, or an ambiguous output match fails the handoff with a structured
  error. The manager also accepts the unambiguous semantic `cbb`/`cbc` output
  mapping when verifying the completed model stage.
- **Security boundary:** The pipeline definition contains no bearer token;
  the caller token is bound only to the runtime task input, consistent with
  the existing actor/file access contract.
- **Impact on implementation:** Add the runtime resolver to the adapter
  workflow generator, include the model output format in the manager handoff
  descriptor, and add provider-output matching tests.

### 2026-09-28 - Prefer the materialized archive directory for composite handoff

- **Status:** Superseded for new post-model runs by the deferred orchestration
  decision below. Retained only for compatibility with previously generated
  definitions.

- **Decision:** The handoff first lists the server-owned archive directory
  derived from the planned URI, then falls back to workflow task-execution
  metadata and finally the Jobs name listing.
- **Reason:** The Jobs list is not reliably discoverable from the hosted
  function task even when the preceding model job completed; the Files API is
  the authoritative view of the materialized archive path.
- **Failure behavior:** The handoff still requires an unambiguous output match
  and returns a structured failure when the archive directory and provider
  fallbacks contain no declared output.

### 2026-09-28 - Make output discovery failures diagnostically actionable

- **Decision:** Include bounded lookup-attempt metadata in the handoff error
  contract, including method, safe path, HTTP/transport status, and candidate
  counts.
- **Reason:** Repeated generic `not discoverable` failures could not distinguish
  an incorrect archive path from missing provider visibility or an empty model
  archive.
- **Security boundary:** Never include bearer tokens, authorization headers, or
  unbounded provider response bodies in the diagnostic payload.

### 2026-09-28 - Correlate composite output through the provider job UUID

- **Decision:** Pass the Workflows pipeline and run identifiers into the
  `output-handoff` task through `value_from.env`, resolve the model task's
  exact provider job UUID, and list that job's output files. Do not associate
  a job by name or synthesize a path from the logical execution ID.
- **Reason:** The reported provider output lived under the Tapis job's
  `$SCRATCH` path, while the logical `ue_*` archive URI returned 404 and the
  hosted task could not reliably discover the job through `MY_JOBS`.
- **Failure behavior:** Missing workflow context or an absent exact task
  execution fails closed with a diagnostic that identifies the missing
  correlation rather than guessing across jobs.
- **Impact on implementation:** The adapter workflow generator declares both
  runtime inputs, and unified reconciliation preserves the verified provider
  URI returned by the adapter.

### 2026-09-28 - Move upstream model output discovery to deferred orchestration

- **Decision:** Do not make a generic Tapis Workflows function task discover
  its parent pipeline run. Ensemble Manager must resolve the completed model
  output after it has the actual provider execution identity, then submit the
  SVO adapter workflow with the concrete materialized URI.
- **Reason:** `value_from.env` resolves pipeline environment values; the
  `TAPIS_WORKFLOWS_*` variables are documented for ETL Jobs and are not a
  reliable contract for a generic function task. The pipeline run UUID also
  does not exist until after submission.
- **Alternatives rejected:** Adding more environment fallbacks; converting
  the handoff to another task type without a typed predecessor output; broad
  Jobs name matching.
- **Impact on implementation:** Remove upstream model discovery from the
  ordinary deferred adapter workflow, preserve exact provider correlation in
  Ensemble Manager, and keep the adapter responsible only for transforming a
  supplied source URI.

### 2026-09-28 - Keep unit-conversion failures inside the shared task contract

- **Decision:** Define the structured `_die` helper in the common hosted-task
  helper and preserve an upstream `{status: "error"}` payload when a modular
  unit-conversion task receives one.
- **Reason:** The unit task previously raised `NameError: _die is not
  defined`, masking the actual missing-output error and making the modular
  chain harder to diagnose.
- **Impact on implementation:** The extraction and conversion tasks remain
  separate reusable pieces while their error and result envelopes are
  consistent.

### 2026-09-28 - Configure the local CKAN-backed smoke subtask

- **Decision:** Configure the saved local smoke subtask to use the CKAN-backed
  MODFLOW 2005 Barton Springs archive for 2001–2010, GMA 10 scope, the current
  geo actor, and the modular CBC extraction → CFS conversion plan.
- **Reason:** The prior saved subtask still pointed at the earlier extraction-
  only plan and did not carry the runtime values required by the geo-actor
  transform.
- **Verification:** The persisted plan now has two ordered transforms,
  `budget_extract_drain` followed by `unit_convert`, with the spring flow
  standard variable and `cfs` target contract. No model execution was
  submitted as part of this configuration check.
- **UI note:** The thread's catalog region remains the broad Texas geography;
  the effective GMA 10 selection is carried by the saved adapter parameters
  (`spatial_scope_id` and the statewide GMA geometry source).

### 2026-09-28 - Preserve saved adapter plans across UI reloads

- **Decision:** Treat a persisted adapter plan as authoritative when its source
  inputs and model-output target still match the current subtask fingerprint.
  Re-discovery must preserve saved runtime values and the saved target unit.
- **Reason:** The UI was replacing the correct GMA 10/CFS plan on reload with a
  new plan derived from the broad `texas` thread region. The model then appeared
  selected in the task rail but lost its effective execution context.
- **Impact on implementation:** Load existing plans before discovery, fingerprint
  only their source inputs/outputs, hydrate spatial context from saved values,
  and carry forward target-unit metadata when discovery is required.

## User feedback / decisions

 User approved implementation in the current conversation. Architecture,
 skeptic/security, and tester review identified the need for a bounded scalar
 contract, explicit missing-output failure, and zero-value test coverage.
