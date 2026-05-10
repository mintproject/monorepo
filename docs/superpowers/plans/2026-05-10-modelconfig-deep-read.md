# ModelConfiguration Deep Read Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a single GET `/v2.0.0/modelconfigurations/{id}` return the full `ModelConfiguration → DataSetSpecification → VariablePresentation` tree without follow-up requests, while keeping the list route shape unchanged.

**Architecture:** Diverge field selection by route via a new `FIELD_SELECTIONS_BY_ID` map keyed by Hasura table. Extend `getFieldSelection(table, mode)` with a default `'list'` mode that preserves all existing call sites; `'byId'` mode returns the deep variant when an entry exists, else falls back to the shallow map. No edit to `response.ts` global depth guard. VP surfaces at depth 2 with scalar fields only (`id, label, description, hasLongName, hasShortName`).

**Tech Stack:** TypeScript, Fastify, Apollo Client, Hasura GraphQL, Vitest (unit + e2e), local Hasura at `http://graphql.mint.local`.

**Spec:** `docs/superpowers/specs/2026-05-10-modelconfig-deep-read-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `model-catalog-api/src/hasura/field-maps.ts` | Modify | Add `FIELD_SELECTIONS_BY_ID` map + extend `getFieldSelection` signature with `mode` param |
| `model-catalog-api/src/hasura/__tests__/field-maps.test.ts` | Create | Unit tests for `getFieldSelection(table, mode)` behavior + deep entry shape |
| `model-catalog-api/src/service.ts` | Modify | Pass `'byId'` mode at the getById call site (line 183) |
| `model-catalog-api/src/__tests__/e2e/read-shape-deep-e2e.test.ts` | Create | E2E read-shape tests against local Hasura |

---

## Task 1: Unit test for `getFieldSelection` mode parameter

**Files:**
- Create: `model-catalog-api/src/hasura/__tests__/field-maps.test.ts`
- Modify: `model-catalog-api/src/hasura/field-maps.ts:555-557`

- [ ] **Step 1: Write the failing unit test**

Create `model-catalog-api/src/hasura/__tests__/field-maps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getFieldSelection, FIELD_SELECTIONS_BY_ID } from '../field-maps.js';

