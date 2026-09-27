# SVO adapter workflow reliability and diagnostics

Status: Implemented

## Objective

Make deferred SVO adapter workflows reliable after a successful model run, and
make provider-side submission or execution failures visible in run details.

## User need

**Primary user:** A researcher using the local modeling UI to run a MODFLOW
workflow and inspect its outputs.

**Secondary users:** Developers and operators diagnosing Tapis Workflow and SVO
adapter failures.

**Job-to-be-done:** Determine whether the model, output handoff, and SVO
transformation each succeeded, and see an actionable provider error when one
fails.

**Current pain:** The original adapter run was rejected by Tapis because
`execution_id` was missing, but the persisted adapter record had a null
`error_message`.

**Definition of success:** Deferred submissions include the managed
`execution_id`; provider failures are persisted with an actionable message;
polling failures retain context; and the UI shows the failure on the correct
stage while preserving successful model and handoff results.

## Current code/system summary

Ensemble Manager submits deferred adapter workflows through
`mint-ensemble-manager/src/api/api-v1/services/unifiedExecutionService.ts`.
The SVO adapter accepts `/workflows/submit`, generates a Tapis pipeline, and
polls Tapis through `svo-adapter-service/app/main.py` and `app/tapis.py`.

The coordinator now injects `execution_id` into both deferred workflow
arguments and top-level submission metadata. A retry using that path completed
successfully. The original failure occurred before any Tapis task execution.

## Proposed design

1. Keep coordinator-side managed argument injection for deferred post-model
   submissions in both the workflow argument map and request metadata.
2. Validate matching managed arguments before contacting Tapis and return
   stable structured errors for missing or mismatched execution IDs.
3. Persist sanitized provider failures in `error_message` and provenance. If
   Tapis reports `FAILED` without task details, store an actionable fallback.
4. Carry adapter error text onto the adapter child stage while keeping model
   and output-handoff stages independent.
5. Add focused regression tests and rebuild the affected local services.

## Files affected

- `mint-ensemble-manager/src/api/api-v1/services/unifiedExecutionService.ts`
- `mint-ensemble-manager/src/api/api-v1/services/unifiedExecutionService.test.ts`
- `svo-adapter-service/app/error_handling.py`
- `svo-adapter-service/app/etl_contract.py`
- `svo-adapter-service/app/main.py`
- `svo-adapter-service/app/poller.py`
- `svo-adapter-service/tests/test_demo_api.py`
- `svo-adapter-service/tests/test_error_handling.py`
- `svo-adapter-service/tests/test_plan_parameters.py`
- `svo-adapter-service/tests/test_poller.py`
- `svo-adapter-service/docs/api.md`

## API/schema changes

No database migration is required. Existing `status`, `failure_code`, and
`error_message` fields are used consistently. Bound deferred submissions now
return `DEFERRED_EXECUTION_ID_REQUIRED` or
`DEFERRED_EXECUTION_ID_MISMATCH` for invalid managed IDs. Provider submission
failures return `TAPIS_WORKFLOW_SUBMISSION_FAILED` with a persisted run ID.

Provider diagnostics are bounded and sanitized before persistence; credentials
and signed URL parameters are not included.

## Data flow

```text
model succeeds
    -> Ensemble Manager registers output handoff
    -> submits deferred adapter with execution_id in args + metadata
    -> adapter validates managed args
    -> Tapis accepts and runs pipeline
    -> adapter polls provider and stores status/error/provenance
    -> Ensemble Manager reconciles child run
    -> UI renders model, handoff, and SVO stages independently
```

## Risks and tradeoffs

- Stricter validation can expose malformed callers earlier, which is preferable
  to an opaque provider failure.
- Provider messages improve diagnosis but must remain bounded and redacted.
- Adapter retries must remain idempotent and must not duplicate outputs.
- Existing unrelated working-tree changes were preserved.

## Alternatives considered

- **Only clear Docker volumes or restart services:** rejected; the original
  failure was deterministic request validation.
- **Rely on Tapis to validate arguments:** rejected; it produces a late,
  poorly correlated failure.
- **Treat the entire run as failed when the adapter fails:** rejected; model
  and handoff outputs remain independently valid.

## Test plan

- Verify deferred Ensemble Manager submission contains the same `execution_id`
  in `args` and top-level metadata.
- Verify bound deferred submissions reject missing or mismatched IDs before
  invoking Tapis.
- Verify Tapis submission exceptions are persisted in `error_message` and
  provenance without leaking credentials.
- Verify provider `FAILED` responses without task details get an actionable
  error.
- Run focused TypeScript/Python/UI tests, typecheck, builds, formatting, and
  `git diff --check`.

Implemented checks: Ensemble Manager focused Jest tests (15 passed), SVO
adapter focused container tests (14 passed), UI focused Vitest tests (22
passed), UI typecheck/build, Python syntax compilation, formatting, and
`git diff --check`.

## Documentation plan

The adapter API documentation now describes the deferred submission contract,
stable failure codes, and sanitized terminal diagnostics.

## Rollout/rollback plan

The local SVO adapter and Ensemble Manager images were rebuilt and restarted;
the adapter, Ensemble Manager, and Hasura containers are healthy. No Docker
volumes were removed. Roll back by reverting these code changes and rebuilding
the prior images; existing run rows remain readable.

## Open questions

- Whether the UI should show the full provider message inline or behind
  expanded diagnostic details remains a future presentation decision.

## Decisions

- The root cause was the missing managed `execution_id` on the original
  deferred submission; the successful retry validates the coordinator fix.
- Model and output handoff stages remain visible when the downstream adapter
  fails.
- Do not clear Docker volumes as part of this fix.
- Preserve the existing `error_message` field and bounded provenance payloads;
  no database migration is needed.
- Bound deferred submissions must provide matching IDs in request metadata and
  workflow arguments.
- Existing unrelated DFC live-submit tests still expect broader runtime
  parameter acceptance than their generated plan declares; those failures are
  outside this reliability change and did not gate the focused fix.

## User feedback / decisions

- User approved implementation with “Ok lets do it.”
- Implementation completed and local services rebuilt on 2026-09-27.
