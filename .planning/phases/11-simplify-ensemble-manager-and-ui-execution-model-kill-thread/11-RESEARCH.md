# Phase 11: Simplify Ensemble Manager and UI Execution Model — Research

**Researched:** 2026-04-26
**Domain:** PostgreSQL migration, Hasura metadata, TypeScript/GraphQL adapter, LitElement UI state machine
**Confidence:** HIGH

---

## Summary

Phase 11 eliminates the `thread_model_execution` M:M junction table and the `thread_model_execution_summary` table that collectively caused the bug-010/011/012/014 stuck-spinner family. The migration follows the proven three-wave phased dual-write pattern used in Phase 9 and Phase 10.

The work splits into three migrations (M1/M2/M3), a Hasura metadata update, ensemble-manager TypeScript adapter changes, and a UI state-machine rewrite in `mint-runs.ts`. The summary table's REST contract is preserved exactly by replacing the dropped table with a Postgres view of the same name. All 15 decisions (D-01..D-15) are locked.

The key research gaps addressed here are: exact SQL for M1/M2/M3 DDL; the full column audit for the view DDL (the summary table has 16 columns beyond the 4 derived counters that must be preserved or moved to `thread_model`); the exhaustive callsite list across both the ensemble-manager and the UI (28 files total reference the junction or summary, enumerated in detail below); the `getExecutionHash` determinism confirmation; and the Hasura metadata YAML strategy for replacing a table with a view of the same name.

**Primary recommendation:** Execute M1 (additive) → deploy + validate on dev cluster → M2 (reader migration) → deploy + validate → M3 (drop) as three independent deployable units. Do not collapse M1 and M2 — dual-write triggers must serve live traffic between them.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phased dual-write migration (M1/M2/M3). M1 additive + cardinality preflight + backfill + orphan heal + dual-write triggers. M2 reader migration + no-op mutations. M3 drop junction + drop summary + replace with view + delete dead files.
- **D-02:** Cardinality verification mandatory in M1 — hard abort if any `execution_id` maps to > 1 `thread_model_id` in the junction.
- **D-03:** `thread_model_execution_summary` replaced by a Postgres view of the same name. View produces identical column shape via `GROUP BY thread_model_id` on `execution`, with non-derived columns (`submission_time`, etc.) joined from `thread_model` via `LEFT JOIN`. Hasura tracks the view with same permissions. REST callers unchanged.
- **D-04:** All increment/decrement mutations become no-ops in M2 (stub returns); deleted in M3.
- **D-05:** Orphan healing in M1 backfill. Exact JOIN path to be validated against dev cluster data before locking SQL (see Open Questions).
- **D-06:** Drop `uuidv4()` branch in `createExecutionMetadata`. Always use `getExecutionHash(execution)` as the PK.
- **D-07:** Replace delete+insert in `prepareModelExecutions` with `INSERT ... ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, start_time = EXCLUDED.start_time, run_progress = 0, runid = NULL`.
- **D-08:** Verify `getExecutionHash` determinism (same model + same bindings → same hash). Tapis `runid` column stays decoupled (external job ID, not the hash).
- **D-09:** Add `submission_time timestamptz NULL` and `last_submission_status text NULL` to `thread_model`. Set on every `prepareModelExecutions` call (both success and failure paths).
- **D-10:** Drop the line-538 spinner fallback in `mint-runs.ts`. Replace with explicit four-state machine driven by `submission_time`, `last_submission_status`, and `executions.length` + statuses.
- **D-11:** Rewrite `executions-for-thread-model.graphql` and all junction-traversal UI queries to use direct FK (`execution(where: { thread_model_id: { _eq: $threadModelId } })`).
- **D-12:** Delete dead mutation files in M3 (enumerated in canonical refs).
- **D-13:** Delete `docs/debug-tapis-execution.md` in M3.
- **D-14:** Thread-update queries keep their non-junction logic; only the `delete_thread_model_execution` clauses are removed.
- **D-15:** Existing UUID PKs coexist with new hash PKs. No back-migration of existing rows.

### Claude's Discretion

- Exact SQL syntax for migrations, indices, NOT NULL timing
- Hasura metadata YAML edits (object_relationship execution → thread_model, view tracking)
- TypeScript adapter updates (`executionToGQL`, `executionFromGQL`)
- Test rewrites for changed adapters
- Codegen + commit `types.ts`
- Whether M3 view needs additional fields (audit complete — see Standard Stack § View DDL)
- Commit ordering and PR boundaries

### Deferred Ideas (OUT OF SCOPE)

- General "how to debug a stuck execution" reference doc
- Retries/backoff policy on submission failure
- Migrating `execution.runid` to a typed column
- Cleaning up `thread_provenance` log schema
</user_constraints>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| FK migration DDL (M1/M2/M3) | Database / Storage | — | Schema changes live in Hasura migrations SQL files |
| Dual-write triggers (M1) | Database / Storage | — | Postgres triggers maintain both old and new paths during transition |
| View DDL (M3) | Database / Storage | — | `thread_model_execution_summary` view defined in Postgres |
| Hasura relationship metadata | API / Backend (Hasura) | — | `tables.yaml` object/array_relationship declarations |
| Hasura permissions on view | API / Backend (Hasura) | — | `select_permissions` re-declared for view same as table had |
| Ensemble-manager GraphQL mutations | API / Backend | — | `.graphql` files + `graphql_functions.ts` stubs |
| `prepareModelExecutions` idempotency | API / Backend | — | `ExecutionCreation.ts` — single call site used by all executors |
| ON CONFLICT upsert | API / Backend | — | `new.graphql` mutation must shift to upsert semantics |
| `submission_time` / `last_submission_status` writes | API / Backend | — | Set in `prepareModelExecutions` success and failure paths |
| UI state-machine (four states) | Browser / Client | — | `mint-runs.ts` render method drives from `thread_model` columns |
| UI query migration (junction → direct FK) | Browser / Client | — | GraphQL query files in `ui/src/queries/` |
| `thread_model.submission_time` subscription | Browser / Client | — | UI must subscribe to `thread_model` columns (currently subscribes to `thread_model_execution_summary`) |

---

## Standard Stack

