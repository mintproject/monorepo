# Problem-formulation subtask run history and provenance

Status: Implemented

## Objective

Add an authoritative, server-backed previous-runs subpage for a MINT
problem-formulation subtask. Each run must be inspectable as a provenance
record, not only as a status row or application log.

## User need

**Primary user:** A groundwater modeler or facilitator using a MINT
problem-formulation subtask.

**Secondary users:** MINT/Ensemble Manager maintainers, SVO Adapter operators,
and reviewers reproducing a prior model experiment.

**Job-to-be-done:** Reopen a subtask and select any prior run to understand
exactly what data, parameters, model configuration, workflow stages, outputs,
logs, and errors were associated with it.

**Current pain:** The Runs step shows the current execution set and the current
workflow snapshot, but it does not provide a durable previous-runs history or
a single provenance view. `View Log` only exposes the application log.

**Definition of success:** A user can open a Previous Runs subpage for a
subtask, see prior runs ordered newest-first, select a run, and inspect its
inputs, parameter values, model metadata, workflow/Tapis identifiers, outputs,
log/file references, status transitions, and failure details. The same server
history is available after browser navigation, cache clearing, or sign-in from
another browser where the user is authorized.

## Current code/system summary

- `ui-react/src/pages/modeling/MintThread.tsx` loads the subtask execution
  state and submits unified plans through Ensemble Manager.
- `ui-react/src/pages/modeling/thread/MintRuns.tsx` displays the current
  execution page and application log, and now displays the latest workflow
  snapshot when available.
- `ui-react/src/graphql/generated/thread-execution.ts` queries execution rows
  with status, timestamps, `run_id`, parameter bindings, data bindings, and
  result resources.
- `mint-ensemble-manager/src/api/api-v1/paths/unifiedExecution.ts` exposes
  plan creation, plan lookup, submission, and lookup of one unified run.
- `public.unified_execution` stores unified parent state keyed by thread and
  model, including plan hash, parameter values, adapter steps, child IDs,
  outputs, and errors.
- The adapter schema stores workflow plans, workflow runs, data objects, and
  `adapter.provenance_event` rows. Tapis workflow/job IDs are stored as child
  execution identifiers and are not the complete MINT provenance record.
- Existing execution and resource rows already contain the legacy run's
  input bindings, parameter bindings, outputs, timestamps, status, and
  execution/provider ID.

## Proposed design

### 1. Server-owned run-history contract

Add a read-only Ensemble Manager endpoint scoped to one subtask:

```text
GET /v1/threads/{threadId}/runs?model_id=<optional>&limit=<optional>&cursor=<optional>
GET /v1/threads/{threadId}/runs/{runKey}
```

The list endpoint returns compact run summaries. The detail endpoint returns a
provenance packet assembled from the existing MINT execution record, unified
execution record, adapter workflow record, and provider references.

#### Canonical run identity and merge rules

The list grain is one model execution attempt. A workflow parent is the
canonical row when it exists; its adapter/model children appear under that row
in detail and are not separate list items. A legacy execution with no explicit
workflow parent is a standalone canonical row.

Every response includes a server-generated opaque `run_key`, a source-qualified
immutable source identifier, `source` (`workflow` or `legacy_execution`),
`run_kind`, lifecycle timestamps, status, model/configuration identifiers, and
`provenance_completeness` (`complete`, `partial`, `unavailable`, or
`unknown`). The source identifiers are references, not authorization grants.

The only permitted legacy/workflow merge is an exact persisted relationship:
`unified_execution.model_child_id == execution.run_id` (or an equivalent
explicit relation already stored by the system). Timestamps, names, model IDs,
users, and provider metadata are never used to infer a relationship. Unmatched
legacy rows remain standalone. Missing, conflicting, duplicate, or ambiguous
relationships are returned as separate records with a provenance warning and
are never silently merged.

List ordering is a deterministic keyset order of `effective_started_at DESC,
run_key DESC`; `cursor` encodes the last returned tuple. `limit` is bounded by
the server, and filters are allowlisted. The API does not promise a total count
because the underlying records can change while the user pages through them.

