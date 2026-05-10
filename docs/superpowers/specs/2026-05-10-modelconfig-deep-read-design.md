# Deepen GET /modelconfigurations/{id} Response (DataSetSpec + VariablePresentation)

**Date:** 2026-05-10
**Status:** Design approved, ready for plan
**Scope:** `model-catalog-api` (TypeScript/Fastify, Hasura-backed v2.0.0 REST)

## Goal

Single GET `/v2.0.0/modelconfigurations/{id}` returns the full
`ModelConfiguration → DataSetSpecification → VariablePresentation` tree in
one round trip. List route (`GET /v2.0.0/modelconfigurations`) and every
other resource's getById path remain byte-identical to current behavior for
the same dataset.

Eliminates the secondary per-id refetch in
`dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb` cell
`73002499` (currently fails with `KeyError: 'hasPresentation'`).

## Current State (verified)

- `model-catalog-api/src/service.ts:91` (list) and `:144` (getById) both call
  `getFieldSelection(resourceConfig.hasuraTable!)` from
  `model-catalog-api/src/hasura/field-maps.ts:555`. Selection is identical
  for both routes.
- `FIELD_SELECTIONS.modelcatalog_configuration`
  (`field-maps.ts:181-298`) selects scalars on `inputs.input` /
  `outputs.output` only — no `presentations` traversal.
- `FIELD_SELECTIONS.modelcatalog_dataset_specification` (`field-maps.ts:306`)
  already shows the deeper shape (`presentations.presentation { id label …
  standard_variable unit }`) — pattern to mirror.
- `model-catalog-api/src/mappers/response.ts:71` hard-caps recursion at
  `if (depth < 2)`. Walk:
  - depth 0: ModelConfiguration root → array rels expanded.
  - depth 1: DataSetSpec hoisted from `inputs.input` junction → array rels
    still expanded.
  - depth 2: VariablePresentation hoisted from `presentations.presentation`
    → relationships stripped, scalars survive.
- Resource registry (`model-catalog-api/src/mappers/resource-registry.ts`)
  already declares `modelconfigurations.hasInput → datasetspecifications`,
  `datasetspecifications.hasPresentation → variablepresentations`,
  `variablepresentations.hasStandardVariable / hasUnit`. No registry edit
  needed for read shape.

## Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| List vs by-id divergence | **Option A — second map** (`FIELD_SELECTIONS_BY_ID`) | Extends naturally for next resource needing read-depth bump. Keeps `service.ts` free of table-specific branches. |
| VP depth | **Depth-2 scalar VP only** | Notebook cell `73002499` and `cell-vp-get` need only `id`/`label`/`hasShortName` on VP. No `response.ts` edit. Future bump tracked as separate ticket. |
| `standard_variable` / `unit` on VP | **Skip** (scalars-only at depth 2) | depth<2 guard strips them. Selecting at Hasura layer would inflate query without surviving to wire. Documented limitation in field-map comment. |
| Test file | **New file** `read-shape-deep-e2e.test.ts` | `nested-write-e2e.test.ts` is 308 lines and write-focused. Read-shape concerns isolated. |
| `response.ts:71` global guard | **No edit** | Bounds payload size for every GET in the system. Per prompt: do not raise globally. |

## Architecture

### File-level changes

**`model-catalog-api/src/hasura/field-maps.ts`**

1. Add new exported `Record<string, string>`:
   ```ts
   export const FIELD_SELECTIONS_BY_ID: Record<string, string> = {
     modelcatalog_configuration: `…`,  // see body below
   }
   ```
2. Change `getFieldSelection(table: string)` →
   `getFieldSelection(table: string, mode: 'list' | 'byId' = 'list'): string`.
   When `mode === 'byId'` and `FIELD_SELECTIONS_BY_ID[table]` exists, return
   that. Else fall through to existing `FIELD_SELECTIONS[table]`.
   Default `'list'` keeps every other call site unchanged.

**`model-catalog-api/src/service.ts`**

- Line ~144 (`getById` path): pass `'byId'` as second arg to
  `getFieldSelection`.
- Line ~123 (`list` path): unchanged. Default `'list'` mode applies.

