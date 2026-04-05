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