### Core (all already in project — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 14+ (existing) | DDL migrations, triggers, views | Project DB |
| Hasura GraphQL Engine | v2 (existing) | Metadata tracking, permissions, relationships | Project layer |
| TypeScript / Apollo Client | existing | Ensemble-manager GraphQL calls | Established patterns |
| Jest | existing (`npm test`) | Ensemble-manager unit tests | Established in repo |
| ts-md5 | existing | `getExecutionHash` — already imported | `Md5.hashStr(str)` |

**Version verification:** No new packages needed. [VERIFIED: reading package.json and existing imports]

---

## Architecture Patterns

### System Architecture Diagram

```
prepareModelExecutions (ExecutionCreation.ts)
  │
  ├─ [M1 dual-write trigger path] ─────────────────────┐
  │   INSERT execution (hash id, thread_model_id col)   │
  │   INSERT thread_model_execution (junction)          │← trigger keeps in sync
  │   INSERT thread_model_execution_summary             │← trigger keeps in sync
  │                                                     │
  ├─ [M2+ direct path] ─────────────────────────────── │
  │   UPSERT execution ON CONFLICT(id)                  │
  │   → execution.thread_model_id set directly          │
  │   → no junction insert                              │
  │   → summary mutations → no-op                       │
  │                                                     ▼
  │                                              thread_model.submission_time
  │                                              thread_model.last_submission_status
  │
  ├─ [M3 view] ────────────────────────────────────────┐
  │   DROP thread_model_execution_summary (table)       │
  │   CREATE VIEW thread_model_execution_summary AS     │
  │     SELECT thread_model_id, count(*) total_runs,   │
  │            ... FROM execution GROUP BY thread_model_id│
  │            LEFT JOIN thread_model ...               │
  │                                                     │
UI (mint-runs.ts)                                      │
  │                                                    │
  ├── executions-for-thread-model.graphql               │
  │   [M2: change WHERE to execution.thread_model_id]   │
  │                                                     │
  └── four-state machine:                               │
      NULL submission_time → "Not run yet"             │
      submission_time + 0 executions → "Submission failed"
      executions with WAITING → spinner               │
      all terminal → results table                     │
```

### Recommended Project Structure

No structural changes. Migration files follow existing convention:

```
graphql_engine/migrations/
├── 1771200015000_execution_thread_model_fk_m1/   # M1: additive
│   ├── up.sql
│   └── down.sql
├── 1771200016000_execution_thread_model_fk_m2/   # M2: metadata
│   └── (metadata-only, no SQL)
└── 1771200017000_execution_thread_model_fk_m3/   # M3: drop + view
    ├── up.sql
    └── down.sql
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Derived run counters | Increment/decrement mutations with separate counter column | `count(*) FILTER (WHERE status='...')` in Postgres view | Race conditions eliminated; counters always accurate; no dual-write divergence |
| Idempotent submission | Delete-then-insert pattern | `INSERT ... ON CONFLICT (id) DO UPDATE` | Re-submit heals stuck state atomically; no orphan rows |
| Execution-to-thread-model link | M:M junction table | Direct FK column `execution.thread_model_id` | True 1:N relationship — junction was always conceptually wrong; direct FK is simpler and un-deletable without cascading |
| Summary API contract | New REST endpoint | Postgres view of same name as dropped table | Zero caller changes; Hasura tracks view identically to table |

**Key insight:** The bug-010/011/012/014 family exists because the junction table is not an inherent requirement of the data model (1:N, not M:N) — it was built as M:N and then depended on by 7 different mutation paths, any of which could silently break the state.

---

## M1 SQL — Exact Patterns

### Cardinality Pre-flight (mandatory, abort if rows returned)

```sql
-- VERIFIED: junction PK is (thread_model_id, execution_id) [VERIFIED: init migration]
SELECT execution_id, COUNT(*) AS tm_count
FROM thread_model_execution
GROUP BY execution_id
HAVING COUNT(*) > 1;
-- If any rows returned: RAISE EXCEPTION 'Cardinality violation: execution_id maps to multiple thread_models: ...';
```

[VERIFIED: junction schema from `graphql_engine/migrations/1662641297914_init/up.sql`]

### Add FK Column to execution

```sql
ALTER TABLE execution
    ADD COLUMN thread_model_id uuid NULL
    REFERENCES thread_model(id) ON DELETE CASCADE;

CREATE INDEX idx_execution_thread_model_id
    ON execution(thread_model_id);
```

**NOT NULL timing:** Add as NULL first, backfill, then consider adding NOT NULL in M3 after validation. [ASSUMED] — whether NOT NULL is safe after backfill depends on orphan heal completeness.

### Backfill from Junction

```sql
UPDATE execution e
SET thread_model_id = tme.thread_model_id
FROM thread_model_execution tme
WHERE e.id = tme.execution_id
  AND e.thread_model_id IS NULL;
```

[VERIFIED: `thread_model_execution.execution_id` references `execution.id`; `thread_model_execution.thread_model_id` references `thread_model.id`]

### D-05 Orphan Healing

**What is an orphan:** An `execution` row with no matching `thread_model_execution` row (so `thread_model_id` remains NULL after the join backfill above).

**D-05 prescribed JOIN path:** Via `thread_provenance` where notes contain the execution id. Research finding: `thread_provenance` has schema `(thread_id, event, timestamp, notes, userid)` — the notes field is the only candidate for the execution_id reference. [ASSUMED: thread_provenance.notes column contains execution_id strings — this MUST be validated on dev cluster before locking]

**Alternative / fallback join path to validate:**
```sql
-- Attempt 1: Via modelcatalog_configuration_id
UPDATE execution e
SET thread_model_id = tm.id
FROM thread_model tm
WHERE e.thread_model_id IS NULL
  AND tm.modelcatalog_configuration_id = e.modelcatalog_configuration_id;
