---
phase: quick-260328-n8j
plan: 01
subsystem: model-catalog-api
tags: [integration-test, vitest, http, junction-tables, softwares]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [INTEG-01]
  affects: [model-catalog-api/src/__tests__/junction-integration.test.ts]
tech_stack:
  added: []
  patterns: [native fetch, describe.skipIf, vitest sequential tests]
key_files:
  created:
    - model-catalog-api/src/__tests__/junction-integration.test.ts
  modified: []
decisions:
  - Use native fetch (Node 18+ built-in) — no new dependencies
  - Suite guarded by describe.skipIf(!TOKEN) so npm test passes without token
  - API base URL configurable via MINT_API_URL env var, defaulting to https://api.models.mint.local/v2.0.0
  - Timeout passed as plain number (third arg to it()) per project's vitest version
metrics:
  duration: 4 min
  completed: 2026-03-28
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Quick Task 260328-n8j: Add Integration Test for Junction Relationship CRUD

**One-liner:** Live HTTP integration test for `POST/PUT/GET /softwares` verifying that `buildJunctionInserts()` and delete-then-insert junction mutation patterns persist correctly to Hasura.

## What Was Built

A new vitest test file at `model-catalog-api/src/__tests__/junction-integration.test.ts` that makes real HTTP requests to the live API to validate Phase 3's junction-based relationship handling end-to-end.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create live HTTP integration test for junction-based relationship CRUD | da78c6f | src/__tests__/junction-integration.test.ts |

## Test Coverage

Five test cases in sequential order:

1. **POST creates junction rows** — POST `/softwares` with `hasModelCategory: [Economy]`, asserts 201 and captures created ID
2. **GET verifies persistence** — GET `/softwares/{id}`, asserts `hasModelCategory` contains Economy and `label` is array-wrapped
3. **PUT replaces junction rows** — PUT with `hasModelCategory: [Agriculture]`, asserts Economy removed and Agriculture present (delete-then-insert semantics)
4. **PUT without junction field is no-op** — PUT with only `description`, asserts Agriculture still present (Pitfall 2 guard)
5. **GET final verification** — GET confirms all PUT results persisted (label, description, Agriculture category)

Cleanup: `afterAll` deletes all created resources; skipped gracefully when `MINT_API_TOKEN` not set.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vitest `it()` timeout signature**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** Plan specified `{ timeout: 30_000 }` as options object as 3rd arg to `it()`, but this project's vitest version expects timeout as a plain number
- **Fix:** Changed `{ timeout: 30_000 }` to `30_000` (number) on all `it()` calls
- **Files modified:** junction-integration.test.ts
- **Commit:** da78c6f (inline fix before commit)

## Self-Check: PASSED

- junction-integration.test.ts: FOUND
- Commit da78c6f: FOUND
- TypeScript compiles cleanly: PASSED
- npm test (170 passed, 5 skipped): PASSED
