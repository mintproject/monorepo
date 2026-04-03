---
phase: quick
plan: 260328-oa7
subsystem: model-catalog-api/tests
tags: [integration-tests, junction, hasModelCategory, hasIntervention, vitest]
dependency_graph:
  requires: []
  provides: [junction-integration-tests-modelconfigurations, junction-integration-tests-modelconfigurationsetups, junction-integration-tests-parameters]
  affects: [model-catalog-api/src/__tests__/junction-integration.test.ts]
tech_stack:
  added: []
  patterns: [junctionCrudSuite helper pattern, describe.skipIf token guard, setup/teardown for prerequisite resources]
key_files:
  created: []
  modified:
    - model-catalog-api/src/__tests__/junction-integration.test.ts
decisions:
  - Used junctionCrudSuite() helper for the 3 new suites to keep tests DRY while leaving the original softwares suite untouched
  - Parameters suite uses setup/teardown callbacks to create/destroy Intervention prerequisites before and after the 5 core tests
  - Each new suite has its own afterAll cleanup tracking resources as {endpoint, id} pairs
metrics:
  duration: 5 minutes
  completed: 2026-03-28
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 260328-oa7: Add More Junction Integration Tests

**One-liner:** Extended junction-integration.test.ts with 3 new suites (modelconfigurations, modelconfigurationsetups, parameters) using a shared junctionCrudSuite() helper and intervention setup/teardown for the parameters suite.

## What Was Done

Extended `model-catalog-api/src/__tests__/junction-integration.test.ts` to cover three additional resource types with junction relationships:

1. **modelconfigurations + hasModelCategory** — tests the `modelcatalog_modelconfiguration_category` junction table
2. **modelconfigurationsetups + hasModelCategory** — tests the `modelcatalog_modelconfigurationsetup_category` junction table
3. **parameters + hasIntervention** — tests the `modelcatalog_parameter_intervention` junction table, with setup that creates prerequisite Intervention resources and teardown that deletes them

Each suite follows the same 5-test pattern as the existing softwares suite:
- POST with junction field -> GET verify junction persisted -> PUT replace junction (delete-then-insert) -> PUT without junction field (no-op guard) -> GET final verify

## Implementation Approach

A `junctionCrudSuite(config: JunctionTestConfig)` helper generates the full `describe.skipIf(!TOKEN)` block from a config object, avoiding copy-paste while keeping the original softwares suite unchanged. The parameters suite provides `setup` and `teardown` callbacks to create/delete Intervention dependencies independently of the parameter resource lifecycle.

## Commits

| Hash | Description |
|------|-------------|
| 7427672 | test: add junction integration tests for modelconfigurations, modelconfigurationsetups, and parameters |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- model-catalog-api/src/__tests__/junction-integration.test.ts — FOUND
- Commit 7427672 — FOUND
- `npx tsc --noEmit` (with project tsconfig) — passes cleanly
