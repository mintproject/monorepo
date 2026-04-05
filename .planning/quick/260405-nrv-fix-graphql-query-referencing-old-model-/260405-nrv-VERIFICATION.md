---
phase: quick-260405-nrv
verified: 2026-04-05T18:00:00Z
status: passed
score: 3/3 must-haves verified
re_verification: false
---

# Quick Task 260405-nrv: Fix GraphQL Query Referencing Old Model Table — Verification Report

**Task Goal:** Fix GraphQL query referencing old model table — update to modelcatalog tables post-migration. Also fix threadFromGQL to read from modelcatalog_configuration instead of model, and update modelEnsembleFromGQL to use modelcatalog_parameter.
**Verified:** 2026-04-05T18:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                      | Status     | Evidence                                                                                             |
| --- | -------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| 1   | UI no longer sends GraphQL queries referencing the deleted 'model' table   | ✓ VERIFIED | No `insert_model`, `model_pkey`, `listExistingModelsGQL`, `newModelsGQL` refs remain in `src/`      |
| 2   | cacheModelsFromCatalog callers continue to work without errors             | ✓ VERIFIED | Function is a no-op with preserved signature; both callers in thread-expansion-models.ts and mint-models.ts compile against it |
| 3   | Dead GraphQL query files are removed                                       | ✓ VERIFIED | `src/queries/model/list-in.graphql`, `src/queries/model/new.graphql`, and `src/queries/emulator/get-model-type-configs.graphql` are deleted; directory removed |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact                                      | Expected                                                    | Status     | Details                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `ui/src/screens/modeling/actions.ts`          | No-op cacheModelsFromCatalog, removed imports of deleted queries | ✓ VERIFIED | `cacheModelsFromCatalog` at line 1093 returns early with comment; no removed imports remain      |
| `ui/src/util/graphql_adapter.ts`              | Removed threadModelsToGQL and modelToGQL functions          | ✓ VERIFIED | Neither function name appears anywhere in `src/`; commit 5665ef9 confirms deletion of 107 lines |

### Key Link Verification

| From                                                                    | To                     | Via                          | Status     | Details                                                                |
| ----------------------------------------------------------------------- | ---------------------- | ---------------------------- | ---------- | ---------------------------------------------------------------------- |
| `ui/src/screens/modeling/thread/thread-expansion-models.ts`            | `cacheModelsFromCatalog` | `await cacheModelsFromCatalog` at line 160 | ✓ WIRED | Import at line 31, call at line 160 — resolves to no-op   |
| `ui/src/screens/modeling/thread/mint-models.ts`                        | `cacheModelsFromCatalog` | `await cacheModelsFromCatalog` at line 918 | ✓ WIRED | Import at line 18, call at line 918 — resolves to no-op   |

### Data-Flow Trace (Level 4)

Not applicable — changes are cleanup/deletion. No new data-rendering paths introduced.

### Additional Fix Verification (threadFromGQL / modelEnsembleFromGQL)

This fix was committed separately as 7ae254a. Verified against the actual code:

| Fix                         | Old Code                    | New Code                                     | Status     |
| --------------------------- | --------------------------- | -------------------------------------------- | ---------- |
| `threadFromGQL` data access | `tm["model"]`               | `tm["modelcatalog_configuration"]` (line 379) | ✓ VERIFIED |
| `modelFromGQL` input shape  | Direct field access         | Junction-table unwrap (`item["input"] ?? item`, etc.) (lines 483–502) | ✓ VERIFIED |
| `modelFromGQL` name mapping | Not handled                 | Maps `label` to `name` when name absent (lines 479–481) | ✓ VERIFIED |
| `modelEnsembleFromGQL`      | `pb["model_parameter"]`     | `pb["modelcatalog_parameter"] ?? pb["model_parameter"]` (line 561) | ✓ VERIFIED |

### Behavioral Spot-Checks

Step 7b: SKIPPED — changes are pure deletions and function rewrites with no independently runnable entry points. TypeScript compilation was reported clean in SUMMARY (pre-existing errors in unrelated files only).

### Requirements Coverage

| Requirement | Source Plan | Description                                        | Status     | Evidence                                              |
| ----------- | ----------- | -------------------------------------------------- | ---------- | ----------------------------------------------------- |
| NRV-01      | 260405-nrv-PLAN.md | Fix GraphQL query referencing deleted model table | ✓ SATISFIED | All three commits (5665ef9, 9c8aad8, 7ae254a) present; no `model` table references remain |

### Anti-Patterns Found

None. No TODOs, placeholders, or stub patterns introduced. The `cacheModelsFromCatalog` no-op is intentional and documented with a comment explaining the rationale.

### Human Verification Required

None required for automated checks. The following is informational only:

**Runtime confirmation:** The "field 'model' not found in type: 'query_root'" error should no longer occur when the thread modeling workflow runs. This can be confirmed by loading a thread in the UI and verifying no GraphQL errors appear in the browser console.

### Gaps Summary

No gaps. All three must-have truths are verified, both artifacts pass all levels, both key links are wired, and the additional second fix (threadFromGQL / modelEnsembleFromGQL) is verified in the actual code.

Commits verified:
- `5665ef9` — neutralize cacheModelsFromCatalog, remove modelToGQL/threadModelsToGQL
- `9c8aad8` — delete dead GraphQL query files
- `7ae254a` — update threadFromGQL for modelcatalog_configuration (additional fix)

---

_Verified: 2026-04-05T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
