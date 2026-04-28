# Roadmap: DYNAMO Model Catalog GraphQL Migration

## Milestones

- ✅ **v2.0 DYNAMO Model Catalog GraphQL Migration** — Phases 1-4 (shipped 2026-03-15)

## Phases

<details>
<summary>✅ v2.0 DYNAMO Model Catalog GraphQL Migration (Phases 1-4) — SHIPPED 2026-03-15</summary>

- [x] Phase 1: Schema and Data Migration (7/7 plans) — completed 2026-02-19
- [x] Phase 2: API Integration (13/13 plans) — completed 2026-02-21
- [x] Phase 3: FK Migration and Cleanup (4/4 plans) — completed 2026-02-22
- [x] Phase 4: Critical Bug Fixes (1/1 plan) — completed 2026-03-15

See `.planning/milestones/v2.0-ROADMAP.md` for full phase details.

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Schema and Data Migration | v2.0 | 7/7 | Complete | 2026-02-19 |
| 2. API Integration | v2.0 | 13/13 | Complete | 2026-02-21 |
| 3. FK Migration and Cleanup | v2.0 | 4/4 | Complete | 2026-02-22 |
| 4. Critical Bug Fixes | v2.0 | 1/1 | Complete | 2026-03-15 |

### Phase 1: Test all POST endpoints and create status/error summary

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 0
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 1 to break down)

### Phase 2: Fix JWT signature verification error on POST endpoints

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 1
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 2 to break down)

### Phase 3: Fix nested resource creation - link or create associated resources when creating parent resource

**Goal:** Make POST and PUT operations handle junction-based relationships atomically, using Hasura nested inserts for create and delete-then-insert for update, across all 25 junction tables.
**Requirements**: D-01 through D-07 (from CONTEXT.md)
**Depends on:** Phase 2
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Extend resource registry with parentFkColumn + create buildJunctionInserts helper
- [x] 03-02-PLAN.md — Wire junction handling into service.ts create() and update() methods

### Phase 5: Variable Migration Analysis: TriG/Fuseki to Hasura

**Goal:** Complete the variable ecosystem migration by creating StandardVariable and Unit entity tables, adding FK constraints from VariablePresentation, extending the ETL pipeline to extract and load these entities, and enabling full CRUD API endpoints with bidirectional relationship traversal.
**Requirements**: D-01 through D-09 (from CONTEXT.md)
**Depends on:** Phase 4
**Plans:** 3/3 plans complete

Plans:
- [x] 05-01-PLAN.md — Create StandardVariable + Unit tables, Hasura metadata, API resource registry
- [x] 05-02-PLAN.md — Extend ETL pipeline: extract, transform, load for new entities + junction diagnostic
- [x] 05-03-PLAN.md — Add FK constraints from VariablePresentation to StandardVariable and Unit

### Phase 6: Ensemble manager Tapis integration tests

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 5
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 6 to break down)

### Phase 7: Test coverage for model catalog migration - verify GraphQL adapter, service layer, and architecture changes

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 7 to break down)

### Phase 8: Remove Model Catalog API adapter functions (modelConfigurationToGraphQL, modelConfigurationSetupToGraphQL) - post-migration cleanup

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 7
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 8 to break down)

### Phase 9: Merge ModelConfiguration/Setup tables and migrate thread_model relationships

**Goal:** Consolidate modelcatalog_model_configuration and modelcatalog_model_configuration_setup into a unified modelcatalog_configuration table, merge overlapping junction tables, migrate thread_model/execution FKs to reference the unified table, drop the legacy public.model table, and update all dependent code (API resource registry, ETL pipeline, ensemble manager).
**Requirements**: D-01 through D-09 (from CONTEXT.md)
**Depends on:** Phase 8
**Plans:** 4/4 plans complete

Plans:
- [x] 09-01-PLAN.md — SQL migrations (table merge, junction consolidation, thread_model FK migration) + Hasura metadata
- [x] 09-02-PLAN.md — Model-catalog-api resource registry and field-maps update
- [x] 09-03-PLAN.md — ETL pipeline update for unified table
- [x] 09-04-PLAN.md — Ensemble manager GraphQL queries, adapter removal, service layer rewrite

### Phase 10: Check the required changes on mint-ensemble-manager after migration

**Goal:** Update mint-ensemble-manager GraphQL queries and TypeScript adapters to use modelcatalog_configuration_id instead of dropped model_id/model table references, drop the old execution.model_id column, repoint binding FKs to modelcatalog tables, remove dead code, consolidate duplicate GraphQL files, add unit tests, and verify build succeeds.
**Requirements**: D-01 through D-13 (from CONTEXT.md)
**Depends on:** Phase 9
**Plans:** 3/3 plans complete

Plans:
- [x] 10-00-PLAN.md — DB migrations: drop execution.model_id, repoint execution_data_binding FK
- [x] 10-01-PLAN.md — Fix breaking GraphQL queries + update execution adapter functions
- [ ] 10-02-PLAN.md — Dead code cleanup, file consolidation, unit tests, build verification