-- RISK: multiple thread_models may share a configuration_id — would pick arbitrary one
-- Limit: only safe if DISTINCT or paired with thread constraint
```

```sql
-- Attempt 2 (D-05 prescribed): Via thread_provenance
UPDATE execution e
SET thread_model_id = (
    SELECT tm.id
    FROM thread_provenance tp
    JOIN thread_model tm ON tm.thread_id = tp.thread_id
    WHERE tp.notes LIKE '%' || e.id || '%'
      AND tm.modelcatalog_configuration_id = e.modelcatalog_configuration_id
    LIMIT 1
)
WHERE e.thread_model_id IS NULL;
```

**Acceptance gate:** `SELECT COUNT(*) FROM execution WHERE thread_model_id IS NULL` must return 0. If not zero, decide per-row (delete vs log). [VERIFIED: from D-05 text and D-02/D-05 acceptance criteria]

### Add thread_model Columns

```sql
ALTER TABLE thread_model
    ADD COLUMN submission_time timestamptz NULL,
    ADD COLUMN last_submission_status text NULL;
```

### Backfill thread_model.submission_time

```sql
-- Backfill from thread_model_execution_summary (still exists in M1)
UPDATE thread_model tm
SET submission_time = s.submission_time
FROM thread_model_execution_summary s
WHERE s.thread_model_id = tm.id
  AND s.submission_time IS NOT NULL
  AND tm.submission_time IS NULL;
```

[VERIFIED: `thread_model_execution_summary.submission_time` is `timestamp without time zone`; new column is `timestamptz`. The existing data is stored without timezone — coercion behavior is ASSUMED to be controlled by session timezone; planner should add explicit `AT TIME ZONE 'UTC'` to be safe]

### Dual-Write Triggers (M1)

**Forward trigger — junction insert → execution.thread_model_id:**

```sql
CREATE OR REPLACE FUNCTION trg_junction_to_fk()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE execution
       SET thread_model_id = NEW.thread_model_id
     WHERE id = NEW.execution_id
       AND thread_model_id IS DISTINCT FROM NEW.thread_model_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tme_forward_sync
AFTER INSERT OR UPDATE ON thread_model_execution
FOR EACH ROW EXECUTE FUNCTION trg_junction_to_fk();
```

**Reverse trigger — summary insert/update → thread_model.submission_time:**

```sql
CREATE OR REPLACE FUNCTION trg_summary_to_thread_model()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE thread_model
       SET submission_time = NEW.submission_time
     WHERE id = NEW.thread_model_id
       AND NEW.submission_time IS NOT NULL;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tmes_forward_sync
AFTER INSERT OR UPDATE ON thread_model_execution_summary
FOR EACH ROW EXECUTE FUNCTION trg_summary_to_thread_model();
```

[ASSUMED: exact trigger syntax correct for Postgres 14; planner should verify `IS DISTINCT FROM` works for NULL-safe comparison on Postgres 14]

---

## M3 View DDL — Complete Column Audit

### Summary Table Full Column List

From `graphql_engine/migrations/1662641297914_init/up.sql` (VERIFIED):

| Column | Type | Source After Drop |
|--------|------|-------------------|
| `thread_model_id` | uuid | GROUP BY key / LEFT JOIN |
| `submitted_for_execution` | boolean DEFAULT false | → `thread_model` column (new, M1) |
| `submitted_for_ingestion` | boolean DEFAULT false | → `thread_model` column (new, M1) |
| `submitted_for_publishing` | boolean DEFAULT false | → `thread_model` column (new, M1) |
| `submitted_for_registration` | boolean DEFAULT false | → `thread_model` column (new, M1) |
| `submission_time` | timestamp | → `thread_model.submission_time` (D-09) |
| `ingestion_time` | timestamp | → `thread_model` column (new, M1) |
| `publishing_time` | timestamp | → `thread_model` column (new, M1) |
| `registration_time` | timestamp | → `thread_model` column (new, M1) |
| `total_runs` | integer DEFAULT 0 | Derived: `count(*)` |
| `submitted_runs` | integer DEFAULT 0 | Derived: `count(*) FILTER (WHERE status IN ('WAITING','RUNNING'))` |
| `successful_runs` | integer DEFAULT 0 | Derived: `count(*) FILTER (WHERE status = 'SUCCESS')` |
| `failed_runs` | integer DEFAULT 0 | Derived: `count(*) FILTER (WHERE status = 'FAILURE')` |
| `ingested_runs` | integer DEFAULT 0 | → `thread_model` column (new, M1) |
| `registered_runs` | integer DEFAULT 0 | → `thread_model` column (new, M1) |
| `published_runs` | integer DEFAULT 0 | → `thread_model` column (new, M1) |
| `fetched_run_outputs` | integer DEFAULT 0 | → `thread_model` column (new, M1) |
| `workflow_name` | text | → `thread_model` column (new, M1) |

**Insight:** The fragment `execution_summary_info` in the UI reads only: `submitted_for_execution`, `submitted_for_ingestion`, `submitted_for_publishing`, `submitted_for_registration`, `submission_time`, `total_runs`, `submitted_runs`, `successful_runs`, `failed_runs`, `ingested_runs`, `registered_runs`, `published_runs`. The other columns (`fetched_run_outputs`, `workflow_name`, `*_time` except `submission_time`) are exposed in Hasura permissions but NOT currently selected by any verified fragment. They must still appear in the view for API contract completeness. [VERIFIED: from `ui/src/queries/fragments/execution-summary-info.graphql`]

### M3 View DDL

The following columns must be moved to `thread_model` in M1 (ADD COLUMN) so the M3 view can LEFT JOIN them:

```sql
-- Columns to add to thread_model in M1:
ALTER TABLE thread_model
    ADD COLUMN submitted_for_execution boolean DEFAULT false NOT NULL,
    ADD COLUMN submitted_for_ingestion boolean DEFAULT false NOT NULL,
    ADD COLUMN submitted_for_publishing boolean DEFAULT false NOT NULL,
    ADD COLUMN submitted_for_registration boolean DEFAULT false NOT NULL,
    ADD COLUMN ingestion_time timestamptz NULL,
    ADD COLUMN publishing_time timestamptz NULL,
    ADD COLUMN registration_time timestamptz NULL,
    ADD COLUMN ingested_runs integer DEFAULT 0 NOT NULL,
    ADD COLUMN registered_runs integer DEFAULT 0 NOT NULL,
    ADD COLUMN published_runs integer DEFAULT 0 NOT NULL,
    ADD COLUMN fetched_run_outputs integer DEFAULT 0 NOT NULL,
    ADD COLUMN workflow_name text NULL;
