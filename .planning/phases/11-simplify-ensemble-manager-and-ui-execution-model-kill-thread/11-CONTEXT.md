# Phase 11: Simplify ensemble manager and UI execution model — kill thread_model_execution junction - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate the structural fragility behind the bug-010/011/012/014 stuck-spinner family by:

1. Replacing the `thread_model_execution` M:M junction with a direct `thread_model_id` FK on `execution`.
2. Making submission idempotent (deterministic execution.id + INSERT ... ON CONFLICT) so re-submit heals stuck state instead of orphaning it.
3. Dropping the redundant `thread_model_execution_summary` table in favor of a Postgres view of the same name (REST contract preserved, no caller refactor).
4. Adding `submission_time` + `last_submission_status` columns directly on `thread_model` so the UI can disambiguate the three execution states (not-run / submission-failed / waiting) without joining the dropped summary table.
5. Healing pre-existing orphan FAILURE rows during backfill so the docs/debug-tapis-execution.md recovery path becomes unnecessary, then deleting that doc.
6. Deleting the 7 junction-mutating GraphQL files since the table no longer exists.

Out of scope: any new execution feature, retries policy, scheduling, observability tooling beyond what bug-009/010 already added.

</domain>

<decisions>
## Implementation Decisions

### Migration Strategy

- **D-01:** Phased dual-write migration following Phase 9/10 pattern. Three migrations:
  - **M1 (additive + verification):** Pre-flight check `SELECT COUNT(*) FROM thread_model_execution GROUP BY execution_id HAVING COUNT(*) > 1` — abort migration if any row violates 1:N. Then `ALTER TABLE execution ADD COLUMN thread_model_id uuid REFERENCES thread_model(id) ON DELETE CASCADE`. Backfill via UPDATE...FROM JOIN on junction. Heal orphans (D-05). Add `submission_time timestamptz NULL` + `last_submission_status text NULL` columns to `thread_model`. Backfill `submission_time` from `thread_model_execution_summary.submission_time`. Add dual-write triggers: any insert into junction also sets `execution.thread_model_id`; any insert into summary also bumps `thread_model.submission_time`.
  - **M2 (reader migration):** Migrate every reader (ensemble-manager + UI + REST) from junction-join to direct FK. Switch `incrementThreadModelSubmittedRuns` / `incrementFailedRuns` / etc. to no-op writes (counters become derived). Switch `prepareModelExecutions` to deterministic-id + ON CONFLICT.
  - **M3 (drop):** Drop the dual-write triggers, drop `thread_model_execution_summary` table, replace it with a Postgres view of the same name (D-03), drop `thread_model_execution` junction. Delete the 7 junction-mutating .graphql files. Delete `docs/debug-tapis-execution.md`.
- **D-02:** Cardinality verification (1:N) is mandatory in M1 as a hard pre-check, not a runtime assertion. Migration must abort cleanly if violated, with a clear error message naming the violating execution_ids.

### Summary Table Replacement

- **D-03:** Drop `thread_model_execution_summary` table; replace with a Postgres view of the same name. View definition: `SELECT thread_model_id, count(*) AS total_runs, count(*) FILTER (WHERE status='SUCCESS') AS successful_runs, count(*) FILTER (WHERE status='FAILURE') AS failed_runs, count(*) FILTER (WHERE status IN ('WAITING','RUNNING')) AS submitted_runs, ... FROM execution GROUP BY thread_model_id`. Hasura sees identical shape; REST callers (`threadsService.ts:233-235`) unchanged. The fields that don't derive from execution.status (`submission_time`, `submitted_for_execution`, `submitted_for_ingestion`, etc.) move to `thread_model` columns and are joined in the view via `LEFT JOIN thread_model`.
- **D-04:** All increment/decrement mutations (`increment-submitted-runs.graphql`, `increment-failed-runs.graphql`, `increment-successful-runs.graphql`, `subtract-submitted-runs.graphql`, `increment-published-runs.graphql`, `increment-registered-runs.graphql`, `update-execution-summary.graphql`) become no-ops in M2 (kept callable for backwards image compat) and are deleted in a follow-up commit within M3. Counters are now derived; race conditions impossible by construction.

### Orphan Handling