describe('getFieldSelection — mode parameter', () => {
  it("default mode (no second arg) returns the shallow selection", () => {
    const sel = getFieldSelection('modelcatalog_configuration');
    expect(sel).toContain('inputs');
    // Shallow: no presentations under inputs.input
    expect(sel).not.toMatch(/inputs\s*{[^}]*input\s*{[^}]*presentations/s);
  });

  it("mode='list' returns the shallow selection", () => {
    const sel = getFieldSelection('modelcatalog_configuration', 'list');
    expect(sel).not.toMatch(/inputs\s*{[^}]*input\s*{[^}]*presentations/s);
  });

  it("mode='byId' for modelcatalog_configuration returns the deep selection", () => {
    const sel = getFieldSelection('modelcatalog_configuration', 'byId');
    expect(sel).toMatch(/inputs\s*{[^}]*input\s*{[^}]*presentations/s);
    expect(sel).toMatch(/outputs\s*{[^}]*output\s*{[^}]*presentations/s);
    expect(sel).toContain('has_short_name');
    expect(sel).toContain('has_long_name');
  });

  it("mode='byId' falls back to shallow for tables without a deep entry", () => {
    // dataset_specification has no FIELD_SELECTIONS_BY_ID entry yet
    expect(FIELD_SELECTIONS_BY_ID['modelcatalog_dataset_specification']).toBeUndefined();
    const sel = getFieldSelection('modelcatalog_dataset_specification', 'byId');
    // Should equal the shallow map's entry (already deep at this layer)
    expect(sel).toContain('presentations');
    expect(sel).toContain('standard_variable');
  });

  it("unknown table returns 'id label' fallback for both modes", () => {
    expect(getFieldSelection('totally_made_up_table')).toBe('id label');
    expect(getFieldSelection('totally_made_up_table', 'byId')).toBe('id label');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model-catalog-api && npx vitest run src/hasura/__tests__/field-maps.test.ts`

Expected: FAIL. Errors include `FIELD_SELECTIONS_BY_ID is not exported`, plus `getFieldSelection` does not accept a second argument (TypeScript error or test assertion failures because the signature does not declare `mode`).

- [ ] **Step 3: Implement minimal changes in `field-maps.ts`**

Open `model-catalog-api/src/hasura/field-maps.ts`. Locate the closing `};` of `FIELD_SELECTIONS` (currently line 549) and the existing `getFieldSelection` function (lines 555-557).

Insert a new exported map immediately after `FIELD_SELECTIONS`'s closing `};` and **before** the existing JSDoc above `getFieldSelection`:

```ts
/**
 * Per-table deep field selections used ONLY by the by-id read path.
 * Mirrors the structure of FIELD_SELECTIONS but adds an extra hop into
 * junction tables for resources that need a single-round-trip nested read.
 *
 * Lookup falls back to FIELD_SELECTIONS when no entry is present, so adding
 * a deep variant for a new table is purely additive — existing list/byId
 * behavior for every other table is preserved.
 *
 * Depth note: response.ts:71 caps recursion at depth<2. Anything at depth 2
 * (e.g. VariablePresentation hoisted from inputs.input.presentations) gets
 * its relationships stripped — only scalars survive to the wire. Selecting
 * `standard_variable` / `unit` here would be wasted work; bump
 * response.ts depth budget if that ever changes.
 */
export const FIELD_SELECTIONS_BY_ID: Record<string, string> = {
  // Populated in Task 2.
};
```

Then replace the existing `getFieldSelection` function (lines 555-557) with:

```ts
/**
 * Return the GraphQL field selection string for a given Hasura table name.
 *
 * @param tableName Hasura table name (e.g. `modelcatalog_configuration`).
 * @param mode `'list'` (default) returns the shallow selection used by list
 * routes. `'byId'` prefers FIELD_SELECTIONS_BY_ID when an entry exists,
 * else falls back to the shallow map.
 *
 * Falls back to `id label` if neither map has the table.
 */
export function getFieldSelection(
  tableName: string,
  mode: 'list' | 'byId' = 'list',
): string {
  if (mode === 'byId') {
    const deep = FIELD_SELECTIONS_BY_ID[tableName];
    if (deep) return deep;
  }
  return FIELD_SELECTIONS[tableName] ?? 'id label';
}
```

- [ ] **Step 4: Run test to verify the signature/fallback tests pass**

Run: `cd model-catalog-api && npx vitest run src/hasura/__tests__/field-maps.test.ts`

Expected: 4 passing (default mode, `'list'` mode, `'byId'` fallback to shallow, unknown table fallback). 1 still failing: `mode='byId' for modelcatalog_configuration returns the deep selection` — `FIELD_SELECTIONS_BY_ID` is empty. That is the next task.

- [ ] **Step 5: Commit**

```bash
cd /Users/mosorio/repos/mint
git add model-catalog-api/src/hasura/field-maps.ts model-catalog-api/src/hasura/__tests__/field-maps.test.ts
git commit -m "feat(model-catalog-api): add mode param to getFieldSelection

Adds FIELD_SELECTIONS_BY_ID map (empty) and extends getFieldSelection with a
'list' | 'byId' mode. Default 'list' preserves all existing call sites; 'byId'
returns the deep variant when present, else falls back to FIELD_SELECTIONS."
```

---

## Task 2: Add deep field entry for `modelcatalog_configuration`

**Files:**
- Modify: `model-catalog-api/src/hasura/field-maps.ts` (`FIELD_SELECTIONS_BY_ID` body)

- [ ] **Step 1: Run the still-failing test from Task 1 to confirm baseline**

Run: `cd model-catalog-api && npx vitest run src/hasura/__tests__/field-maps.test.ts`

Expected: 4 pass, 1 fail (`mode='byId' for modelcatalog_configuration returns the deep selection`). This is the test we drive next.

- [ ] **Step 2: Add the deep entry**

Open `model-catalog-api/src/hasura/field-maps.ts`. Replace the body of `FIELD_SELECTIONS_BY_ID` (currently empty, with the `// Populated in Task 2.` comment) with:

```ts
export const FIELD_SELECTIONS_BY_ID: Record<string, string> = {
  // =========================================================================
  // modelcatalog_configuration — deep variant for GET /modelconfigurations/{id}
  // Mirrors FIELD_SELECTIONS.modelcatalog_configuration but appends
  // `presentations { presentation { ... } }` inside both inputs.input{} and
  // outputs.output{}. VP at depth 2 — scalars only survive response.ts
  // depth<2 guard. Keep the presentations selection in sync with
  // FIELD_SELECTIONS.modelcatalog_dataset_specification.
  // =========================================================================
  modelcatalog_configuration: `
id
software_version_id
model_configuration_id
label
description
keywords
usage_notes
has_component_location
has_implementation_script_location
has_software_image
has_model_result_table
has_region
author_id
calibration_interval
calibration_method
parameter_assignment_method
valid_until
software_version {
  id
  label
}
author {
  id
  label
}
parent_configuration {
  id
  label
}
child_configurations {
  id
  label
  description
}
inputs {
  is_optional
  input {
    id
    label
    description
    has_format
    has_dimensionality
    position
    presentations {
      presentation {
        id
        label
        description
        has_long_name
        has_short_name
      }
    }
  }
}
outputs {
  output {
    id
    label
    description
    has_format
    has_dimensionality
    position
    presentations {
      presentation {
        id
        label
        description
        has_long_name
        has_short_name
      }
    }
  }
}
parameters {
  parameter {
    id
    label
    description
    has_data_type
    has_default_value
    has_minimum_accepted_value
    has_maximum_accepted_value
    has_fixed_value
    has_accepted_values
    position
    parameter_type
  }
}
causal_diagrams {
  causal_diagram {
    id
    label
  }
}
time_intervals {
  time_interval {
    id
    label
    description
    interval_value
    interval_unit
  }
}
regions {
  region {
    id
    label
    description
  }
}
authors {
  person {
    id
    label
  }
}
calibrated_variables {
  variable {
    id
    label
  }
}
calibration_targets {
  variable {
    id
    label
  }
}
categories {
  category {
    id
    label
  }
}
`.trim(),
};
```

- [ ] **Step 3: Add the mirror anchor comment to the shallow map**

Locate `FIELD_SELECTIONS.modelcatalog_dataset_specification` in the same file (around line 306). Add a comment immediately above its `presentations { presentation { ... } }` block (the existing inner block — do NOT modify the field selection itself):

```ts
  // =========================================================================
  // modelcatalog_dataset_specification
  // Columns: id, label, description, has_format, has_dimensionality, position
  // Array relationships (junction):
  //   presentations -> modelcatalog_dataset_specification_presentation
  //
  // NOTE: FIELD_SELECTIONS_BY_ID.modelcatalog_configuration mirrors the
  // `presentations { presentation { ... } }` block under inputs.input /
  // outputs.output. Keep these in sync; drift causes different VP shapes
  // depending on whether the client GETs a config or a dataset spec by id.
  // =========================================================================
  modelcatalog_dataset_specification: `
```

(Replace the existing comment block above `modelcatalog_dataset_specification:` with the version above. The only addition is the trailing NOTE paragraph.)

- [ ] **Step 4: Run the unit tests to verify all pass**

Run: `cd model-catalog-api && npx vitest run src/hasura/__tests__/field-maps.test.ts`

Expected: 5 passing.

- [ ] **Step 5: Run the full unit suite to confirm no regression**

Run: `cd model-catalog-api && npm test`

Expected: All tests pass. (No code outside `field-maps.ts` and the new test file changed; existing callers use the default `'list'` mode.)

- [ ] **Step 6: Commit**

```bash
cd /Users/mosorio/repos/mint
git add model-catalog-api/src/hasura/field-maps.ts
git commit -m "feat(model-catalog-api): deep field selection for modelconfigurations by-id

Adds FIELD_SELECTIONS_BY_ID.modelcatalog_configuration with presentations
nested under inputs.input and outputs.output. Mirror anchor comment added
to FIELD_SELECTIONS.modelcatalog_dataset_specification to flag the
duplicated VP selection. List path unchanged (default mode='list')."
```

---

## Task 3: Wire `getById` call site to use `'byId'` mode

**Files:**
- Modify: `model-catalog-api/src/service.ts:183`

- [ ] **Step 1: Confirm the call site**

Run: `cd model-catalog-api && grep -n 'getFieldSelection' src/service.ts`

Expected output:
```
16:import { getFieldSelection } from './hasura/field-maps.js'
123:    const fields = getFieldSelection(resourceConfig.hasuraTable!)
183:    const fields = getFieldSelection(resourceConfig.hasuraTable!)
```

Line 123 is inside `list(...)`. Line 183 is inside `getById(...)`. Only line 183 changes.

- [ ] **Step 2: Edit `service.ts:183`**

Open `model-catalog-api/src/service.ts`. Find line 183:

```ts
    const fields = getFieldSelection(resourceConfig.hasuraTable!)
```

Replace with:

```ts
    const fields = getFieldSelection(resourceConfig.hasuraTable!, 'byId')
```

Leave line 123 (list path) untouched.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd model-catalog-api && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Run full unit suite**

Run: `cd model-catalog-api && npm test`

Expected: All passing. (No unit test mocks the Hasura call directly — service.ts wiring is verified end-to-end via e2e tests in subsequent tasks.)

- [ ] **Step 5: Commit**

```bash
cd /Users/mosorio/repos/mint
git add model-catalog-api/src/service.ts
git commit -m "feat(model-catalog-api): wire getById to deep field selection

service.ts:183 now requests mode='byId' from getFieldSelection. List path
(line 123) keeps default mode='list'. End-to-end coverage in
read-shape-deep-e2e.test.ts."
```

---

## Task 4: E2E test — deep read returns full Config → DSS → VP tree

**Files:**
- Create: `model-catalog-api/src/__tests__/e2e/read-shape-deep-e2e.test.ts`

**Prerequisite:** Local Hasura must be reachable at `http://graphql.mint.local`. Use the `run-e2e-hasura` skill if `kubectl port-forward` / `/etc/hosts` are not configured.

- [ ] **Step 1: Create the new e2e file with the first test**

Create `model-catalog-api/src/__tests__/e2e/read-shape-deep-e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { assertHasuraReachable, buildE2EApp } from './setup.js';
import { cleanup, inject, trackId, uniqueId } from './helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  await assertHasuraReachable();
  app = await buildE2EApp();
});

afterAll(async () => {
  if (app) {
    await cleanup(app);
    await app.close();
  }
});

describe('read-shape-deep e2e — GET /modelconfigurations/{id}', () => {
  it('deep read returns Config → DSS → VP tree in one round trip', async () => {
    // Setup: POST a nested Software → Version → Config bundle with 2 inputs
    // and 3 outputs, each input/output carrying a VariablePresentation.
    const softwareId = uniqueId('software');
    const versionId = uniqueId('softwareversion');
    const configId = uniqueId('modelconfiguration');
    const inputAId = uniqueId('datasetspecification');
    const inputBId = uniqueId('datasetspecification');
    const outputAId = uniqueId('datasetspecification');
    const outputBId = uniqueId('datasetspecification');
    const outputCId = uniqueId('datasetspecification');
    const vpInAId = uniqueId('variablepresentation');
    const vpInBId = uniqueId('variablepresentation');
    const vpOutAId = uniqueId('variablepresentation');
    const vpOutBId = uniqueId('variablepresentation');
    const vpOutCId = uniqueId('variablepresentation');

    const post = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: softwareId,
      type: ['Software'],
      label: ['sw-deepread'],
      hasVersion: [
        {
          id: versionId,
          type: ['SoftwareVersion'],
          label: ['v-deepread'],
          hasConfiguration: [
            {
              id: configId,
              type: ['ModelConfiguration'],
              label: ['cfg-deepread'],
              hasInput: [
                {
                  id: inputAId,
                  type: ['DataSetSpecification'],
                  label: ['input-A'],
                  hasPresentation: [
                    {
                      id: vpInAId,
                      type: ['VariablePresentation'],
                      label: ['vp-input-A'],
                      hasLongName: ['Input A long'],
                      hasShortName: ['input-a'],
                    },
                  ],
                },
                {
                  id: inputBId,
                  type: ['DataSetSpecification'],
                  label: ['input-B'],
                  hasPresentation: [
                    {
                      id: vpInBId,
                      type: ['VariablePresentation'],
                      label: ['vp-input-B'],
                      hasLongName: ['Input B long'],
                      hasShortName: ['input-b'],
                    },
                  ],
                },
              ],
              hasOutput: [
                {
                  id: outputAId,
                  type: ['DataSetSpecification'],
                  label: ['output-A'],
                  hasPresentation: [
                    {
                      id: vpOutAId,
                      type: ['VariablePresentation'],
                      label: ['vp-output-A'],
                      hasLongName: ['Output A long'],
                      hasShortName: ['output-a'],
                    },
                  ],
                },
                {
                  id: outputBId,
                  type: ['DataSetSpecification'],
                  label: ['output-B'],
                  hasPresentation: [
                    {
                      id: vpOutBId,
                      type: ['VariablePresentation'],
                      label: ['vp-output-B'],
                      hasLongName: ['Output B long'],
                      hasShortName: ['output-b'],
                    },
                  ],
                },
                {
                  id: outputCId,
                  type: ['DataSetSpecification'],
                  label: ['output-C'],
                  hasPresentation: [
                    {
                      id: vpOutCId,
                      type: ['VariablePresentation'],
                      label: ['vp-output-C'],
                      hasLongName: ['Output C long'],
                      hasShortName: ['output-c'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(post.statusCode).toBeGreaterThanOrEqual(200);
    expect(post.statusCode).toBeLessThan(300);

    // Track for teardown (reverse order — leaves first).
    trackId('variablepresentations', vpInAId);
    trackId('variablepresentations', vpInBId);
    trackId('variablepresentations', vpOutAId);
    trackId('variablepresentations', vpOutBId);
    trackId('variablepresentations', vpOutCId);
    trackId('datasetspecifications', inputAId);
    trackId('datasetspecifications', inputBId);
    trackId('datasetspecifications', outputAId);
    trackId('datasetspecifications', outputBId);
    trackId('datasetspecifications', outputCId);
    trackId('modelconfigurations', configId);
    trackId('softwareversions', versionId);
    trackId('softwares', softwareId);

    // Act: single GET on /modelconfigurations/{id}.
    const get = await inject(
      app,
      'GET',
      `/v2.0.0/modelconfigurations/${encodeURIComponent(configId)}`,
    );
    expect(get.statusCode).toBe(200);

    type VP = { id: string; label?: string[]; hasShortName?: string[]; hasLongName?: string[]; standardVariable?: unknown; unit?: unknown };
    type DSS = { id: string; label?: string[]; hasPresentation?: VP[] };
    type Cfg = { id: string; hasInput?: DSS[]; hasOutput?: DSS[] };
    const cfg = (Array.isArray(get.body) ? get.body[0] : get.body) as Cfg;

    // Assert: top-level array sizes.
    expect(cfg.id).toBe(configId);
    expect(cfg.hasInput?.length).toBe(2);
    expect(cfg.hasOutput?.length).toBe(3);

    // Assert: every input/output has a populated VP at hasPresentation[0].
    for (const dss of [...(cfg.hasInput ?? []), ...(cfg.hasOutput ?? [])]) {
      expect(dss.hasPresentation).toBeDefined();
      expect(dss.hasPresentation!.length).toBeGreaterThan(0);
      const vp = dss.hasPresentation![0];
      expect(typeof vp.id).toBe('string');
      expect(vp.label).toBeDefined();
      expect(vp.hasShortName).toBeDefined();
    }

    // Assert: depth-2 cap — VP relationships are stripped.
    const firstVp = cfg.hasOutput![0].hasPresentation![0];
    expect(firstVp.standardVariable).toBeUndefined();
    expect(firstVp.unit).toBeUndefined();

    // Assert: VP ids match what was POSTed (set comparison — order is
    // not contract-stable across the junction read).
    const inVpIds = new Set(cfg.hasInput!.flatMap((d) => d.hasPresentation!.map((v) => v.id)));
    const outVpIds = new Set(cfg.hasOutput!.flatMap((d) => d.hasPresentation!.map((v) => v.id)));
    expect(inVpIds).toEqual(new Set([vpInAId, vpInBId]));
    expect(outVpIds).toEqual(new Set([vpOutAId, vpOutBId, vpOutCId]));
  });
});
```

- [ ] **Step 2: Run the new e2e test**

Run: `cd model-catalog-api && npm run test:e2e -- read-shape-deep-e2e`

Expected: PASS. The deep field selection from Task 2 plus the wiring in Task 3 should already produce the asserted shape. If FAIL, inspect:
- `getFieldSelection` returning shallow → re-check Task 3 edit at `service.ts:183`.
- `hasPresentation` missing → check `FIELD_SELECTIONS_BY_ID.modelcatalog_configuration` body matches Task 2 exactly.
- VP id mismatch → cleanup orphans from a previous failed run with `RUN_ID` SQL hint printed by `cleanup()`.

- [ ] **Step 3: Commit**

```bash
cd /Users/mosorio/repos/mint
git add model-catalog-api/src/__tests__/e2e/read-shape-deep-e2e.test.ts
git commit -m "test(model-catalog-api): e2e read-shape — deep Config tree

GET /v2.0.0/modelconfigurations/{id} returns the full
Config → DataSetSpec → VariablePresentation tree in one round trip.
Asserts VP id/label/hasShortName surface; standardVariable/unit absent
(depth-2 cap)."
```

---

## Task 5: E2E test — `isOptional` junction-column hoist preserved (bug-082 class)

**Files:**
- Modify: `model-catalog-api/src/__tests__/e2e/read-shape-deep-e2e.test.ts`

- [ ] **Step 1: Append the second test to the existing `describe` block**

Open `read-shape-deep-e2e.test.ts`. Inside the `describe('read-shape-deep e2e — GET /modelconfigurations/{id}', ...)` block, append the following test after the first `it(...)`:

```ts
  it('preserves isOptional junction-column hoist alongside hasPresentation', async () => {
    const softwareId = uniqueId('software');
    const versionId = uniqueId('softwareversion');
    const configId = uniqueId('modelconfiguration');
    const inputId = uniqueId('datasetspecification');
    const vpId = uniqueId('variablepresentation');

    const post = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: softwareId,
      type: ['Software'],
      label: ['sw-isopt'],
      hasVersion: [
        {
          id: versionId,
          type: ['SoftwareVersion'],
          label: ['v-isopt'],
          hasConfiguration: [
            {
              id: configId,
              type: ['ModelConfiguration'],
              label: ['cfg-isopt'],
              hasInput: [
                {
                  id: inputId,
                  type: ['DataSetSpecification'],
                  label: ['optional-input'],
                  isOptional: true,
                  hasPresentation: [
                    {
                      id: vpId,
                      type: ['VariablePresentation'],
                      label: ['vp-isopt'],
                      hasShortName: ['opt-vp'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(post.statusCode).toBeGreaterThanOrEqual(200);
    expect(post.statusCode).toBeLessThan(300);

    trackId('variablepresentations', vpId);
    trackId('datasetspecifications', inputId);
    trackId('modelconfigurations', configId);
    trackId('softwareversions', versionId);
    trackId('softwares', softwareId);

    const get = await inject(
      app,
      'GET',
      `/v2.0.0/modelconfigurations/${encodeURIComponent(configId)}`,
    );
    expect(get.statusCode).toBe(200);

    type VP = { id: string };
    type DSS = { id: string; isOptional?: boolean; hasPresentation?: VP[] };
    type Cfg = { id: string; hasInput?: DSS[] };
    const cfg = (Array.isArray(get.body) ? get.body[0] : get.body) as Cfg;

    const target = cfg.hasInput?.find((d) => d.id === inputId);
    expect(target).toBeDefined();
    // Junction-column hoist surfaces as a SCALAR boolean (not [true]).
    expect(target!.isOptional).toBe(true);
    // hasPresentation is still nested.
    expect(target!.hasPresentation).toBeDefined();
    expect(target!.hasPresentation![0].id).toBe(vpId);
  });
```

- [ ] **Step 2: Run the test**

Run: `cd model-catalog-api && npm run test:e2e -- read-shape-deep-e2e`

Expected: 2 passing tests.

- [ ] **Step 3: Commit**

```bash
cd /Users/mosorio/repos/mint
git add model-catalog-api/src/__tests__/e2e/read-shape-deep-e2e.test.ts
git commit -m "test(model-catalog-api): e2e isOptional hoist preserved with deep read

bug-082 class regression check — adding nested hasPresentation under
inputs.input does not regress the is_optional → isOptional scalar hoist
in response.ts:104-122."
```

---

## Task 6: E2E test — list path stays lean

**Files:**
- Modify: `model-catalog-api/src/__tests__/e2e/read-shape-deep-e2e.test.ts`

- [ ] **Step 1: Append the third test**

Inside the same `describe` block, append after the previous test:

```ts
  it('list path GET /modelconfigurations does NOT include hasPresentation', async () => {
    // Reuse fixture pattern: POST a config with 1 input + 1 VP, then list.
    const softwareId = uniqueId('software');
    const versionId = uniqueId('softwareversion');
    const configId = uniqueId('modelconfiguration');
    const inputId = uniqueId('datasetspecification');
    const vpId = uniqueId('variablepresentation');

    const post = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: softwareId,
      type: ['Software'],
      label: ['sw-list-lean'],
      hasVersion: [
        {
          id: versionId,
          type: ['SoftwareVersion'],
          label: ['v-list-lean'],
          hasConfiguration: [
            {
              id: configId,
              type: ['ModelConfiguration'],
              label: ['cfg-list-lean'],
              hasInput: [
                {
                  id: inputId,
                  type: ['DataSetSpecification'],
                  label: ['input-list-lean'],
                  hasPresentation: [
                    {
                      id: vpId,
                      type: ['VariablePresentation'],
                      label: ['vp-list-lean'],
                      hasShortName: ['list-lean-vp'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(post.statusCode).toBeGreaterThanOrEqual(200);
    expect(post.statusCode).toBeLessThan(300);

    trackId('variablepresentations', vpId);
    trackId('datasetspecifications', inputId);
    trackId('modelconfigurations', configId);
    trackId('softwareversions', versionId);
    trackId('softwares', softwareId);

    // List with a label filter narrows to our row.
    const list = await inject(
      app,
      'GET',
      '/v2.0.0/modelconfigurations?label=cfg-list-lean&per_page=10',
    );
    expect(list.statusCode).toBe(200);

    type VP = { id: string };
    type DSS = { id: string; label?: string[]; hasPresentation?: VP[] };
    type Cfg = { id: string; hasInput?: DSS[] };
    const rows = list.body as Cfg[];
    expect(Array.isArray(rows)).toBe(true);

    const row = rows.find((r) => r.id === configId);
    expect(row).toBeDefined();
    expect(row!.hasInput?.length).toBeGreaterThan(0);
    const firstInput = row!.hasInput![0];
    // Shallow shape preserved: id + label present, hasPresentation absent.
    expect(firstInput.id).toBeDefined();
    expect(firstInput.label).toBeDefined();
    expect(firstInput.hasPresentation).toBeUndefined();
  });
```

- [ ] **Step 2: Run all e2e tests in this file**

Run: `cd model-catalog-api && npm run test:e2e -- read-shape-deep-e2e`

Expected: 3 passing tests.

- [ ] **Step 3: Commit**

```bash
cd /Users/mosorio/repos/mint
git add model-catalog-api/src/__tests__/e2e/read-shape-deep-e2e.test.ts
git commit -m "test(model-catalog-api): e2e list path stays lean

GET /v2.0.0/modelconfigurations (list) keeps the shallow input shape —
hasPresentation absent. Confirms divergence between list and by-id
field selection."
```

---

## Task 7: E2E test — empty-array elision

**Files:**
- Modify: `model-catalog-api/src/__tests__/e2e/read-shape-deep-e2e.test.ts`

- [ ] **Step 1: Append the fourth test**

Inside the same `describe` block, append:

```ts
  it('config with zero inputs/outputs returns no hasInput/hasOutput keys', async () => {
    const softwareId = uniqueId('software');
    const versionId = uniqueId('softwareversion');
    const configId = uniqueId('modelconfiguration');

    const post = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: softwareId,
      type: ['Software'],
      label: ['sw-empty'],
      hasVersion: [
        {
          id: versionId,
          type: ['SoftwareVersion'],
          label: ['v-empty'],
          hasConfiguration: [
            {
              id: configId,
              type: ['ModelConfiguration'],
              label: ['cfg-empty'],
              // No hasInput / hasOutput.
            },
          ],
        },
      ],
    });
    expect(post.statusCode).toBeGreaterThanOrEqual(200);
    expect(post.statusCode).toBeLessThan(300);

    trackId('modelconfigurations', configId);
    trackId('softwareversions', versionId);
    trackId('softwares', softwareId);

    const get = await inject(
      app,
      'GET',
      `/v2.0.0/modelconfigurations/${encodeURIComponent(configId)}`,
    );
    expect(get.statusCode).toBe(200);

    type Cfg = { id: string; hasInput?: unknown; hasOutput?: unknown };
    const cfg = (Array.isArray(get.body) ? get.body[0] : get.body) as Cfg;
    expect(cfg.id).toBe(configId);
    // Empty-array elision (response.ts:95) — keys must be absent, not [].
    expect(cfg.hasInput).toBeUndefined();
    expect(cfg.hasOutput).toBeUndefined();
  });
```

- [ ] **Step 2: Run all e2e tests in this file**

Run: `cd model-catalog-api && npm run test:e2e -- read-shape-deep-e2e`

Expected: 4 passing tests.

- [ ] **Step 3: Commit**

```bash
cd /Users/mosorio/repos/mint
git add model-catalog-api/src/__tests__/e2e/read-shape-deep-e2e.test.ts
git commit -m "test(model-catalog-api): e2e empty-array elision on by-id read

Config with zero inputs/outputs returns no hasInput/hasOutput keys
(response.ts:95). Confirms the deep read does not introduce empty arrays
that would diverge from v1.8.0 client contract."
```

---

## Task 8: Full regression run

**Files:** none (verification only)

- [ ] **Step 1: Run full unit suite**

Run: `cd model-catalog-api && npm test`

Expected: All passing. No new failures vs `main`.

- [ ] **Step 2: Run full e2e suite**

Run: `cd model-catalog-api && npm run test:e2e`

Expected: All passing — `nested-write-e2e`, `junction-e2e`, `smoke-e2e`, AND the new `read-shape-deep-e2e` all green. If any pre-existing e2e flake surfaces, document it in the PR description but do not fix unrelated tests in this branch.

If a test fails because of an orphaned fixture from a prior failed run, follow the `RUN_ID=...` cleanup hint printed by `cleanup()` in `helpers.ts:81-89`.

- [ ] **Step 3: Verify TypeScript build is clean**

Run: `cd model-catalog-api && npm run build`

Expected: `tsc` exits 0.

- [ ] **Step 4: No commit**

Verification step only. No code changed.

---

## Task 9: PR-ready hygiene

**Files:** none (status check + planning summary)

- [ ] **Step 1: Inspect commit log on the working branch**

Run: `cd /Users/mosorio/repos/mint && git log --oneline main..HEAD`

Expected: 8 commits from Tasks 1-7 (excluding spec doc commit from brainstorming and verification-only Task 8). Squash-vs-keep is left to PR-author preference; this plan does not prescribe.

- [ ] **Step 2: Capture sample payload size for PR description**

Run a quick sanity check — POST a 5-input × 5-output × 1-VP-each config via curl/REST client (or reuse the Task 4 fixture) and capture the byte size of the GET-by-id response body. Note approximate size in the PR description for reviewer reference (per spec "Risks: Payload bloat" section).

This is a manual step — no code change. If it is impractical (no Hasura access at PR time), state explicitly in the PR description that payload-size measurement is deferred.

- [ ] **Step 3: Verify Hasura permissions for non-admin role (manual)**

Open the local Hasura console at `http://graphql.mint.local/console`. Under `Data → modelcatalog → modelcatalog_dataset_specification_presentation → Permissions`, confirm that the `user` role permits SELECT on the columns referenced by the deep selection (`presentation_id`). Same check on `modelcatalog_variable_presentation` for `id, label, description, has_long_name, has_short_name`.

If permissions are missing, file a follow-up ticket — do NOT silently widen permissions in this PR.

- [ ] **Step 4: Push branch and open PR**

Branch already exists per session context (`fix/bug-087-junction-on-conflict-label-clobber`). User decides whether to land this work on a new branch or continue here. Either way, PR description should include:
- Link to spec: `docs/superpowers/specs/2026-05-10-modelconfig-deep-read-design.md`.
- Sample payload size (from Step 2).
- Note that notebook cell `73002499` will be updated in a separate commit after this lands.
- Risk: VP `standard_variable`/`unit` not surfaced (depth-2 cap, documented).

This is a planning step, not an automated commit. Hand off to the user before pushing.

---

## Out of Scope (per spec)

- POST/PUT write path changes.
- List route deep-read.
- Other resource types' getById deepening.
- JSON-LD `@context`.
- `MAX_DEPTH = 8` write cap.
- response.ts global guard edit.
- VP `standard_variable` / `unit` hoist (separate ticket).
- UI bug-082 refetch path deletion.
- Notebook `01_minimal_modeler_register_modflow2000.ipynb` cell `73002499` update — separate follow-up commit, not blocking this plan.