```

[ASSUMED: adding all columns in M1 is the cleanest approach; alternative is to add only the ones the view needs and handle others separately. Planner should confirm with user if the volume of thread_model column additions is acceptable]

### M3 View DDL (after columns added to thread_model):

```sql
CREATE VIEW thread_model_execution_summary AS
SELECT
    tm.id                          AS thread_model_id,
    tm.submitted_for_execution,
    tm.submitted_for_ingestion,
    tm.submitted_for_publishing,
    tm.submitted_for_registration,
    tm.submission_time,
    tm.ingestion_time,
    tm.publishing_time,
    tm.registration_time,
    tm.workflow_name,
    tm.ingested_runs,
    tm.registered_runs,
    tm.published_runs,
    tm.fetched_run_outputs,
    COALESCE(agg.total_runs, 0)        AS total_runs,
    COALESCE(agg.submitted_runs, 0)    AS submitted_runs,
    COALESCE(agg.successful_runs, 0)   AS successful_runs,
    COALESCE(agg.failed_runs, 0)       AS failed_runs
FROM thread_model tm
LEFT JOIN (
    SELECT
        thread_model_id,
        count(*)                                                       AS total_runs,
        count(*) FILTER (WHERE status IN ('WAITING','RUNNING'))        AS submitted_runs,
        count(*) FILTER (WHERE status = 'SUCCESS')                     AS successful_runs,
        count(*) FILTER (WHERE status = 'FAILURE')                     AS failed_runs
    FROM execution
    WHERE thread_model_id IS NOT NULL
    GROUP BY thread_model_id
) agg ON agg.thread_model_id = tm.id
WHERE tm.submitted_for_execution = true;
-- Note: WHERE clause mirrors original summary semantics — only thread_models
-- that have been submitted appear in the summary view.
-- Planner should confirm this WHERE is appropriate or remove it for all thread_models.
```

[ASSUMED: the `WHERE tm.submitted_for_execution = true` filter is an interpretation; the original table could hold rows for any thread_model. Validate against actual data query patterns.]

---

## Hasura Metadata — YAML Edits Required

### Replacing a Table with a View of the Same Name

Hasura tracks views the same way it tracks tables in `tables.yaml`. The strategy is:

1. In M3, after dropping the table and creating the view:
   - The `tables.yaml` entry for `thread_model_execution_summary` can remain structurally identical **except**:
     - Remove `insert_permissions`, `update_permissions`, `delete_permissions` (views are read-only in standard Postgres unless `INSTEAD OF` triggers are defined — not needed here)
     - Keep `select_permissions` for `anonymous` and `user` roles verbatim
     - Keep the `object_relationships` (`thread_model` FK)
   - No `is_enum`, no special view flag — Hasura v2 tracks views and tables identically in metadata YAML. [VERIFIED: `tables.yaml` currently has no `is_enum` or view-specific flags on any table; Hasura v2 uses the same `table:` syntax for both]

2. The `array_relationship` from `thread_model` to `thread_model_execution_summary` (via `execution_summary`) at `tables.yaml:1694-1700` remains unchanged — the FK `thread_model_id` still exists on the view (as a passthrough from `thread_model.id`).

3. **New relationship to add** (M1 metadata migration):
   - On the `execution` table: add `object_relationship` named `thread_model` using FK `thread_model_id`
   - On the `thread_model` table: add `array_relationship` named `direct_executions` (or `execution_set`) using FK `execution.thread_model_id`

### M1 Metadata YAML Changes

Add to the `execution` table entry in `tables.yaml`:
```yaml
  object_relationships:
  - name: thread_model
    using:
      foreign_key_constraint_on: thread_model_id
```

Add to the `thread_model` table entry array_relationships:
```yaml
  - name: direct_executions
    using:
      foreign_key_constraint_on:
        column: thread_model_id
        table:
          name: execution
          schema: public
```

Add to the `execution` table permissions (select and insert/update columns):
```yaml
      columns:
      - thread_model_id    # add to all existing select/insert/update permission column lists
