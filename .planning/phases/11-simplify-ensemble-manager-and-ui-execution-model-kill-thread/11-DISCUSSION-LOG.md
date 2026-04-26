# Phase 11: Simplify ensemble manager and UI execution model — kill thread_model_execution junction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 11-simplify-ensemble-manager-and-ui-execution-model-kill-thread
**Areas discussed:** Migration strategy, Summary table replacement, Idempotency mechanism, UI state machine source, Orphan handling, Cardinality verification, Cleanup scope

---

## Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Phased dual-write (Recommended) | M1: ADD FK + backfill + dual-write triggers. M2: migrate all readers. M3: drop junction + summary. Each step deployable independently; rollback possible until M3. Matches Phase 9/10 pattern. | ✓ |
| Single-shot migration | One migration: add FK, backfill, drop junction + summary, atomically. All readers updated in same PR. Smaller diff but no rollback once shipped. | |
| Phased without dual-write | M1: add FK + backfill. M2: switch readers. M3: drop junction. No write-side dual-write triggers — accept brief window where new writes go through old code path. | |

**User's choice:** Phased dual-write (Recommended)
**Notes:** Mirrors Phase 9/10 success. Rollback safety preferred over diff size.

---

## Summary Table Replacement

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres view, same name (Recommended) | Drop summary table; create view of same name selecting count(*) FILTER per status from execution grouped by thread_model_id. Hasura sees same shape; zero caller refactor; counters always derived. | ✓ |
| Hasura computed fields on thread_model | Add SQL functions returning counters as computed fields on thread_model. Refactor every caller from `thread_model_execution_summary { ... }` to `thread_model { failed_runs ... }`. ~40+ query refactors. | |
| Keep summary table, fix race conditions | Don't drop. Replace per-mutation increments with a single trigger that recomputes from execution rows. Lower migration risk; keeps duplicated state. | |

**User's choice:** Postgres view, same name (Recommended)
**Notes:** REST contract preservation was the deciding factor. View-of-same-name is a single replacement point that makes the entire 380-hit footprint a no-op for readers.

---

## Idempotency Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic execution.id via getExecutionHash (Recommended) | Always assign execution.id = getExecutionHash(execution). PK becomes natural conflict key. ON CONFLICT (id) DO UPDATE. No schema change beyond FK. | ✓ |
| Add execution_hash column + UNIQUE(thread_model_id, execution_hash) | Keep uuid PK; add separate execution_hash column. UNIQUE constraint. ON CONFLICT on that pair. Preserves PK opacity, adds column + index + backfill. | |
| Soft idempotency in app code only | No ON CONFLICT. Query for existing (thread_model_id, hash) row before insert. Two roundtrips per execution. | |

**User's choice:** Deterministic execution.id via getExecutionHash (Recommended)
**Notes:** getExecutionHash already exists in ExecutionCreation.ts — minimal new surface.

---

## UI State Machine Source

| Option | Description | Selected |
|--------|-------------|----------|
| New thread_model.submission_time column (Recommended) | Add submission_time + last_submission_status to thread_model. Set on every prepareModelExecutions call. UI reads thread_model + execution rows. Clean state machine; survives summary drop. | ✓ |
| Derive from execution rows | If any execution exists → submission attempted. Submission-failed = all FAILURE with runid=null AND no recent submission. No schema change but state derivation lives in UI logic. | |
| Query thread_provenance log | UI joins to thread_provenance where notes match. State derived from event log. No new schema; couples UI to log message text. | |

**User's choice:** New thread_model.submission_time column (Recommended)
**Notes:** Explicit column avoids fragile log-text coupling and gives the UI a single, queryable source.

---

## Orphan Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Heal via execution.modelid join (Recommended) | Backfill thread_model_id from junction first; for orphans, infer thread_model_id by matching execution.modelid to thread_model.modelcatalog_configuration_id within same thread. Stuck threads self-heal. | ✓ |
| Junction-only backfill (orphans stay broken) | Only backfill from existing junction rows. Orphans get NULL thread_model_id and stay invisible. Document one-time SQL cleanup. | |
| Junction-only + delete orphans | Backfill from junction; DELETE all execution rows where thread_model_id ends up NULL. Loses failure history but guarantees no NULL FKs. | |

**User's choice:** Heal via execution.modelid join (Recommended)
**Notes:** Heals bug-014 stuck threads in dev/staging in the same migration that prevents future occurrences.

---

## Cardinality Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, verify in M1 + abort if violated (Recommended) | M1 runs `SELECT COUNT(*) FROM thread_model_execution GROUP BY execution_id HAVING COUNT(*) > 1` as pre-check. Abort if any execution belongs to multiple thread_models. | ✓ |
| Trust the roadmap, skip verification | Roadmap analysis already concluded 1:N. Add NOT NULL FK without pre-check; if it fails the constraint, migration errors out and we investigate then. | |

**User's choice:** Yes, verify in M1 + abort if violated (Recommended)
**Notes:** Cheap insurance; failure mode is loud and clean.

---

## Cleanup Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate + delete dead mutations + delete debug doc (Recommended) | Drop delete-thread-model-executions.graphql, handle-failed-connection-ensemble cleanup clause, 5 other junction-deleting mutation files. Delete docs/debug-tapis-execution.md. Whole bug class gone end-to-end. | ✓ |
| Migrate only — leave dead mutations as no-ops | After junction drop, dead mutations become table-not-exist no-ops. Skip file removal this phase. | |
| Migrate + replace recovery doc with general execution debug doc | Drop junction-specific sections but keep docs/debug-tapis-execution.md as general debug reference. | |

**User's choice:** Migrate + delete dead mutations + delete debug doc (Recommended)
**Notes:** End-to-end cleanup. The recovery doc only existed because the structural bug existed — when the bug is structurally impossible, the doc is dead weight.

---

## Claude's Discretion

- Exact SQL syntax, indices, and NOT NULL constraint timing in each migration.
- Specific Hasura metadata YAML edits for the new object_relationship from execution to thread_model.
- TypeScript adapter updates (`executionToGQL`, `executionFromGQL`) following Phase 10 patterns.
- Test rewrites for changed adapters and queries.
- Codegen + commit `types.ts`.
- Whether the M3 view definition needs additional fields beyond the listed counters.
- Commit ordering and PR boundaries within each migration phase.

## Deferred Ideas

- General "how to debug a stuck execution" reference doc to replace docs/debug-tapis-execution.md — only if needed after structural fix lands.
- Retries/backoff policy on submission failure — separate concern.
- Migrating execution.runid (Tapis UUID) to a more typed column — out of scope.
- Cleaning up thread_provenance log schema — stays as audit trail.
