---
phase: 3
slug: fix-nested-resource-creation-link-or-create-associated-resources-when-creating-parent-resource
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (via ts-jest) |
| **Config file** | `model-catalog-api/jest.config.ts` |
| **Quick run command** | `cd model-catalog-api && npx jest --testPathPattern='request.test' --no-coverage` |
| **Full suite command** | `cd model-catalog-api && npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd model-catalog-api && npx jest --testPathPattern='request.test' --no-coverage`
- **After every plan wave:** Run `cd model-catalog-api && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | D-01/D-06 | unit | `npx jest --testPathPattern='request.test'` | TBD | ⬜ pending |
| 03-01-02 | 01 | 1 | D-03/D-04 | unit | `npx jest --testPathPattern='request.test'` | TBD | ⬜ pending |
| 03-02-01 | 02 | 2 | D-01/D-03 | integration | `npx jest --testPathPattern='service.test'` | TBD | ⬜ pending |
| 03-02-02 | 02 | 2 | D-07 | integration | `npx jest --testPathPattern='service.test'` | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. Jest and ts-jest already configured. Existing test file `request.test.ts` has tests for the current behavior (relationship fields dropped).

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end POST with nested resources via API | D-01/D-03 | Requires running Hasura + DB | POST `/v2.0.0/models` with `hasModelCategory` body, verify junction row created |
| PUT replaces junction rows | D-07 | Requires running Hasura + DB | PUT model with changed categories, verify old junction rows deleted and new ones created |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