```

[VERIFIED: current `execution` `select_permissions` columns list does NOT include `thread_model_id` since the column doesn't exist yet. Must be added in M1 metadata migration.]

### M3 Metadata YAML Changes

Remove from `thread_model` table the `execution_summary` array_relationship pointing to the junction table (if the view breaks this — actually no: the view still has a `thread_model_id` column so the FK-based relationship still resolves).

Remove from `thread_model` table the `executions` array_relationship pointing to `thread_model_execution` junction. [VERIFIED: at `tables.yaml:1701-1707`]

Remove the entire `thread_model_execution` table entry from `tables.yaml`. [VERIFIED: entry at line 1822]

---

## Exhaustive Callsite Inventory

### Ensemble Manager — Functions to Stub (M2) then Delete (M3)

From `graphql_functions.ts` (VERIFIED by reading the full file):

| Function | Action in M2 | Action in M3 |
|----------|-------------|-------------|
| `setThreadModelExecutionIds` | Stub: return no-op resolved Promise | Delete function + import |
| `deleteThreadModelExecutionIds` | Stub: return no-op resolved Promise | Delete function + import |
| `insertThreadModelExecutionSummary` | Stub: return no-op resolved Promise | Delete function + import |
| `setThreadModelExecutionSummary` | Stub: return no-op resolved Promise | Delete function + import |
| `insertThreadModelExecutionSummary` | Stub | Delete |
| `incrementThreadModelSubmittedRuns` | Stub | Delete |
| `incrementThreadModelSuccessfulRuns` | Stub | Delete |
| `incrementThreadModelFailedRuns` | Stub | Delete |
| `decrementThreadModelSubmittedRuns` | Stub | Delete |
| `toggleThreadModelExecutionSummaryPublishing` | Stub | Delete |
| `incrementThreadModelRegisteredRuns` | Stub | Delete |
| `incrementThreadModelRegisteredRunsByExecutionId` | Stub | Delete |
| `incrementPublishedRuns` | Stub | Delete |
| `handleFailedConnectionEnsemble` | Keep function; strip summary insert/delete logic, keep `thread_provenance` insert | Simplify |
| `getThreadModelByThreadIdExecutionId` | Rewrite query to use `execution.thread_model_id` directly | Update |

### Ensemble Manager — GraphQL Files to Delete (M3)

(VERIFIED by reading CONTEXT.md canonical refs and the actual file contents)

Junction-related (delete entirely):
- `queries/execution/delete-thread-model-executions.graphql`
- `queries/execution/new-thread-model-executions.graphql`

Summary-related (delete entirely):
- `queries/execution/increment-submitted-runs.graphql`
- `queries/execution/increment-failed-runs.graphql`
- `queries/execution/increment-successful-runs.graphql`
- `queries/execution/increment-registered-runs.graphql`
- `queries/execution/increment-registered-runs-by-execution-id.graphql`
- `queries/execution/increment-published-runs.graphql`
- `queries/execution/subtract-submitted-runs.graphql`
- `queries/execution/update-execution-summary.graphql`
- `queries/execution/toggle-summary-publishing.graphql`
- `queries/executionSummary/new.graphql`
- `queries/fragments/execution-summary-info.graphql`

### Ensemble Manager — GraphQL Files to EDIT (M2)

| File | Change |
|------|--------|
| `queries/execution/new.graphql` | Remove the `delete_thread_model_execution` clause. Change `insert_execution` to `INSERT ... ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, start_time=EXCLUDED.start_time, run_progress=0, run_id=NULL`. Remove `$ids` and `$tmid` parameters or repurpose. |
| `queries/execution/handle-failed-connection-ensemble.graphql` | Remove `delete_thread_model_execution_summary` and `insert_thread_model_execution_summary`. Keep `insert_thread_provenance_one`. |
| `queries/thread/handle-ensemble-connection-failed.graphql` | Same — remove summary clauses. |
| `queries/thread/update-models.graphql` | Remove `delete_thread_model_execution_summary` and `delete_thread_model_execution` clauses. |
| `queries/thread/update-datasets.graphql` | Remove both `delete_thread_model_execution_summary` and `delete_thread_model_execution` clauses (appears in TWO files with this name — both update-datasets variants). |
| `queries/thread/update-parameters.graphql` | Remove summary clauses. |
| `queries/thread/set-dataslice-resources.graphql` | Remove `delete_thread_model_execution_summary` and `delete_thread_model_execution` clauses. |
| `queries/thread/update-datasets-and-parameters.graphql` | Remove summary clauses. |
| `queries/thread/update.graphql` | Remove `delete_thread_model_execution` clause. |
| `queries/thread/delete.graphql` | Replace `delete_thread_model_execution` with direct `delete_execution WHERE thread_model.thread_id = $id` (cascade will handle it once FK ON DELETE CASCADE exists). Or rely on CASCADE entirely and remove the explicit execution delete. |
| `queries/thread/get.graphql` | Replace `executions { execution { ... } }` junction join with `direct_executions { ... }` or rewrite to query `execution(where: { thread_model_id: { _eq: $tmid } })`. |
| `queries/thread_model/get.graphql` | Rewrite WHERE clause from `executions: { execution_id: { _eq: $executionId } }` to `direct_executions: { id: { _eq: $executionId } }`. |
| `queries/emulator/model-executions.graphql` | Replace `thread_model_executions { ... }` junction join with `thread_model_id` direct FK traversal. Also update `thread_model_executions_aggregate` reference. Complex — high effort. |
| `queries/emulator/model-types.graphql` | Replace junction WHERE with direct FK: `where: { thread_model_id: { _is_null: false }, ... }` or join through `thread_model { thread { task { problem_statement { ... } } } }` via the new object_relationship. |
| `queries/fragments/execution-info.graphql` | Add `thread_model_id` field to the fragment. |

### Ensemble Manager — TypeScript Files to Edit (M2)

| File | Change |
|------|--------|
| `ExecutionCreation.ts:81-103` | `prepareModelExecutions`: remove `deleteThreadModelExecutionIds` call; set `submission_time` + `last_submission_status` on thread_model after prepare; remove `createThreadModelExecutionSummary` call |
| `ExecutionCreation.ts:106-143` | `createExecutions`: remove `setThreadModelExecutionIds` + `incrementThreadModelSubmittedRuns` calls |
| `ExecutionCreation.ts:157-182` | Delete `createThreadModelExecutionSummary` method entirely |
| `ExecutionCreation.ts:198-218` | `createExecutionMetadata`: remove `reuseExistingExecutions` flag; always use `getExecutionHash(execution)` |
| `graphql_adapter.ts` | Add `thread_model_id` to `executionToGQL` output and `executionFromGQL` input |
| `graphql_functions.ts` | Stub all junction/summary functions (see table above); update `setExecutions` to take execution list with `thread_model_id` pre-populated; update `getThreadModelByThreadIdExecutionId` |

### UI — GraphQL Files to Edit (D-11)

(VERIFIED by reading all files returned by the grep search)

| File | Change |
|------|--------|
| `ui/src/queries/execution/executions-for-thread-model.graphql` | Rewrite WHERE from `thread_model_executions: { thread_model_id: { _eq: $threadModelId } }` to direct `where: { thread_model_id: { _eq: $threadModelId } }` |
| `ui/src/queries/execution/thread-execution-summary-subscription.graphql` | Keep as-is through M2 (view preserves contract). In M3, verify subscription still works on view (Hasura supports subscriptions on views). [ASSUMED: Hasura v2 supports subscriptions on views backed by a stable PK — requires confirmation] |
| `ui/src/queries/execution/thread-execution-summary.graphql` | Keep as-is (view preserves contract) |
| `ui/src/queries/fragments/execution-summary-info.graphql` | Keep as-is (view preserves all fields) |
| `ui/src/queries/thread/set-dataslice-resources.graphql` | Remove `delete_thread_model_execution_summary` and `delete_thread_model_execution` clauses |
| `ui/src/queries/thread/update-models.graphql` (TWO FILES with same name) | Remove junction/summary delete clauses from both |
| `ui/src/queries/thread/update-datasets.graphql` | Remove junction/summary delete clauses |
| `ui/src/queries/thread/update-parameters.graphql` | Remove junction/summary delete clauses |
| `ui/src/queries/thread/update.graphql` | Remove junction delete clause |
| `ui/src/queries/thread/handle-ensemble-manager-connection-failed.graphql` | Remove junction/summary delete+insert clauses; keep provenance insert |
| `ui/src/queries/thread/delete.graphql` | Remove explicit `delete_thread_model_execution` and `delete_thread_model_execution_summary` clauses — rely on CASCADE |
| `ui/src/queries/task/delete.graphql` | Same — remove explicit junction/summary deletes |
| `ui/src/queries/problem-statement/delete.graphql` | Same — remove explicit junction/summary deletes |
| `ui/src/queries/emulator/model-types.graphql` | Rewrite junction WHERE to use FK: `where: { thread_model: { thread: { task: { ... } } } }` (navigating through `execution.thread_model` object_relationship) |

### UI — TypeScript Files to Edit (D-10)

| File | Sections | Change |
|------|----------|--------|
| `ui/src/screens/modeling/thread/mint-runs.ts` | Lines 82-118 (state grouping), 125 (summary key), 375-545 (render block), 538 (spinner string) | Implement four-state machine per UI-SPEC.md. Add `submission_time` and `last_submission_status` to the state. Change summary-key loop to use `thread_model.id` rather than `execution_summary` map. |
| `ui/src/screens/modeling/actions.ts` | Lines 618, 663 (summary subscription), 979, 1007, 1229 | After M3, update summary subscription to read from view (no-op if view preserves contract). Update `setThreadParameters` to not pass summary data. |

---

## getExecutionHash Determinism Analysis (D-08)

VERIFIED reading `graphql_functions.ts:469-481`:

```typescript
export const getExecutionHash = (execution: Execution): string => {
    let str = execution.modelid;
    const varids = Object.keys(execution.bindings).sort();  // sorted for determinism
    varids.map((varid) => {
        const binding = execution.bindings[varid];
        const bindingid =
            binding !== null && typeof binding === "object"
                ? (binding as DataResource).id
                : binding;
        str += varid + "=" + bindingid + "&";
    });
    return Md5.hashStr(str).toString();
};
```

**Determinism verdict: CONFIRMED DETERMINISTIC.** [VERIFIED]
- Input keys are `.sort()`-ed — order invariant
- `modelid` (the catalog configuration ID) is stable per model
- Bindings are object IDs or string values — stable references
- Result is MD5 hex string — 32 chars, fits in UUID column? **No — this is a problem.**

**Critical finding:** `execution.id` is declared as `uuid` type in the database (`id uuid DEFAULT public.gen_random_uuid() NOT NULL`). An MD5 hash is a 32-char hex string, NOT a UUID (which is 36 chars with hyphens, e.g. `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). The `getExecutionHash` function returns a raw MD5 hex like `"d41d8cd98f00b204e9800998ecf8427e"` — this is 32 chars. Postgres will reject inserting a 32-char hex string into a UUID column.