### 2. Provenance packet

The detail response contains these stable sections, with nullable fields when
a legacy run did not use a workflow:

- run identity: stable history key, MINT execution ID, parent `ue_` ID, plan ID
  and hashes, source, engine, created/start/end times, and status;
- subtask/model context: thread ID, model/configuration ID, model version or
  catalog identifiers available from the existing catalog records;
- data inputs: model I/O ID, resource/dataslice IDs, names, URLs/URIs, and
  available checksums or catalog metadata;
- parameters: model parameter IDs/names and submitted values, plus unified
  adapter parameter values when present;
- workflow: adapter plan/step IDs, workflow-run IDs, Tapis workflow/run IDs,
  stage statuses, handoff state, and failure codes;
- outputs: model output IDs and registered resources, adapter output data
  objects, URLs/URIs, and result metadata;
- logs and artifacts: authenticated links or resolvable references to model
  logs, workflow provenance events, and archived files;
- errors and transitions: structured error details and persisted timestamps.

Input, parameter, model, and output values are execution-time snapshots when
the source record has them. They are not re-read from the current catalog and
silently presented as historical values. Each snapshot carries a schema
version and, where available, content/version hashes. Requested values and
executed values are separate fields when the system can distinguish them.

External references use a typed shape (`provider`, `context`, `kind`, opaque
`source_id`, captured timestamp, optional hash, and `availability`). The server
does not return arbitrary storage URLs, credentials, or long-lived signed URLs.
Artifact access is either an authenticated Ensemble Manager proxy or a
short-lived, single-purpose server-generated link after authorization. Missing,
expired, deleted, unauthorized, and provider-unavailable artifacts are distinct
availability states.

Provenance payloads are allowlisted and size-bounded. Parameter values,
provider metadata, stack traces, and logs are redacted for credentials,
authorization headers, tokens, secrets, and unsafe filesystem or storage paths.
The API returns a safe error classification and preserves the source error only
where it passes the redaction policy.

**Decision:** Raw log text and large output files remain in
their existing providers and are fetched on demand. The authoritative MINT
record stores their IDs, URIs, metadata, and checksums where available rather
than duplicating those payloads in Hasura.

### 3. Previous Runs subpage

Add a protected route under the existing thread route:

```text
/modeling/thread/:threadId/runs
```

The page contains:

- a newest-first run list with status, source, model, timestamps, and IDs;
- filters for status/source/model when multiple model runs exist;
- a selected-run provenance detail panel;
- sections or accordions for Inputs, Parameters, Workflow, Outputs, Logs &
  Files, and Errors;
- links/actions that use the existing authenticated application-log and file
  routes, while keeping pipeline details separate from `View Log`;
- an empty state explaining that the subtask has no recorded runs.

The current Runs step gets a link to this subpage. It continues to monitor the
active run and remains the place where new runs are submitted.

### 4. Server authorization and consistency

The server must authorize access to the requested subtask before returning
any run or resource metadata. List and detail responses must be assembled from
the same authorized subtask/model scope. Pagination must be bounded, and the
server must not accept a caller-supplied Tapis ID as the authority for a run.

Authorization scope comes only from the authenticated claims and the existing
subtask ownership/team/tenant policy; request parameters never select a tenant,
owner, or project. Scope predicates are applied before both sides of the
legacy/workflow union and are rechecked on every parent-child and artifact
reference. Legacy rows with unknown or conflicting ownership are not exposed to
ordinary users. Detail responses use `404` for an inaccessible or unknown
opaque key to avoid existence leaks, and `403` only where the existing API
policy explicitly distinguishes an authenticated-but-forbidden subtask.

Sensitive responses are private and non-cacheable. Provider credentials remain
server-side. The endpoint uses bounded page sizes, allowlisted filters, query
timeouts, and payload limits; artifact retrieval is separately authorized and
audited.

The server remains authoritative. The existing browser cache is retained only
as a fast restoration fallback for the latest workflow state; it is not used
to create or define run history.

## Files likely affected

- `mint-ensemble-manager/src/api/api-v1/paths/threads/` — history list and
  detail routes and OpenAPI descriptions.
