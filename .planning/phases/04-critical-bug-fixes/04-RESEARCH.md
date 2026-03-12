# Phase 4: Critical Bug Fixes — Research

**Researched:** 2026-03-11
**Domain:** Hasura schema migration + PostgreSQL DDL + TypeScript GraphQL handler fix
**Confidence:** HIGH — all findings from direct source-code and migration inspection

---

## Summary

Phase 4 closes two critical gaps identified in the v2.0 milestone audit. Both are straightforward surgical fixes with no new dependencies and no architectural changes.

**Bug 1 — `has_accepted_values` column missing from `modelcatalog_parameter`:** The Ensemble Manager GraphQL queries (`get-modelcatalog-setup.graphql` and `get-modelcatalog-configuration.graphql`) both request `has_accepted_values` at line 19. The column was never added to the `modelcatalog_parameter` table in any migration (1771105509000 through 1771200001000), and it is absent from Hasura's `tables.yaml` permission column lists. Every Ensemble Manager model run fetch fails with a Hasura field-not-found error at runtime.

**Bug 2 — Wrong column name in `custom_datasetspecifications_get`:** The handler queries junction tables `modelcatalog_configuration_input` and `modelcatalog_configuration_output` with a WHERE filter using `model_configuration_id`. The actual column name on both tables (per migration 1771105509000) is `configuration_id`. The existing integration test (Plan 02-13) validates that the GraphQL variable `cfgId` is set correctly, but does NOT check the WHERE clause column name in the embedded query string — so the bug survived the test suite. Every call to `GET /v2.0.0/custom/datasetspecifications?configurationid=X` returns 500.

**Primary recommendation:** One combined plan (04-01) with three file changes: (1) new Hasura migration adding `has_accepted_values TEXT[]`, (2) `tables.yaml` update adding the column to permissions and updating `field-maps.ts` to include it in SELECT, (3) two-line fix in `custom-handlers.ts` changing `model_configuration_id` to `configuration_id` in the WHERE filters.

---

## Standard Stack

### Core (no changes from prior phases)
| Component | Version/Location | Purpose | Notes |
|-----------|-----------------|---------|-------|
| Hasura migrations | `graphql_engine/migrations/` | PostgreSQL DDL via versioned SQL files | Existing pattern: `BEGIN; ... COMMIT;` with up.sql/down.sql |
| Hasura metadata | `graphql_engine/metadata/tables.yaml` | Table tracking, permissions, relationships | Direct YAML edit — no CLI required in planning |
| model-catalog-api | `/Users/mosorio/repos/model-catalog-api` | Separate repo, the custom handler lives here | Not a submodule of mint repo |
| TypeScript | model-catalog-api source | Handler code | Same compile/test stack as Phase 2 |

### No New Dependencies
Phase 4 introduces zero new libraries. All tools and patterns are from Phases 1–3.

---

## Architecture Patterns

### Pattern 1: Hasura Migration for ADD COLUMN

**What:** Add a new nullable column to an existing table. Because `modelcatalog_parameter` already has rows (populated by the ETL/data migration in Phase 1), the column MUST be nullable.

**Migration naming convention:** Sequential timestamp from last migration `1771200001000`. Use `1771200002000` as the next timestamp.

**up.sql pattern:**
```sql
BEGIN;

ALTER TABLE modelcatalog_parameter
    ADD COLUMN has_accepted_values TEXT[];

COMMIT;
```

**down.sql pattern:**
```sql
BEGIN;

ALTER TABLE modelcatalog_parameter
    DROP COLUMN IF EXISTS has_accepted_values;

COMMIT;
```

**Key constraint:** Do NOT use `NOT NULL` — existing rows have no value for this column. PostgreSQL will set the new column to NULL for all existing rows by default. This is correct behavior.