**`model-catalog-api/src/mappers/response.ts`**

- **No edit.** depth<2 guard preserved.

### Deep field selection body

`FIELD_SELECTIONS_BY_ID.modelcatalog_configuration`: copy of the shallow
`FIELD_SELECTIONS.modelcatalog_configuration` body, with this block appended
inside both `inputs.input { … }` and `outputs.output { … }`:

```graphql
presentations {
  presentation {
    id
    label
    description
    has_long_name
    has_short_name
    # NOTE: standard_variable / unit selected here would be stripped by
    # response.ts depth<2 guard (depth=2 at VP level). Skipped to avoid
    # wire bloat. Bump to depth-3 as a separate ticket if UI needs them.
  }
}
```

Mirror anchor comment near `FIELD_SELECTIONS.modelcatalog_dataset_specification`
(`field-maps.ts:306`):
```
// modelcatalog_configuration BY_ID variant duplicates this presentations
// selection — keep in sync.
```

All other rels (`parameters`, `causal_diagrams`, `time_intervals`,
`regions`, `authors`, `calibrated_variables`, `calibration_targets`,
`categories`, `software_version`, `author`, `parent_configuration`,
`child_configurations`) identical to shallow map. No deepening.

## Data Flow

GET `/v2.0.0/modelconfigurations/{id}`:

1. `service.ts.getById` calls
   `getFieldSelection('modelcatalog_configuration', 'byId')` → deep query.
2. Hasura returns single SQL JOIN result: config + nested
   `inputs[].input.presentations[].presentation`,
   `outputs[].output.presentations[].presentation`.
3. `transformRow(row, configCfg, 0)` (`response.ts:71`):
   - **depth 0** (config): `depth<2` true. Walk relationships. `hasInput`
     (array, junction) → for each junction row, recurse into `input` at
     depth 1. Hoist `is_optional` junction column → `isOptional` scalar on
     each result.
   - **depth 1** (DataSetSpec): `depth<2` true. Walk `hasPresentation`
     array rel → recurse into `presentation` at depth 2.
   - **depth 2** (VariablePresentation): `depth<2` false. Skip
     relationships. Scalars only: `id, label, description, has_long_name →
     hasLongName, has_short_name → hasShortName`. Wrap as `[value]` per
     v1.8.0 contract.
4. Empty-array elision (`response.ts:95`): zero rows in any rel array →
   key omitted entirely.

GET `/v2.0.0/modelconfigurations` (list): default `mode === 'list'` →
shallow query. `hasInput[]` rows have `id/label/description/hasFormat/
hasDimensionality/position` only. Byte-identical to pre-change.

## Tests

### E2E — new file `model-catalog-api/src/__tests__/e2e/read-shape-deep-e2e.test.ts`

1. **Deep read returns full tree**
   - Setup: POST nested Software bundle (mirror notebook): Software →
     Version → Config → 2 inputs + 3 outputs, each with VariablePresentation
     (`hasLongName`, `hasShortName`).
   - Extract `cfgId` from response chain via subsequent GETs (existing
     nested-write-e2e pattern).
   - GET `/v2.0.0/modelconfigurations/{cfgId}`.
   - Assert: `hasInput.length === 2`, `hasOutput.length === 3`.
   - Assert: each `hasInput[i]` and `hasOutput[i]` has
     `hasPresentation[0].id`, `hasPresentation[0].label`,
     `hasPresentation[0].hasShortName`.
   - Assert: `hasPresentation[0].standardVariable === undefined` and
     `hasPresentation[0].unit === undefined` (depth-2 cap documented).

2. **Junction column hoist preserved (bug-082 class)**
   - Setup: same fixture; one input POSTed with `isOptional: true`.
   - GET by id.
   - Assert: matching `hasInput[N].isOptional === true` (scalar, not
     `[true]`) AND `hasInput[N].hasPresentation` array still nested.

3. **List path stays lean**
   - GET `/v2.0.0/modelconfigurations` (paginated).
   - Find created config in result.
   - Assert: `hasInput[0].hasPresentation === undefined` (key absent).
   - Assert: `hasInput[0].id` and `hasInput[0].label` present (shallow
     shape preserved).