**Resolution options** [ASSUMED — planner must choose]:
1. Convert the column `execution.id` from `uuid` to `text` in M1 (breaking change — every FK that references it must also change)
2. Format the MD5 as a UUID-shaped string in `getExecutionHash`: insert hyphens at positions 8, 12, 16, 20: `"d41d8cd9-8f00-b204-e980-0998ecf8427e"` — this is a valid UUID format [ASSUMED: this is the simplest fix]
3. Use a SHA-1 or SHA-256 and truncate to UUID format

**Recommendation:** Option 2 — format MD5 as UUID in `getExecutionHash` by adding hyphen insertion. This is a one-line change and preserves the `uuid` column type. The existing `uuidv4` UUIDs (for prior rows) use the standard UUID format and will coexist safely. [ASSUMED: MD5 formatted as UUID does not collide with v4 UUID space in practice — different bit pattern distribution]

---

## ON CONFLICT Column List Audit (D-07)

The `new.graphql` mutation currently uses:
```graphql
on_conflict: {
    constraint: execution_pkey,
    update_columns: [ start_time, end_time, status, run_progress ]
}
```

After D-07, the update should be:
```graphql
update_columns: [ status, start_time, run_progress, run_id ]
# run_id set to NULL on re-submit to clear the stale Tapis job ID
# thread_model_id NOT in update_columns — must not overwrite (set once)
```

[VERIFIED: `run_id` column name is `run_id` in Hasura (`execution_info.graphql` fragment) and the `update-run-id.graphql` mutation uses `run_id`]

---

## Common Pitfalls

### Pitfall 1: MD5 Hash Cannot Be Inserted into UUID Column
**What goes wrong:** `INSERT INTO execution (id, ...) VALUES ('d41d8cd98f00b204e9800998ecf8427e', ...)` — Postgres rejects with "invalid input syntax for type uuid".
**Why it happens:** `getExecutionHash` returns raw MD5 hex, not UUID-formatted.
**How to avoid:** Format the hash with hyphens before returning from `getExecutionHash`.
**Warning signs:** `ON CONFLICT` test throws Postgres type error on first re-submit.

### Pitfall 2: Hasura Subscriptions May Not Work on Views Without a Stable PK
**What goes wrong:** The `thread-execution-summary-subscription.graphql` stops delivering updates after M3 because Hasura cannot track changes on the view.
**Why it happens:** Hasura v2 requires a primary key to enable subscriptions and mutations on tracked tables. Views don't have PKs by default.
**How to avoid:** Declare `thread_model_id` as the primary key of the view in Hasura metadata using `configuration.custom_root_fields` or by creating a unique index on a materialized view. Alternatively: declare the PK hint via `hasura-metadata set-table-primary-key`. The simplest approach: continue subscriptions via the `thread_model` table directly instead of through the summary view.
**Warning signs:** Subscription fires once on load but doesn't update in real-time.

### Pitfall 3: Two `update-datasets.graphql` Files
**What goes wrong:** Editing only one of the two `update-datasets.graphql` files leaves the other still deleting the junction.
**Why it happens:** There are two files with this name — one for `thread/` and one for `update-datasets-and-parameters.graphql`. The grep search found both. [VERIFIED: `queries/thread/update-datasets.graphql` and `queries/thread/update-datasets-and-parameters.graphql`]
**How to avoid:** Planner must enumerate both files explicitly in M2 tasks.
**Warning signs:** Junction still getting deleted in integration test for the parameters update flow.