- `mint-ensemble-manager/src/api/api-v1/services/` — authorized history
  assembly, legacy/unified merge, and provenance packet mapping.
- `mint-ensemble-manager/src/api/api-v1/services/unifiedExecutionStore.ts` —
  list-by-thread/model access to unified executions and created timestamps.
- `mint-ensemble-manager/src/api/api-v1/services/unifiedExecutionService.ts` —
  unified detail mapping where it is reused by history.
- `ui-react/src/lib/ensemble-manager.ts` — authenticated history list/detail
  clients and response types.
- `ui-react/src/pages/modeling/PreviousRunsPage.tsx` — protected history
  subpage.
- `ui-react/src/pages/modeling/MintThread.tsx` and
  `ui-react/src/pages/modeling/thread/MintRuns.tsx` — navigation link and
  active-run handoff.
- `ui-react/src/App.tsx` — protected route registration.
- Focused backend and UI tests beside the affected modules.
- `mint-ensemble-manager/README.md` or API documentation for the new contract.

## API/schema changes

The first implementation should use existing execution, unified-execution,
adapter, and resource tables. It should add no destructive migration and no
new provenance payload table unless the current relationships cannot provide a
stable history key.

The first implementation is a normalized server-side projection assembled from
the existing records; it is not a heuristic browser union and does not claim
that current catalog metadata is historical provenance. If the existing tables
cannot provide an explicit workflow-to-execution relationship or ownership
scope, the API returns an unmatched record with an explicit provenance gap. A
future read-model/materialized projection may be added for scale, but it is not
required for the initial read-only page.

The API adds authenticated read-only history list/detail endpoints. The
response is a versioned JSON contract so new provenance sections can be added
without changing the meaning of existing fields.

If existing `unified_execution` queries do not expose `created_at` and
`updated_at`, the store query/type is extended to return them. No Tapis schema
change is required; Tapis identifiers remain provider references.

## Data flow

```text
Previous Runs page
  -> GET /threads/{threadId}/runs
  -> Ensemble Manager authorizes subtask
  -> read legacy execution rows + MINT bindings/results
  -> read unified parent rows by thread/model
  -> apply exact persisted parent/child relationship only
  -> return keyset-paginated newest-first summaries

Selected run
  -> GET /threads/{threadId}/runs/{runKey}
  -> assemble inputs, parameters, workflow stages, outputs, log/file refs,
     provenance events, and errors
  -> UI renders the provenance packet
  -> user opens logs/files through authenticated provider routes
```

## Risks and tradeoffs

- A combined legacy/unified response must avoid duplicate rows when a unified
  parent points to a legacy model child.
- Retries and child tasks must remain attached to the canonical attempt without
  changing the list grain or inventing a parent when the relationship is absent.
- Provenance assembly may require several Hasura relationships and can become
  expensive without bounded pagination and indexed thread/model lookups.
- Tapis job retention may be shorter than MINT record retention; the UI must
  distinguish a missing provider artifact from missing MINT provenance.
- Storing references instead of raw logs keeps the database bounded but means
  old logs can become unavailable when the provider expires them.
- The server must not expose resource URLs, logs, or parameters across subtask
  permissions.
- The initial live projection can observe changes in provider availability; the
  response therefore reports capture timestamps and completeness rather than
  pretending every external reference is immutable.

## Alternatives considered

- **Browser-only localStorage history:** rejected as the authority because it
  is user/browser-specific, can be cleared, and cannot support collaboration.
- **Tapis as the history authority:** rejected because Tapis does not own the
  MINT subtask, catalog parameter semantics, adapter plan, or model/data
  relationships.
- **Hasura-only UI queries:** rejected for the combined workflow view because
  unified reconciliation and provider references are owned by Ensemble Manager,
  and authorization/merge logic would be duplicated in React.
- **Persist raw logs and files in Hasura:** rejected for the first version due
  to size, retention, and duplication costs; store authenticated references
  and metadata instead.
- **Heuristic legacy/workflow matching:** rejected because it can attach a run
  to the wrong parent and cannot be repaired reliably; only explicit persisted
  relationships are authoritative.

