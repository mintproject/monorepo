---
phase: 12-model-catalog-configuration-file-input-tapis-compatibility
plan: "04"
subsystem: mint-ensemble-manager
tags:
  - tapis
  - tdd
  - is_optional
  - job-submission
dependency_graph:
  requires:
    - "12-03-PLAN.md"
  provides:
    - TapisJobService skip-when-optional branch (D-15)
    - Unit tests for all three optional-input branches
  affects:
    - mint-ensemble-manager/src/classes/tapis/adapters/TapisJobService.ts
    - mint-ensemble-manager/src/classes/tapis/adapters/tests/jobs.test.ts
    - mint-ensemble-manager/src/classes/tapis/adapters/tests/fixtures/app.ts
    - mint-ensemble-manager/src/classes/tapis/adapters/tests/fixtures/model.ts
tech_stack:
  added: []
  patterns:
    - flatMap return [] to skip optional inputs in Tapis job construction
    - console.info logging for skipped optional inputs (consistent with codebase pattern)
    - Fixture composition via spread from base const (app.ts and model.ts)
key_files:
  created: []
  modified:
    - mint-ensemble-manager/src/classes/tapis/adapters/TapisJobService.ts
    - mint-ensemble-manager/src/classes/tapis/adapters/tests/jobs.test.ts
    - mint-ensemble-manager/src/classes/tapis/adapters/tests/fixtures/app.ts
    - mint-ensemble-manager/src/classes/tapis/adapters/tests/fixtures/model.ts
decisions:
  - "Used console.info instead of logger.info because TapisJobService has no logger; codebase uses console.log/console.info/console.error throughout tapis adapters"
  - "TDD RED gate: tests passed before the skip branch was added because the existing behavior (datasets.map on empty array returns []) already produced the correct output; the skip branch adds explicit intent, guarding, and logging"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-28"
  tasks_completed: 2
  files_modified: 4
---

# Phase 12 Plan 04: Optional Input Skip Logic in TapisJobService Summary

**One-liner:** TapisJobService.createJobFileInputsFromSeed skips optional model inputs (is_optional=true) with no bound datasets, eliminating Tapis submission failure for optional inputs.

## What Was Built

Added an explicit skip-when-optional branch to `createJobFileInputsFromSeed` in `TapisJobService`. When an app fileInput maps to a model input with `is_optional=true` and no datasets are bound in the seed, the method now returns `[]` (logs an info message) instead of falling through silently. The existing throw for name-not-found remains unchanged.

Three unit tests were added covering all behavior branches, along with typed fixture exports for reuse.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Fixtures and test cases for optional input branches | cd03a4f | fixtures/app.ts, fixtures/model.ts, jobs.test.ts |
| GREEN (Task 1) | Skip-when-optional logic in TapisJobService | 1332d30 | TapisJobService.ts |
| bump | Submodule pointer bump in superproject | ae54172 | mint-ensemble-manager (submodule ref) |

## Key Changes

**TapisJobService.ts:**
- Added `if (datasets.length === 0 && modelInput.is_optional)` guard after computing datasets
- Returns `[]` early with `console.info` log message including the input name
- Required inputs with no datasets continue to fall through to `datasets.map(...)` → returns `[]` silently (existing behavior unchanged)
- Name-not-found throw (`Component input not found for ${fileInput.name}`) unchanged

**fixtures/app.ts:**
- Extracted default export to named `baseApp` const
- Added `appWithOptionalInput`: app with `inputMode: "OPTIONAL"` fileInput named `optional_file`
- Added `appWithUnknownRequiredInput`: app with `inputMode: "REQUIRED"` fileInput named `unknown_file` (not in default model.input_files)

**fixtures/model.ts:**
- Added `import { Model }` from mint-types
- Extracted default export to named `baseModel` const
- Added `modelWithOptionalInput`: model with single input_file `optional_file`, `is_optional: true`

**jobs.test.ts:**
- Added 3 new test cases:
  1. "optional input with no datasets is skipped" → result is length 0, no entry with name "optional_file"
  2. "throws when app fileInput name is not found in model.input_files" → throws "Component input not found"
  3. "optional input with datasets present is included" → result contains entry with name "optional_file"
- Total: 68 tests pass (was 65 before this plan)

## Deviations from Plan

### Auto-adapted: console.info instead of logger.info

**Found during:** Task 1
**Issue:** The plan specified `logger.info(...)` but `TapisJobService` has no logger field or import. The entire tapis adapter layer uses `console.log/console.error/console.info`.
**Fix:** Used `console.info(...)` consistent with codebase logging pattern.
**Files modified:** TapisJobService.ts
**Commit:** 1332d30

### TDD note: RED gate passed vacuously

**Finding:** During the RED phase, "optional input with no datasets is skipped" passed even before the skip branch was added. This is because the existing code does `datasets.map(...)` on an empty array, which already returns `[]`. The observable behavior was already correct — the skip branch adds explicit intent, guarding against future regression, and the info log.

Per TDD fail-fast rule: investigated and confirmed the behavior is intentionally already correct. Proceeded with implementation to add explicit guard and logging.

## TDD Gate Compliance

- RED gate: commit `cd03a4f` — `test(12-04): add fixtures and tests for optional input skip branches`
- GREEN gate: commit `1332d30` — `feat(12-04): add skip-when-optional logic to createJobFileInputsFromSeed`

Both gates present and in correct order.

## Known Stubs

None — all logic is wired. `is_optional` is read from `ModelIO` (populated by Plan 03 adapter). The skip branch is fully implemented.

## Threat Flags

No new security-relevant surface introduced. The `is_optional` flag read in `TapisJobService` originates from Hasura (admin-secret-controlled write path via the model catalog API). Per T-12-11: the skip branch is guarded by `modelInput.is_optional` — undefined/false map to the existing path; only explicit `true` enables skip. The name-not-found throw is never bypassed.

## Self-Check: PASSED

Files verified:
- `mint-ensemble-manager/src/classes/tapis/adapters/TapisJobService.ts` — contains `modelInput.is_optional` and `Skipping optional input`
- `mint-ensemble-manager/src/classes/tapis/adapters/tests/fixtures/app.ts` — contains `appWithOptionalInput` and `appWithUnknownRequiredInput`
- `mint-ensemble-manager/src/classes/tapis/adapters/tests/fixtures/model.ts` — contains `modelWithOptionalInput`
- `mint-ensemble-manager/src/classes/tapis/adapters/tests/jobs.test.ts` — contains all 3 new test names

Commits verified:
- `cd03a4f` (submodule) — RED gate
- `1332d30` (submodule) — GREEN gate
- `ae54172` (superproject) — submodule pointer bump

Test suite: 68 passed, 0 failed, 12 suites