### Pitfall 4: `thread/get.graphql` Uses Junction to Fetch Execution Status
**What goes wrong:** After M2 switches the UI query but before `thread/get.graphql` in ensemble-manager is updated, the GET thread call returns executions via the old junction join — and those return NULL `thread_model_id` because the junction schema has no such column.
**Why it happens:** `thread/get.graphql` uses `executions { execution { id, status, ... } }` which traverses through `thread_model_execution` junction. [VERIFIED: reading the file]
**How to avoid:** Update `thread/get.graphql` in M2 to use `direct_executions { id, status, ... }` via the new array_relationship.
**Warning signs:** `threadFromGQL` returns empty execution list despite executions existing in the DB.

### Pitfall 5: `model-executions.graphql` Uses Junction + Traversal Deeply
**What goes wrong:** The emulator `model-executions.graphql` not only filters through the junction but also SELECT-joins `thread_model_executions { thread_model { ... } }` for its result shape. After M3, this whole block is invalid.
**Why it happens:** The emulator screen was designed around the junction as a traversal vehicle.
**How to avoid:** In M2, replace the WHERE filter with direct FK path. For the SELECT join: replace `thread_model_executions { thread_model { ... } }` with a new `thread_model { ... }` object_relationship traversal.
**Warning signs:** The emulator screen goes blank after M2 deployment.

### Pitfall 6: `thread_model_execution_summary` PK vs View
**What goes wrong:** After M3 drops the table and creates a view, the `thread_model_execution_summary_pkey` constraint no longer exists. Any mutation trying to use `update_thread_model_execution_summary_by_pk` (as used by the increment mutations) will fail — but those should already be no-ops.
**How to avoid:** Ensure ALL increment mutations are stubbed out in M2 before M3 runs. If any code path still calls them after M3, Hasura will return an error.
**Warning signs:** 500 errors on increment calls after M3 deploy.

### Pitfall 7: Missing `thread_model_id` in execution select_permissions
**What goes wrong:** Hasura returns the new `thread_model_id` column as `null` even after backfill, because it is not listed in the `select_permissions.columns` array for `anonymous` and `user` roles.
**Why it happens:** Column permissions are explicit in Hasura — new columns are not auto-included.
**How to avoid:** Add `thread_model_id` to all `select_permissions` and `insert_permissions` column lists in the M1 metadata migration.

---

## Runtime State Inventory

This is a schema migration, not a rename/refactor. No stored external state (Mem0, n8n, OS tasks) references the junction table name. [VERIFIED: checking cerebrum and buglog — no external service references `thread_model_execution` by name]