**Column type justification:** The OWL/OpenAPI spec defines `hasAcceptedValues` as `array` of `string` (`Optional[List[str]]` in the FastAPI model at `model-catalog-fastapi/src/openapi_server/models/parameter.py:50`). PostgreSQL `TEXT[]` is the canonical mapping. No other `TEXT[]` columns exist in the schema yet, but PostgreSQL handles them natively. Hasura exposes `TEXT[]` as a scalar array in GraphQL (type `[String]`).

### Pattern 2: Hasura Metadata Column Permission Update

**What:** After adding the column via migration, Hasura must be told to expose it. The `tables.yaml` entry for `modelcatalog_parameter` (around line 3391) has permission `columns` lists for `insert`, `select`, and `update` roles. All three lists use the anchor/alias pattern (`&id006`/`*id006`). Add `has_accepted_values` to the anchor list — it propagates to all aliases automatically.

**Current anchor block (lines ~3430–3443):**
```yaml
      columns: &id006
      - id
      - label
      - description
      - has_data_type
      - has_default_value
      - has_minimum_accepted_value
      - has_maximum_accepted_value
      - has_fixed_value
      - position
      - parameter_type
```

**After fix:** Add `- has_accepted_values` to `&id006`. It will automatically apply to `select_permissions` (anonymous + user) and `update_permissions` via YAML alias resolution.

### Pattern 3: field-maps.ts Column Selection Update

**What:** The `modelcatalog_parameter` field selection in `model-catalog-api/src/hasura/field-maps.ts` (around line 372) lists every column to SELECT. It currently omits `has_accepted_values`. Add it so the generic CRUD service returns the field in API responses.

**Location:** `modelcatalog_parameter` entry, after `parameter_type`, before `interventions { ... }`.

**Comment line to update:** The comment above the entry says `Columns: id, label, description, has_data_type, has_default_value, has_minimum_accepted_value, has_maximum_accepted_value, has_fixed_value, position, parameter_type`. Add `has_accepted_values` to this comment for accuracy.

### Pattern 4: Fix GraphQL WHERE Clause Column Name

**What:** In `custom-handlers.ts` lines 494 and 497, the WHERE filter uses `model_configuration_id`. The actual column name on both `modelcatalog_configuration_input` and `modelcatalog_configuration_output` is `configuration_id` (verified from migration 1771105509000 and Hasura tables.yaml).

**Exact lines to change (verified from source):**

Line 494:
```typescript
// WRONG:
modelcatalog_configuration_input(where: { model_configuration_id: { _eq: $cfgId } }) {
// CORRECT:
modelcatalog_configuration_input(where: { configuration_id: { _eq: $cfgId } }) {
```

Line 497:
```typescript
// WRONG:
modelcatalog_configuration_output(where: { model_configuration_id: { _eq: $cfgId } }) {
// CORRECT:
modelcatalog_configuration_output(where: { configuration_id: { _eq: $cfgId } }) {
```

**Why the test did not catch this:** The integration test at line 466 of `integration.test.ts` mocks `readClient.query()` to return canned data regardless of the query string. It asserts `callArgs.variables.cfgId` (the variable value) but never inspects the query string for the column name. The fix to the handler does NOT require changing the test — the test remains valid after the fix. However, an enhanced assertion checking `callArgs.query` for `configuration_id` would improve regression coverage.

### Anti-Patterns to Avoid

- **NOT NULL on new column:** Existing rows will fail constraint if added as NOT NULL without a default. Always nullable for ADD COLUMN on populated tables.
- **Adding `has_accepted_values` to SETUP_FIELDS / CONFIGURATION_FIELDS in custom-handlers.ts:** These are the deep nested query field selections for the `/custom/model` and `/custom/configurationsetups` handlers. Do NOT add `has_accepted_values` there — those handlers serve a different purpose and expanding field selections would be scope creep.
- **Modifying the GraphQL query files in mint-ensemble-manager:** The `.graphql` files correctly request `has_accepted_values`. They are NOT broken — the schema was missing the column. Do not remove `has_accepted_values` from the queries; add the column instead.
- **Using TEXT (scalar) instead of TEXT[] (array):** The field represents a list of accepted values. Using TEXT would require serialization/deserialization logic and would break API response compatibility with v1.8.0 format.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column migration | Custom ALTER TABLE in application code | Hasura migration file | Migration files give rollback, audit trail, ordered apply |
| Metadata update | Hasura console manual click | Direct `tables.yaml` edit | Console changes aren't committed; YAML edit is in version control |
| Column name correction | Dynamic WHERE builder | Fix the hardcoded string literal | It's a typo, not a design problem |

