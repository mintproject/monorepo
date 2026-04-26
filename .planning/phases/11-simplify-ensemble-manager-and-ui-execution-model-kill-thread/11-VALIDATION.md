---
phase: 11
slug: simplify-ensemble-manager-and-ui-execution-model-kill-thread
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (mint-ensemble-manager), vitest (model-catalog-api), jest (UI) |
| **Config file** | `mint-ensemble-manager/jest.config.js`, `ui/jest.config.js` |
| **Quick run command** | `cd mint-ensemble-manager && npm test -- --testPathPattern=ExecutionCreation` |
| **Full suite command** | `cd mint-ensemble-manager && npm test && cd ../ui && yarn test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-XX-XX | TBD | TBD | D-XX | — | TBD | unit/integration | `{command}` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Per-task rows populated by planner after PLAN.md generation.*

---

## Wave 0 Requirements

- [ ] M1 cardinality preflight script (`graphql_engine/migrations/.../preflight.sql`) — verify 1:N invariant before junction-drop migration
- [ ] Orphan-heal verification query — `SELECT COUNT(*) FROM execution WHERE thread_model_id IS NULL` must return 0 after backfill
- [ ] View-shape contract test — REST `/threads/:id/runs` response shape unchanged before vs after M3 (snapshot test against staging)
- [ ] ON CONFLICT idempotency unit test — `prepareModelExecutions` called twice with same bindings produces 1 row, not 2
- [ ] `getExecutionHash` UUID-format unit test — output matches `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`
- [ ] UI state-machine snapshot tests — four states (not-run / submission-failed / waiting / done) render expected DOM
- [ ] Hasura subscription smoke test on view (dev cluster) — confirm live updates fire when execution status changes

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end re-submit heals stuck thread | D-07 | Requires real Tapis cluster | Submit thread, kill Tapis job mid-flight, observe FAILURE row, click "Retry", verify same execution.id reused and status flips |
| Three-state UI banner correctness | D-09, D-10 | Visual + interaction | Run UI dev server, exercise each state path, screenshot vs UI-SPEC.md mockups |
| dev cluster orphan healing dry-run | D-05 | Requires production-shape data | Run `preflight.sql` + healing UPDATE on dev snapshot; verify zero NULLs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