- **D-05:** Heal orphan FAILURE executions during M1 backfill. Orphan = execution row with no matching `thread_model_execution` row. For each orphan, infer `thread_model_id` via:
  ```sql
  UPDATE execution e
     SET thread_model_id = tm.id
    FROM thread_model tm
   WHERE e.thread_model_id IS NULL
     AND tm.modelcatalog_configuration_id = e.modelid
     AND tm.thread_id = (
       SELECT thread_id FROM thread_provenance
        WHERE notes LIKE '%' || e.id || '%' LIMIT 1
     ) -- or via the strongest available thread linkage in the data
  ```
  Researcher MUST validate the join path against actual data before locking the SQL. Acceptance: zero NULL `thread_model_id` after backfill on dev cluster snapshot. If any NULLs remain, decide per-row in M1 (delete vs leave + log).

### Idempotency

- **D-06:** Drop the `uuidv4()` branch in `ExecutionCreation.createExecutionMetadata` (`mint-ensemble-manager/src/classes/common/ExecutionCreation.ts:216`). Always assign `execution.id = getExecutionHash(execution)`. PK becomes the natural conflict key.
- **D-07:** Replace delete+insert in `prepareModelExecutions` with `INSERT ... ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, start_time = EXCLUDED.start_time, run_progress = 0, runid = NULL`. Removes `deleteThreadModelExecutionIds` call entirely. Re-submit heals stuck state instead of orphaning it.
- **D-08:** Researcher must verify `getExecutionHash` is deterministic across the inputs that should collide (same model + same bindings = same id) and that current usages assuming uuid PK opacity still work (no PK leakage to UI as a "submission identity"). The Tapis `runid` (returned post-submit) remains the external job identifier — the hash is internal.

### UI State Machine