---

## Common Pitfalls

### Pitfall 1: YAML Anchor Pattern in tables.yaml
**What goes wrong:** Edit only one of the three permission blocks (insert/select/update) and miss the others.
**Why it happens:** The `&id006` / `*id006` YAML anchor/alias pattern means you only need to edit the ANCHOR definition — all aliases inherit the change. If you edit an alias directly instead of the anchor, you break the alias and have inconsistent permissions.
**How to avoid:** Edit ONLY the anchor block (`columns: &id006`). Do not touch `*id006` usages — they auto-resolve.
**Warning signs:** If you see `columns:` listed twice for the same table entry without `&` prefix, you've edited an alias block.

### Pitfall 2: Migration Timestamp Collision
**What goes wrong:** Two migrations with the same timestamp prefix cause apply-order ambiguity.
**Why it happens:** Hasura applies migrations in lexicographic order of directory names. The timestamp must be unique and greater than all existing migrations.
**How to avoid:** Last migration is `1771200001000`. Use `1771200002000` for the new migration.
**Warning signs:** `hasura migrate status` shows two migrations at the same timestamp.

### Pitfall 3: column_name in WHERE vs. Variable Name
**What goes wrong:** Confusing the GraphQL variable name (`$cfgId`) with the Hasura column name (`configuration_id`). The bug is in the column name, not the variable name.
**Why it happens:** The Plan 02-13 fix correctly set `cfgId: fullCfgId` (variable value). But the WHERE clause `{ model_configuration_id: { _eq: $cfgId } }` uses the COLUMN name which was wrong. These are two different things.
**How to avoid:** When fixing, change BOTH occurrences of `model_configuration_id` in the WHERE filter — lines 494 AND 497 (there are two junction tables being queried).
**Warning signs:** Only changing one occurrence leaves one of the two junction queries (input or output) still broken.

### Pitfall 4: TypeScript Type for has_accepted_values in Adapter
**What goes wrong:** The `CatalogParameter` interface in `mint-ensemble-manager/src/classes/mint/model-catalog-graphql-adapter.ts` line 51 types `has_accepted_values` as `string` (not `string[]`). After the migration, Hasura will return `[String]` (array) for this field.
**Why it matters:** The adapter code `parameter.has_accepted_values || ""` will receive an array, not a string. An empty array `[]` is truthy in JavaScript, so `[] || ""` returns `[]` (not `""`). The downstream `accepted_values` field in `mint-types.ts` expects `string[]`, so this actually aligns better — but the `|| ""` fallback will return `[]` for parameters with no accepted values (array) not `""` (string).
**Recommendation:** Update the `CatalogParameter` interface to type `has_accepted_values` as `string[] | null` and change the fallback from `|| ""` to `|| []`. This is a correctness fix but not strictly required for E2E to work (the query will succeed either way — the runtime type mismatch is benign for the E2E success criterion).
**Scope decision:** This adapter type fix is INCLUDED in the plan scope since it directly affects how `has_accepted_values` is consumed. Without it, the TypeScript interface is incorrect post-migration.

---

## Code Examples

### New Migration up.sql
```sql
-- Source: Direct inspection of mint/graphql_engine/migrations/1771200001000_fk_migration_parameter/up.sql pattern
BEGIN;

-- Migration 3: Add has_accepted_values column to modelcatalog_parameter
-- Column is TEXT[] (array of strings) matching the OWL property definition:
-- https://w3id.org/okn/o/sd#hasAcceptedValues
-- Column is nullable because existing rows have no accepted values data.

ALTER TABLE modelcatalog_parameter
    ADD COLUMN has_accepted_values TEXT[];

COMMIT;
```