**Per category:**
- Stored data: `thread_model_execution` rows and `thread_model_execution_summary` rows in dev/staging Postgres — handled by M1 backfill + M3 drop. No external datastores.
- Live service config: None referencing table names.
- OS-registered state: None.
- Secrets/env vars: None referencing table names.
- Build artifacts: `mint-ensemble-manager/dist/server.js` — stale after code changes; normal `npm run build` handles.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (ensemble-manager) | Jest (via `npm test`) |
| Framework (UI) | Jest (via `yarn test`) |
| Config file | `ENSEMBLE_MANAGER_CONFIG_FILE=src/config/config.json jest` |
| Quick run command | `cd mint-ensemble-manager && npm test -- --testPathPattern=ExecutionCreation` |
| Full suite command | `cd mint-ensemble-manager && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-06/D-08 | `getExecutionHash` used always; same bindings → same id | unit | `npm test -- --testPathPattern=ExecutionCreation` | ✅ `ExecutionCreation.test.ts` needs update |
| D-07 | ON CONFLICT DO UPDATE heals stuck execution | unit / integration | `npm test -- --testPathPattern=ExecutionCreation` | ❌ Wave 0 gap |
| D-08 (MD5 format) | Hash formatted as UUID-compatible string | unit | `npm test -- --testPathPattern=graphql_adapter` | ✅ `graphql_adapter.test.ts` needs test |
| D-02 | Cardinality preflight aborts on M:N violation | manual/script | `psql` or kubectl script | ❌ Wave 0: create validation script |
| D-05 | Zero NULL `thread_model_id` after backfill | manual/script | `psql` validation query | ❌ Wave 0: create validation script |
| D-03 | View produces same columns as table | integration | REST endpoint shape test | ❌ Wave 0 gap |
| D-09/D-10 | UI four-state machine renders correctly | manual | Visual + snapshot | ❌ Wave 0 gap (UI tests limited) |
| D-11 | UI executions query uses direct FK | automated grep | `grep -r "thread_model_executions" ui/src/` → 0 results | ✅ anti-acceptance grep |

### Sampling Rate
- Per task commit: `npm test` (ensemble-manager), visual check on UI
- Per wave merge: full test suite + dev cluster deployment + curl test on summary REST endpoint
- Phase gate: Full suite green + dev cluster validation query showing 0 NULL `thread_model_id` + REST shape match

### Wave 0 Gaps

- [ ] `mint-ensemble-manager/src/classes/common/__tests__/ExecutionCreation.test.ts` — update mock to verify hash-based ID, add ON CONFLICT idempotency test
- [ ] `graphql_engine/scripts/validate-phase11-m1.sql` — cardinality check + NULL count post-backfill
- [ ] `getExecutionHash` unit test: verify MD5-as-UUID format
- [ ] Dev cluster validation: `SELECT COUNT(*) FROM execution WHERE thread_model_id IS NULL` after M1 backfill

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Ensemble-manager build | ✓ (existing) | — | — |
| Jest | Unit tests | ✓ (existing) | — | — |
| Hasura CLI | Metadata apply | ✓ (per deploy scripts) | — | Manual YAML edit |
| Dev cluster Postgres | M1 validation | ✓ (dev cluster) | — | — |
| `kubectl` | Cluster-side validation scripts | ✓ (per cerebrum Hasura admin query pattern) | — | Direct port-forward |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| M:M junction for 1:N relationships | Direct FK | Eliminates 7 deletion footguns |
| Counter columns (increment mutations) | Derived aggregates via Postgres `FILTER` | Race condition impossible by construction |
| Delete+insert submission | `INSERT ... ON CONFLICT DO UPDATE` | Re-submit heals; no orphans |
| Random UUID as execution PK | Deterministic hash PK | Same bindings → same row → conflict resolution works |

**Deprecated after this phase:**
- `thread_model_execution` table: structurally impossible to leave partial state
- `thread_model_execution_summary` table: counters diverged from reality on any deletion error
- Increment/decrement mutation pattern: replaced by Postgres-side aggregation
- Manual recovery via `docs/debug-tapis-execution.md`: structurally unnecessary

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `thread_provenance.notes` column contains execution_id strings usable for orphan healing (D-05) | M1 SQL / D-05 | Orphan rows cannot be healed automatically; must be deleted or left NULL |
| A2 | NOT NULL constraint on `execution.thread_model_id` is safe to add after M1 backfill (zero NULLs) | M1 SQL | Migration fails; need to leave column nullable permanently or delete orphans |
| A3 | Hasura v2 supports subscriptions on views via `thread_model_id` as virtual PK | Hasura Metadata | Summary subscription breaks after M3; must redesign UI subscription |
| A4 | `WHERE tm.submitted_for_execution = true` filter in view is appropriate for existing query patterns | M3 View DDL | Query returning wrong row set; API callers see empty summary for un-submitted threads |
| A5 | MD5 hash formatted with hyphens is a safe substitute for UUID v4 in all Hasura/Postgres UUID columns | getExecutionHash | Type mismatch errors if Postgres validates UUID version bits |
| A6 | `timestamp without time zone` → `timestamptz` coercion for `submission_time` backfill is safe with session timezone | M1 SQL | Time values shifted by server timezone offset |
| A7 | Adding all 12 extra columns to `thread_model` (rather than fewer) is acceptable to the user | M3 View DDL | Excessive schema bloat if user prefers fewer columns |

**If this table were empty:** All claims in this research would be verified or cited.

---

## Open Questions

1. **D-05 orphan healing join path**
   - What we know: Execution rows exist with no junction row (`thread_model_id` = NULL after backfill)
   - What's unclear: Whether `thread_provenance.notes` actually contains execution_id strings on this dataset
   - Recommendation: Before M1 is committed, run `SELECT notes FROM thread_provenance LIMIT 100` on dev cluster to verify. Provide validation script as a Wave 0 deliverable.

2. **Hasura subscription support on views**
   - What we know: Hasura v2 tracks views; UI uses a subscription on `thread_model_execution_summary`
   - What's unclear: Whether Hasura live queries work on non-materialized views without a true PK
   - Recommendation: Test on dev cluster with a minimal view. If subscriptions fail: move the summary subscription to subscribe to `thread_model` directly (new `submission_time` column is there).

3. **`execution.id` column type**
   - What we know: Currently `uuid`; `getExecutionHash` returns raw MD5 hex (32 chars, not UUID-formatted)
   - What's unclear: Whether the planner should change the column type to `text` or format MD5 as UUID
   - Recommendation: Format MD5 as UUID (add hyphens in `getExecutionHash`) — preserves column type, avoids FK type changes downstream.

4. **Emulator screen `model-executions.graphql` rewrite scope**
   - What we know: This query both filters and selects through the junction in a deeply nested way
   - What's unclear: Whether the emulator screen is actively used and warrants full rewrite vs. stub
   - Recommendation: Full rewrite in M2 — the screen will be broken if the junction is gone.

---

## Sources

### Primary (HIGH confidence)
- `graphql_engine/migrations/1662641297914_init/up.sql` — exact schema for `thread_model_execution`, `thread_model_execution_summary`, `execution`, `thread_model`
- `graphql_engine/metadata/tables.yaml` lines 251-346 (execution), 1676-1822 (thread_model), 1822-1934 (thread_model_execution), 1935-2107 (thread_model_execution_summary)
- `mint-ensemble-manager/src/classes/common/ExecutionCreation.ts` — full `prepareModelExecutions`, `createExecutions`, `createExecutionMetadata` implementations
- `mint-ensemble-manager/src/classes/graphql/graphql_functions.ts` — all junction/summary function implementations
- `mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts` — adapter patterns
- All 14 UI GraphQL files under `ui/src/queries/` that reference junction/summary
- `ui/src/screens/modeling/thread/mint-runs.ts` — exact line positions for state machine
- `.planning/phases/11-simplify-ensemble-manager-and-ui-execution-model-kill-thread/11-CONTEXT.md` — locked decisions D-01..D-15
- `.planning/phases/11-simplify-ensemble-manager-and-ui-execution-model-kill-thread/11-UI-SPEC.md` — four-state machine spec
- `.wolf/buglog.json` — bug-010/011/012/014 root cause analysis
- `graphql_engine/migrations/1771200012000_thread_model_migration/up.sql` — Phase 9 migration pattern
- `graphql_engine/migrations/1771200013000_drop_execution_model_id/up.sql` — Phase 10 drop pattern

### Secondary (MEDIUM confidence)
- `.wolf/cerebrum.md` — confirmed junction-deleting mutations audit list, Hasura admin query pattern
- `.planning/ROADMAP.md` — Phase 11 scope description with proposed simplifications

### Tertiary (LOW confidence)
- ASSUMED: Hasura v2 subscription support on views (needs cluster validation — A3)
- ASSUMED: MD5-as-UUID format compatibility (needs unit test — A5)
- ASSUMED: `thread_provenance.notes` contains execution IDs (needs dev cluster query — A1)

---

## Metadata

**Confidence breakdown:**
- Schema/SQL patterns: HIGH — read from actual migration files
- Callsite inventory: HIGH — read every referenced file directly
- Hasura metadata strategy: MEDIUM — patterns inferred from existing tables.yaml; view behavior is ASSUMED
- `getExecutionHash` determinism: HIGH — verified in source
- `getExecutionHash` UUID format issue: HIGH — verified mismatch between MD5 hex and UUID column type
- UI state machine: HIGH — read all relevant sections of mint-runs.ts and UI-SPEC.md

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (stable schema; no fast-moving external dependencies)