- **D-09:** Add `submission_time timestamptz NULL` and `last_submission_status text NULL` columns to `thread_model`. Set on every `prepareModelExecutions` call (success and failure paths). Three-state derivation lives in the UI:
  - `thread_model.submission_time IS NULL` → "Not run yet"
  - `submission_time IS NOT NULL` AND `executions.length === 0` → "Submission failed" (red banner, retry button)
  - `executions.length > 0` AND any `status IN ('WAITING') → "Downloading…" spinner
  - `executions.length > 0` AND all terminal → render results table normally
- **D-10:** Drop the spinner fallback in `ui/src/screens/modeling/thread/mint-runs.ts:538` ("Downloading software image and data..."). Replace with explicit state machine driven by the four conditions in D-09. The UI never shows a spinner just because executions array is empty.
- **D-11:** Rewrite `ui/src/queries/execution/executions-for-thread-model.graphql` to query `execution(where: { thread_model_id: { _eq: $threadModelId } })` directly. Drop the `thread_model_executions { thread_model_id { _eq: ... } }` join. Apply same change to all UI queries that traverse the junction (~6 queries — researcher to enumerate).

### Cleanup Scope

- **D-12:** Delete dead mutation files in M3:
  - `delete-thread-model-executions.graphql`
  - `new-thread-model-executions.graphql`
  - `handle-failed-connection-ensemble.graphql` (junction-deletion clause, not the whole mutation — keep the FAILURE-marking part)
  - The 5 increment/decrement summary mutations (per D-04)
- **D-13:** Delete `docs/debug-tapis-execution.md` in M3. Recovery is no longer possible because the failure mode it addressed (orphaned execution rows) is structurally impossible after the FK migration. If anyone needs general "how to debug a stuck execution" docs later, write them fresh.
- **D-14:** Junction-mutating files in `thread/` (`update-models.graphql`, `update-parameters.graphql`, `set-dataslice-resources.graphql`, etc.) keep their thread-update logic but lose any `thread_model_execution`-related clauses (replaced by ON DELETE CASCADE on the FK).

### Execution Hash Migration Risk

- **D-15:** Switching `execution.id` to deterministic hash means existing rows (with uuid PKs) coexist with new rows (with hash PKs). No back-migration of existing IDs — they remain valid PKs. Researcher must confirm no foreign-key-from-elsewhere expects uuid format (e.g., Tapis runid mapping in `execution.runid` is decoupled — runid is Tapis-side).

### Claude's Discretion

- Exact SQL syntax for migrations, indices needed, NOT NULL constraint timing
- Specific Hasura metadata YAML edits (object_relationship from execution to thread_model)
- TypeScript adapter updates (`executionToGQL`, `executionFromGQL`) — follow Phase 10 patterns
- Test rewrites for changed adapters and queries
- Codegen + commit `types.ts`
- Whether the M3 view definition needs additional fields beyond the listed counters (audit existing summary table columns and replicate)
- Commit ordering and PR boundaries within each migration phase

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Project

- `.planning/ROADMAP.md` § "Phase 11" — full phase scope and proposed simplifications
- `.planning/PROJECT.md` — DYNAMO v2.0 migration context

### Bug Family (the problem this phase solves)

- `.wolf/buglog.json` — bug-010 (Tapis subscribe error decoding), bug-011 (junction wiped on submission failure), bug-012 (Tapis webhook URL config), bug-014 (orphan FAILURE rows resist re-submit recovery)
- `docs/debug-tapis-execution.md` — junction-deleting mutation audit, recovery procedures (Option A/B), triage flowchart. **To be deleted in M3.**

### Phase 10 (precedent for migration approach)

- `.planning/phases/10-check-the-required-changes-on-mint-ensemble-manager-after-migration/10-CONTEXT.md` — execution.modelid → modelcatalog_configuration_id migration, three-step migration pattern (SQL + metadata + backfill)

### Phase 9 (precedent for FK + dual-write)

- `.planning/phases/09-merge-modelconfiguration-setup-tables-and-migrate-thread-model-relationships/09-CONTEXT.md` — thread_model FK migration

### Hasura Schema & Metadata

- `graphql_engine/migrations/1771200012000_thread_model_migration` — Phase 9 migration template
- `graphql_engine/migrations/1771200013000_drop_execution_model_id` — Phase 10 column drop pattern
- `graphql_engine/migrations/1771200014000_execution_data_binding_fk` — FK constraint addition pattern
- `graphql_engine/metadata/tables.yaml` § line 280 (thread_model_executions), § line 1699 + § line 1936 (thread_model_execution_summary)

### Ensemble Manager — Junction-Deleting Mutations (audit list, all to be removed/cleaned)

- `mint-ensemble-manager/src/classes/graphql/queries/execution/handle-failed-connection-ensemble.graphql` — clean junction-delete clause
- `mint-ensemble-manager/src/classes/graphql/queries/execution/new.graphql` — junction insert (per-batch)
- `mint-ensemble-manager/src/classes/graphql/queries/execution/delete.graphql` — explicit user delete
- `mint-ensemble-manager/src/classes/graphql/queries/execution/delete-thread-model-executions.graphql` — DELETE
- `mint-ensemble-manager/src/classes/graphql/queries/model/delete.graphql` — cascade on config delete
- `mint-ensemble-manager/src/classes/graphql/queries/thread/set-dataslice-resources.graphql` — UI rewrites thread inputs
- `mint-ensemble-manager/src/classes/graphql/queries/thread/update-datasets.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/thread/update-datasets-and-parameters.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/thread/update.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/thread/update-models.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/thread/update-parameters.graphql`

### Ensemble Manager — Summary Mutations (become no-ops in M2, deleted in M3)

- `mint-ensemble-manager/src/classes/graphql/queries/execution/increment-submitted-runs.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/execution/increment-failed-runs.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/execution/increment-successful-runs.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/execution/increment-registered-runs.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/execution/increment-registered-runs-by-execution-id.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/execution/increment-published-runs.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/execution/subtract-submitted-runs.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/execution/update-execution-summary.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/execution/toggle-summary-publishing.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/executionSummary/new.graphql`
- `mint-ensemble-manager/src/classes/graphql/queries/fragments/execution-summary-info.graphql`

### Ensemble Manager — Application Code

- `mint-ensemble-manager/src/classes/common/ExecutionCreation.ts` § `prepareModelExecutions` (line 81), `createExecutions` (line 106), `createExecutionMetadata` (line 198, line 216 uuidv4 branch), `createThreadModelExecutionSummary` (line 157)
- `mint-ensemble-manager/src/classes/graphql/graphql_functions.ts` — `setThreadModelExecutionIds`, `deleteThreadModelExecutionIds`, `incrementThreadModelSubmittedRuns`, `insertThreadModelExecutionSummary`, etc.
- `mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts` — `executionToGQL`, `executionFromGQL` (need thread_model_id field added)
- `mint-ensemble-manager/src/classes/graphql/queries/fragments/execution-info.graphql` — fragment must include `thread_model_id`
- `mint-ensemble-manager/src/api/api-v1/services/threadsService.ts` § lines 231-236 — REST shape returning `submitted_runs/failed_runs/successful_runs` (must remain valid via the view)

### UI

- `ui/src/screens/modeling/thread/mint-runs.ts` § line 538 (spinner fallback to remove), § line 376-378 (loading rendering), § line 88-97 (state derivation)
- `ui/src/queries/execution/executions-for-thread-model.graphql` — junction join to remove
- `ui/src/queries/emulator/model-executions.graphql`
- `ui/src/queries/emulator/thread-executions.graphql`
- `ui/src/screens/emulators/actions.ts` — junction-using TS code
- `ui/src/screens/modeling/actions.ts` — junction-using TS code

### Tapis Integration (context only — not changing)

- `mint-ensemble-manager/src/classes/tapis/adapters/TapisExecutionService.ts` — `submitSingleExecution`, `updateExecutionRunId`
- `mint-ensemble-manager/src/classes/tapis/adapters/TapisJobSubscriptionService.ts` — webhook URL generation (bug-012 fix)

### Test Files (must update)

- Any `*.test.ts` in mint-ensemble-manager that mocks `setThreadModelExecutionIds`, `deleteThreadModelExecutionIds`, `insertThreadModelExecutionSummary`, or any increment/decrement summary mutation
- `mint-ensemble-manager/src/classes/tapis/adapters/TapisJobSubscriptionService.test.ts` — keep, no junction touches

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `getExecutionHash(execution)` (`ExecutionCreation.ts:214`) — deterministic hash function already implemented; currently used only when `reuseExistingExecutions=true`. D-06 makes this the default.
- Phase 9/10 migration templates (`graphql_engine/migrations/1771200012000_*` and `1771200013000_*`) — phased dual-write + backfill pattern, three-migration split (SQL/metadata/data).
- `aa15d063` commit (already shipped) — `handle_failed_connection_ensemble` no longer deletes junction. Partial fix; D-12 finishes it.
- `executionToGQL` / `executionFromGQL` adapters in `graphql_adapter.ts` — Phase 10 left them clean; just add `thread_model_id` field.
- Postgres `count(*) FILTER (WHERE ...)` aggregate is exactly the shape needed for the M3 view (matches existing `successful_runs`, `failed_runs`, `submitted_runs` semantics).

### Established Patterns

- Phase 9/10 split: SQL migration first (DDL + backfill), then metadata migration (object_relationships + permissions), then codegen + adapter updates.
- Backfill via `UPDATE ... FROM JOIN` mapping old IDs through intermediate tables.
- ON CONFLICT DO UPDATE pattern not yet used in this codebase but standard Postgres + Hasura.
- Hasura computed fields and views are already used elsewhere in this metadata file (researcher to confirm exact pattern for replacing a table with a view of the same name in Hasura metadata — may need `is_enum: false` and explicit `select_permissions` re-declaration).

### Integration Points

- `prepareModelExecutions` is called from local executor + Tapis executor + REST `executionsLocal` endpoint — single point of change.
- REST endpoint `threadsService.ts` returns `ExecutionSummary` shape — view-backed equivalent must produce same JSON.
- Hasura metadata `tables.yaml:1699` has `array_relationship` referencing summary table; `tables.yaml:1936` is the table definition itself with permissions. Both move to view.
- The `thread_provenance` table (referenced in bug-014 root-cause analysis and `docs/debug-tapis-execution.md` Q5) stays — it's the audit log, not the state.

### Known Hazards

- Switching execution.id to hash means a re-submit of the SAME bindings produces the SAME id. ON CONFLICT will overwrite the prior row's `status`, `start_time`, `runid`. This is the desired behavior (heals stuck state) but means failure history for that exact binding combination is overwritten, not appended. Confirm this matches user intent in plan-phase if not already implied by D-07.
- 380 grep hits for summary/junction in mint-ensemble-manager. Plan must enumerate every reader exhaustively in M2; missing one leaves dual-write triggers as the only thing keeping the view backed correctly until M3.
- bug-014 stuck threads in dev/staging: D-05 healing must run on real data before locking M1.

</code_context>

<specifics>
## Specific Ideas

- Use Phase 9/10 migration template as the structural starting point.
- Mirror the cluster-side helper script in `docs/debug-tapis-execution.md` ("Querying Hasura from inside the cluster") for the M1 cardinality verification — researcher can wrap the pre-flight check as a kubectl-runnable script for dev cluster validation.
- The view name MUST be `thread_model_execution_summary` exactly (not `_v` suffix) so REST and Hasura GraphQL contracts stay byte-identical.
- Keep `thread_model.submission_time` as `timestamptz` to match existing `submission_time` column type in the dropped summary table.

</specifics>

<deferred>
## Deferred Ideas

- General "how to debug a stuck execution" reference doc to replace `docs/debug-tapis-execution.md` — only if it turns out users need it after the structural fix lands. Likely not needed; raise a separate phase if it does.
- Retries/backoff policy on submission failure — separate concern, not part of this structural fix.
- Migrating `execution.runid` (Tapis UUID) to a more typed column — out of scope.
- Cleaning up the `thread_provenance` log schema — it stays as the audit trail.

</deferred>

---

_Phase: 11-simplify-ensemble-manager-and-ui-execution-model-kill-thread_
_Context gathered: 2026-04-26_