### Phase 11: Simplify ensemble manager and UI execution model — kill thread_model_execution junction

**Goal:** Eliminate the structural fragility behind the bug-010/011/012/014 stuck-spinner family by replacing the thread_model_execution M:M junction with a direct thread_model_id FK on execution, making submission idempotent (INSERT...ON CONFLICT instead of delete+insert), dropping the redundant thread_model_execution_summary table in favor of a computed view/field, and disambiguating the UI's three execution states (not-run / submission-failed / waiting) so the "Downloading software image and data..." spinner is only shown when an execution row is genuinely WAITING.

**Current Status:**
- bug-014 root cause: thread_model_execution junction is fragile. Seven different mutations can wipe it. UI treats empty junction as "still loading" → infinite spinner.
- Fixed in `aa15d063`: handle_failed_connection_ensemble no longer deletes junction on submission failure.
- Still broken:
  - `prepareModelExecutions` wipes junction before every re-submit (`delete_thread_model_executions`). Stale failed threads cannot self-heal — re-running orphans the previous FAILURE rows.
  - UI's `executions_for_thread_model` joins through junction; one missing row = blank table = spinner.
  - Six other mutations still delete junction (config delete, thread input edits, model param edits). Any of them between submit and poll = ghost spinner.
  - Recovery requires manual SQL surgery (docs/debug-tapis-execution.md Option A/B).

**Proposed Simplifications:**

Ensemble manager:
1. Kill `thread_model_execution` junction. Add `thread_model_id` FK on `execution` directly.
   - Junction is M:M but real cardinality is 1:N (one execution belongs to one thread_model).
   - Removes all 7 junction-mutation footguns.
   - Cascade delete handles thread_model deletion cleanly.
   - Migration: `ALTER TABLE execution ADD COLUMN thread_model_id uuid REFERENCES thread_model(id) ON DELETE CASCADE`, backfill from junction, drop junction table.
2. Make submission idempotent.
   - `prepareModelExecutions` currently does delete + insert. Replace with `INSERT ... ON CONFLICT DO UPDATE` keyed on `(thread_model_id, execution_hash)`.
   - Re-submit heals stuck state instead of orphaning it.
3. Drop `thread_model_execution_summary` table. Compute on read.
   - Summary duplicates state already in `execution.status`. Source of truth divergence caused bug-011 (summary updated, junction wiped).
   - Replace with Hasura computed field or view: `count(*) filter (where status='FAILURE')` etc.
   - Cuts the increment/decrement race conditions noted in bug-014 root cause.

UI:
4. Render from `execution` rows directly via `thread_model_id` FK. No more junction join. Query: `execution(where: { thread_model_id: { _eq: $tmid } })`.
5. Disambiguate three states explicitly:
   - `executions = []` AND no `submission_time` → "Not run yet"
   - `executions = []` AND `submission_time` set → "Submission failed" (red banner, retry button)
   - `executions[].status = 'WAITING'` → "Downloading…" spinner
   - Today UI conflates 1+2+3.
6. Drop the "spinner fallback" in `mint-runs.ts:447`. Replace with explicit state machine driven by submission timestamp + execution count + statuses.

**Net effect:**
- 7 junction-deleting mutations → 0
- Stuck-thread recovery doc → unnecessary
- Manual SQL surgery → unnecessary
- bug-010, bug-011, bug-012, bug-014 family → structurally impossible

**Migration risk:**
- Junction drop touches Hasura metadata + UI queries (`executions_for_thread_model`, several others). Phased: add FK + dual-write first, migrate readers, then drop.
- Summary drop changes API contract — REST endpoints exposing `failed_runs`/`submitted_runs` need view-backed equivalents.

**Requirements**: TBD
**Depends on:** Phase 10
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 11 to break down)

### Phase 12: Support optional `hasInput` on model configuration (catalog + UI + ensemble manager)

**Goal:** Allow a model configuration's `hasInput` to be marked optional. Model catalog stores the flag (`is_optional` boolean on `modelcatalog_configuration_input`), UI displays and edits it, ensemble manager respects it during Tapis submission (skip-when-missing instead of fail).

**Requirements**: D-01 through D-23 (from 12-CONTEXT.md)
**Depends on:** Phase 11
**Plans:** 1/5 plans executed

Plans:
- [~] 12-01-PLAN.md — SQL migration (ADD COLUMN is_optional) + Hasura metadata apply [Wave 1, blocking checkpoint] — Tasks 1-2 committed; awaiting hasura apply (Task 3)
- [ ] 12-02-PLAN.md — model-catalog-api: resource-registry junctionColumns + field-maps + service.ts + openapi.yaml [Wave 2]
- [ ] 12-03-PLAN.md — mint-ensemble-manager: ModelIO interface + GraphQL fragments + modelIOFromCatalogGQL + codegen [Wave 2]
- [ ] 12-04-PLAN.md — TapisJobService skip-when-optional logic + unit tests + fixtures [Wave 3]
- [ ] 12-05-PLAN.md — UI configure editor: checkbox (edit) + badge (read) + getResources round-trip [Wave 3]
