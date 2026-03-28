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