4. **Empty-array elision**
   - POST config with no inputs/outputs.
   - GET by id.
   - Assert: `hasInput === undefined`, `hasOutput === undefined`. No empty
     arrays in response body.

Cleanup: every test deletes created Software at end (cascade through tree)
per existing nested-write-e2e pattern.

### Unit — `model-catalog-api/src/hasura/__tests__/field-maps.test.ts`

(Create file if not present; otherwise extend.)

- `getFieldSelection('modelcatalog_configuration', 'byId')` → string
  contains `presentations`.
- `getFieldSelection('modelcatalog_configuration', 'list')` → string does
  NOT contain `presentations` under `inputs.input`.
- `getFieldSelection('modelcatalog_configuration')` (no mode) → shallow
  (default `'list'`).
- `getFieldSelection('modelcatalog_dataset_specification', 'byId')` →
  fallback to `FIELD_SELECTIONS` (no entry in `FIELD_SELECTIONS_BY_ID`).

### Run

```bash
cd model-catalog-api
npm run test:e2e -- read-shape-deep-e2e   # new e2e
npm run test:e2e                          # full e2e — all green
npm test                                  # full unit — all green
```

Use `run-e2e-hasura` skill for Hasura prerequisites and orphan cleanup.

## Acceptance Criteria

- Single GET `/v2.0.0/modelconfigurations/{id}` returns Config → DataSetSpec
  → VariablePresentation tree without follow-up requests.
- GET `/v2.0.0/modelconfigurations` list shape byte-identical to
  pre-change for the same dataset (snapshot or explicit assertions).
- All existing e2e + unit tests pass; new tests added per Tests section.
- No edit to `response.ts:71` global guard.
- Notebook cell `73002499` reads
  `config["hasInput"][0]["hasPresentation"][0]` directly without secondary
  refetch. (Notebook commit separate from API commit.)

## Out of Scope

- POST/PUT write path (already nested-tree via `buildJunctionInserts`).
- List route deep-read.
- Other resource types' getById deepening.
- JSON-LD `@context` generation.
- `MAX_DEPTH = 8` write cap.
- VP `standard_variable` / `unit` hoist (separate ticket if UI needs).
- UI bug-082 refetch path deletion (coordinate separately with UI work).

## Risks and Watchpoints

- **Payload bloat:** worst-case 5 inputs + 5 outputs × 1 VP each = ~10 extra
  nested objects × ~6 scalars per by-id GET. Acceptable. Capture sample
  size in PR description.
- **Hasura permissions:** read-side uses admin secret in dev, Bearer JWT in
  prod. Verify user role permits SELECT on
  `modelcatalog_dataset_specification_presentation` (junction) and
  `modelcatalog_variable_presentation` before claiming done. Smoke-check via
  Hasura console with `x-hasura-role: user`. Silent empty `presentations`
  → null indicates missing perm.
- **N+1 / SQL shape:** Hasura uses single SQL with LATERAL JOINs. Spot-check
  `EXPLAIN ANALYZE` via Hasura query analyzer on config with 5+ inputs. If
  degenerate, file follow-up; do not block this ticket.
- **bug-082 hoist regression:** `is_optional` is a junction-row scalar
  hoisted by `response.ts:115`. Adding sibling `presentations` does not
  collide. Test 2 asserts.
- **bug-087 / on_conflict.update_columns:** read path; not affected by this
  change. Mentioned for context — write path remains as fixed.

## Implementation Notes

- Default `mode = 'list'` on the new `getFieldSelection` signature is
  deliberate: every existing call site (list path, future tooling) stays
  on shallow map without explicit migration.
- `FIELD_SELECTIONS_BY_ID` keyed by Hasura table name (matches existing
  `FIELD_SELECTIONS` convention). Extending to other tables is one map
  entry plus zero code change.
- Mirror `presentations { presentation { … } }` block between
  `FIELD_SELECTIONS.modelcatalog_dataset_specification` (used when GET-ing
  a DataSetSpec by id directly) and the new
  `FIELD_SELECTIONS_BY_ID.modelcatalog_configuration` block. Drift between
  the two would manifest as different VP fields surfacing depending on
  entry point. Mirror comment flags this.