### New Migration down.sql
```sql
BEGIN;

ALTER TABLE modelcatalog_parameter
    DROP COLUMN IF EXISTS has_accepted_values;

COMMIT;
```

### tables.yaml permission columns update
```yaml
# In the modelcatalog_parameter entry, update the anchor block:
      columns: &id006
      - id
      - label
      - description
      - has_data_type
      - has_default_value
      - has_minimum_accepted_value
      - has_maximum_accepted_value
      - has_fixed_value
      - has_accepted_values      # ADD THIS LINE
      - position
      - parameter_type
```

### field-maps.ts update
```typescript
// Source: model-catalog-api/src/hasura/field-maps.ts lines 372-390
  // =========================================================================
  // modelcatalog_parameter
  // Columns: id, label, description, has_data_type, has_default_value,
  //          has_minimum_accepted_value, has_maximum_accepted_value,
  //          has_fixed_value, has_accepted_values, position, parameter_type
  // Array relationships (junction):
  //   interventions -> modelcatalog_parameter_intervention -> intervention
  // =========================================================================
  modelcatalog_parameter: `
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
interventions {
  intervention {
    id
    label
  }
}
`.trim(),
```

### custom-handlers.ts WHERE clause fix
```typescript
// Source: model-catalog-api/src/custom-handlers.ts lines 492-501
// Fix: change model_configuration_id → configuration_id in BOTH places

    const cfgQuery = `
      query CustomDatasetSpecificationsByConfig($cfgId: String!) {
        modelcatalog_configuration_input(where: { configuration_id: { _eq: $cfgId } }) {
          input { id label description has_format has_dimensionality position }
        }
        modelcatalog_configuration_output(where: { configuration_id: { _eq: $cfgId } }) {
          output { id label description has_format has_dimensionality position }
        }
      }
    `
```

### CatalogParameter interface fix (adapter)
```typescript
// Source: mint-ensemble-manager/src/classes/mint/model-catalog-graphql-adapter.ts lines 41-53
// Fix: change has_accepted_values type from string to string[] | null

export interface CatalogParameter {
    id: string;
    label?: string;
    description?: string;
    has_default_value?: string;
    has_fixed_value?: string;
    has_minimum_accepted_value?: string;
    has_maximum_accepted_value?: string;
    parameter_type?: string;
    position?: number;
    has_accepted_values?: string[] | null;  // was: string
    has_data_type?: string;
}

// And in convertCatalogParameterToParameter (line ~153):
        accepted_values: parameter.has_accepted_values || [],  // was: || ""
```

---

## File Change Summary

| Repo | File | Change Type | Description |
|------|------|-------------|-------------|
| mint | `graphql_engine/migrations/1771200002000_modelcatalog_parameter_accepted_values/up.sql` | CREATE | ADD COLUMN has_accepted_values TEXT[] |
| mint | `graphql_engine/migrations/1771200002000_modelcatalog_parameter_accepted_values/down.sql` | CREATE | DROP COLUMN IF EXISTS has_accepted_values |
| mint | `graphql_engine/metadata/tables.yaml` | EDIT | Add has_accepted_values to modelcatalog_parameter &id006 anchor |
| model-catalog-api | `src/hasura/field-maps.ts` | EDIT | Add has_accepted_values to modelcatalog_parameter field selection |
| model-catalog-api | `src/custom-handlers.ts` | EDIT | Change model_configuration_id to configuration_id in WHERE filter (2 lines) |
| mint-ensemble-manager | `src/classes/mint/model-catalog-graphql-adapter.ts` | EDIT | Fix CatalogParameter interface type and fallback value |

---

## Verification Approach

After implementing, these checks confirm correctness:

1. **Migration structure:** `ls graphql_engine/migrations/1771200002000_modelcatalog_parameter_accepted_values/` shows up.sql and down.sql
2. **Column in migration:** `grep "has_accepted_values" graphql_engine/migrations/1771200002000_*/up.sql` returns the ALTER TABLE line
3. **Metadata updated:** `grep "has_accepted_values" graphql_engine/metadata/tables.yaml` returns the new column entry
4. **field-maps updated:** `grep "has_accepted_values" model-catalog-api/src/hasura/field-maps.ts` returns a match
5. **Handler fixed:** `grep "model_configuration_id" model-catalog-api/src/custom-handlers.ts` returns 0 matches in WHERE context (line 51 in field selection is a different issue — check context)
6. **TypeScript compiles:** `cd /Users/mosorio/repos/model-catalog-api && npx tsc --noEmit` — no errors
7. **Tests still pass:** `cd /Users/mosorio/repos/model-catalog-api && npx vitest run` — 36 tests pass

**Note on line 51 of custom-handlers.ts:** The `model_configuration_id` at line 51 of `custom-handlers.ts` is inside `SETUP_FIELDS` as a column being selected from `modelcatalog_model_configuration_setup` (not a WHERE filter column). This is a legitimate SELECT column on the setup table. Do NOT change this reference — only change the WHERE filter references at lines 494 and 497.

---

## Open Questions

1. **Should the integration test be enhanced to check the column name?**
   - What we know: The existing test at line 466 does not inspect the query string body, only the variable value. A test that checks `expect(callArgs.query).toContain('configuration_id')` would prevent regression.
   - What's unclear: Whether this test enhancement is in the plan scope or deferred.
   - Recommendation: Include it in 04-01 since it's a 2-line addition and directly validates the bug fix.

2. **Does Hasura auto-detect `TEXT[]` as `[String]` in GraphQL schema?**
   - What we know: Hasura v2 supports PostgreSQL array types and maps them to GraphQL list types. `TEXT[]` becomes `[String]` in the GraphQL schema.
   - What's unclear: Whether any special Hasura config is needed (it is not — array types are natively supported).
   - Confidence: MEDIUM — based on Hasura documentation knowledge; should be verified when applying the migration in a live environment.
   - Recommendation: After `hasura metadata apply`, run an introspection query to confirm `modelcatalog_parameter.has_accepted_values` appears as `[String]` type in the schema.

---

## Sources

### Primary (HIGH confidence)
- Direct inspection: `graphql_engine/migrations/1771105509000_modelcatalog_schema/up.sql` — confirmed `modelcatalog_configuration_input` and `modelcatalog_configuration_output` use `configuration_id` (not `model_configuration_id`)
- Direct inspection: `graphql_engine/metadata/tables.yaml` lines 3391–3470 — confirmed `modelcatalog_parameter` has no `has_accepted_values` in any permission column list
- Direct inspection: `model-catalog-api/src/custom-handlers.ts` lines 494, 497 — confirmed `model_configuration_id` is used in WHERE filter
- Direct inspection: `mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-setup.graphql` line 19 — confirmed `has_accepted_values` is queried
- Direct inspection: `.planning/v2.0-MILESTONE-AUDIT.md` — authoritative gap analysis with exact line numbers

### Secondary (MEDIUM confidence)
- `model-catalog-fastapi/src/openapi_server/models/parameter.py` line 50: `Optional[List[str]]` — confirms array type for has_accepted_values
- `model-catalog-fastapi/openapi.json` — confirms `hasAcceptedValues` is `array` of `string` in OpenAPI spec

---

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — both bugs confirmed from direct source inspection with exact line numbers
- Fix approach: HIGH — migration pattern matches 3 prior migrations; column name fix is a literal string change
- Type handling (TEXT[]): MEDIUM — Hasura array type support is well-established but not re-verified from live environment
- Test enhancement: HIGH — existing test structure is understood from direct inspection

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable codebase; only applies if no Phase 3 changes re-run)