## Test plan

- Backend list returns authorized legacy runs newest-first with bounded
  keyset pagination and deterministic ordering.
- Backend list returns unified workflow runs and merges a unified parent with
  its model child rather than duplicating it.
- Backend leaves unmatched, ambiguous, duplicate, and retry records explicit
  and verifies ownership before and after every relationship.
- Backend detail includes inputs, parameter values, model metadata, workflow
  IDs/stages, outputs, log/file references, provenance events, and errors.
- Authorization tests reject a subtask the caller cannot read and do not leak
  resource or provider identifiers.
- Security tests cover guessed keys, cross-tenant records, unknown legacy
  ownership, redaction, cache headers, payload limits, and artifact-link expiry.
- Missing/expired Tapis logs or files remain a successful provenance response
  with an explicit unavailable-reference state.
- Reconciliation tests cover legacy-only, workflow-only, linked, duplicate,
  ambiguous, missing-parent, retry, partial-success, and provider-failure
  records.
- UI renders empty, loading, error, legacy, and workflow history states.
- UI renders all provenance sections and keeps application logs separate from
  pipeline details.
- Route and navigation tests verify the protected Previous Runs page.
- Existing Runs-step, workflow-status, and application-log tests continue to
  pass.

## Documentation plan

- Document the history list/detail endpoints and response sections in the
  Ensemble Manager API documentation.
- Update the UI README with the Previous Runs page and the distinction between
  MINT provenance, workflow metadata, and provider-hosted logs/files.
- Add a short operator note describing provider-retention limitations.

## Rollout/rollback plan

1. Ship the read-only server endpoints and tests.
2. Ship the protected UI subpage and Runs-step link.
3. Verify legacy and workflow runs in a local/dev environment without
   submitting a new model run.
4. If the history page is unavailable, the existing Runs step and current
   workflow panel continue to function; disable only the navigation link or
   route while preserving the server records.

No backfill or destructive migration is part of the initial rollout. Existing
legacy rows are read as standalone records unless an explicit persisted link is
already present. A feature flag or route-level disable switch can turn off the
new page while leaving execution submission and existing run monitoring intact.

## Open questions

- Should the first page show all models in a subtask or default to the latest
  model configuration?
- Should log/file references be rendered as links only, or should the detail
  page also provide inline previews?
- Which model catalog fields are required in the provenance packet beyond the
  configuration ID and version?

## Decisions

- Ensemble Manager owns the authenticated history façade; Tapis and storage
  remain providers of execution artifacts.
- The canonical list grain is one model execution attempt, with a workflow
  parent owning child stages in detail.
- Only exact persisted parent/child identifiers may merge legacy and workflow
  records. No timestamp, name, or provider heuristic matching is allowed.
- The first release uses a bounded live server projection and typed external
  references; it does not introduce a destructive migration or duplicate raw
  logs/files.
- Workflow provenance events are fetched server-side from the SVO adapter when
  the selected run has persisted adapter child IDs. The response reports
  `available` or an explicit unavailable state without exposing adapter secrets
  or arbitrary provider URLs.
- User authorization to build the plan and subpage, including provenance for
  inputs, parameters, outputs, and logs, was given in this conversation on
  2026-09-24.

## User feedback / decisions

- The user confirmed that older legacy model jobs must be included because their
  execution records already exist.
- The user requested a previous-runs subpage for a problem-formulation subtask.
- The user added that provenance must cover data parameters used for the run,
  model outputs, logs, and the rest of the workflow pipeline.

## Implementation notes

- Implemented the read-only history API, normalized legacy/workflow merge,
  cursor pagination, authenticated provenance references, protected Previous
  Runs route, navigation from the Runs step, and focused UI/backend tests.
- The initial implementation keeps status observations as a current-record
  snapshot because the existing unified execution table does not persist a
  transition ledger. It does not fabricate historical transitions.
- Active workflow panels distinguish a configured post-model adapter from a
  missing adapter child: the adapter is shown as deferred until model output
  exists, and output handoff remains pending until that output is registered.
