# Phase 3: Fix Nested Resource Creation - Research

**Researched:** 2026-03-28
**Domain:** Hasura nested inserts, TypeScript API service layer, junction table FK mapping
**Confidence:** HIGH

## Summary

This phase adds junction-table relationship handling to the existing REST API service layer. Currently `toHasuraInput()` in `request.ts` silently drops all relationship fields (fields that match `resourceConfig.relationships` keys). The fix uses Hasura's native nested insert syntax to include junction rows atomically within the same mutation as the parent entity insert.

The implementation has two distinct parts: (1) the **create path** (POST) — add nested insert objects for each relationship field found in the request body, and (2) the **update path** (PUT) — delete all existing junction rows for the resource, then re-insert from the request body (replace-all semantics per D-07). Both paths use a single atomic mutation per request (D-03).

The key technical challenge is resolving the "parent FK column name" inside each junction table. This name is NOT stored in `RelationshipConfig` and must be derived. It follows a convention but has exceptions — the two newest category junctions (`modelcatalog_modelconfiguration_category`, `modelcatalog_modelconfigurationsetup_category`) use `model_configuration_id` and `model_configuration_setup_id` instead of the simpler convention used by other tables. This FK derivation logic is a critical implementation decision left to Claude's discretion.

**Primary recommendation:** Extend `toHasuraInput()` (or add a parallel helper) to produce Hasura nested insert objects for junction relationships, keyed by `hasuraRelName`. For the update path, handle junction deletions as a separate `delete_` mutation step before the `_set` update, since Hasura `_set` cannot touch relationship data.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Link-or-create behavior. If a nested resource ID exists in the database, link it via junction table. If it doesn't exist, create it first, then link.
- **D-02:** New nested resources use provided fields + defaults — same logic as top-level creation: generate UUID if no ID provided, set type URI from resource config, map camelCase to snake_case.
- **D-03:** Use Hasura native nested inserts — single atomic mutation per request. No sequential mutations.
- **D-04:** Use `on_conflict` (upsert) on nested resource inserts so existing resources are matched by ID (no-op update) and new ones are created. Single mutation stays atomic.
- **D-05:** Fail entire request if any nested insert fails. Return 400/422 with error details. Atomic behavior — nothing is created if any part fails.
- **D-06:** Apply to ALL junction-based relationships generically (20+ junction tables), not a subset. Use existing `resource-registry.ts` relationship metadata to drive implementation.
- **D-07:** Applies to both POST (create) and PUT (update) operations. For PUT: replace all junction rows (delete old, insert new) to reflect the updated relationship set.

### Claude's Discretion
- Implementation details of how `toHasuraInput()` is refactored to include relationship data in the mutation input
- How junction FK column names are resolved from relationship metadata
- Whether to build nested insert objects inline or via a helper function

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hasura GraphQL Engine | existing deployment | Nested insert mutations with `on_conflict` | Native capability, no extra packages |
| Apollo Client v4 | ^4.1.5 (existing) | Execute GraphQL mutations | Already in use for all mutations |
| TypeScript | ^5.9.3 (existing) | Type-safe mutation building | Project standard |
| vitest | ^4.0.18 (existing) | Unit tests | Project standard |

### No New Dependencies
This phase is purely a code change within the existing `model-catalog-api/src/` TypeScript service. No new npm packages are required.

**Version verification:** All packages are already installed. No new installations needed.

---

## Architecture Patterns

### How Hasura Nested Inserts Work for Junction Tables

Hasura supports inserting related records inline using the relationship name. For a parent entity with a junction-based relationship named `categories`, the insert input looks like:

```graphql
mutation CreateModel($object: modelcatalog_software_insert_input!) {
  insert_modelcatalog_software_one(object: $object) {
    id
  }
}
```

With variable:
```json
{
  "object": {
    "id": "https://w3id.org/okn/i/mint/some-uuid",
    "label": "My Model",
    "type": "https://w3id.org/okn/o/sdm#Model",
    "categories": {
      "data": [
        {
          "category": {
            "data": { "id": "https://w3id.org/okn/i/mint/Economy", "label": "Economy" },
            "on_conflict": {
              "constraint": "modelcatalog_model_category_pkey",
              "update_columns": []
            }
          }
        }
      ],
      "on_conflict": {
        "constraint": "modelcatalog_software_category_pkey",
        "update_columns": []
      }
    }
  }
}
```

The `on_conflict` with `update_columns: []` is the standard Hasura "ignore if exists" (no-op update) upsert pattern — this handles the link-or-create requirement (D-04).

### Nested Insert Structure

For a junction table like `modelcatalog_software_category` (FK columns: `software_id`, `category_id`):
- The parent relationship field name is `categories` (the `hasuraRelName` in resource-registry)
- The junction row's nested relationship to the target entity is `category` (the `junctionRelName` in resource-registry)
- The target entity insert uses `on_conflict` on its primary key constraint

Structure in the mutation variables:
```typescript
{
  [hasuraRelName]: {
    data: nestedObjects.map(item => ({
      [junctionRelName]: {
        data: { id: item.id, ...scalarFields },
        on_conflict: {
          constraint: `${targetHasuraTable}_pkey`,
          update_columns: []
        }
      }
    })),
    on_conflict: {
      constraint: `${junctionTable}_pkey`,
      update_columns: []
    }
  }
}
```

### FK Column Name Resolution (Critical — See Pitfall)

The junction table has two FK columns: one pointing to the parent entity, one pointing to the target entity. The **target FK column name** is always the `junctionRelName` + `_id` (e.g., `junctionRelName: 'category'` -> FK column `category_id`). This is consistent across all tables.

The **parent FK column name** is NOT stored in `RelationshipConfig` and cannot be derived from `hasuraRelName` alone. The convention breaks for newer tables:

| Junction Table | Parent FK Column | Convention |
|----------------|-----------------|------------|
| `modelcatalog_software_author` | `software_id` | `{entity}_id` |
| `modelcatalog_software_category` | `software_id` | `{entity}_id` |
| `modelcatalog_version_author` | `software_version_id` | `{entity}_id` |
| `modelcatalog_software_version_category` | `software_version_id` | `{entity}_id` |
| `modelcatalog_configuration_author` | `configuration_id` | shortened |
| `modelcatalog_configuration_input` | `configuration_id` | shortened |
| `modelcatalog_configuration_output` | `configuration_id` | shortened |
| `modelcatalog_configuration_parameter` | `configuration_id` | shortened |
| `modelcatalog_configuration_causal_diagram` | `configuration_id` | shortened |
| `modelcatalog_configuration_time_interval` | `configuration_id` | shortened |
| `modelcatalog_configuration_region` | `configuration_id` | shortened |
| `modelcatalog_setup_author` | `setup_id` | shortened |
| `modelcatalog_setup_input` | `setup_id` | shortened |
| `modelcatalog_setup_output` | `setup_id` | shortened |
| `modelcatalog_setup_parameter` | `setup_id` | shortened |
| `modelcatalog_setup_calibrated_variable` | `setup_id` | shortened |
| `modelcatalog_setup_calibration_target` | `setup_id` | shortened |
| `modelcatalog_parameter_intervention` | `parameter_id` | `{entity}_id` |
| `modelcatalog_modelconfiguration_category` | `model_configuration_id` | **DIFFERENT from `configuration_id`** |
| `modelcatalog_modelconfigurationsetup_category` | `model_configuration_setup_id` | **DIFFERENT from `setup_id`** |

**Recommended approach:** Add a `parentFkColumn` field to `RelationshipConfig` for all junction relationships. This is explicit, readable, and avoids convention-based derivation bugs. Add it during the implementation plan.

Alternatively (lower code-change surface): add a lookup map keyed by `junctionTable -> parentFkColumn` inside the helper function.

### Update Path: Delete-then-Insert for Junctions

Hasura `_set` operations update scalar columns only — they cannot touch relationship data. To implement PUT replace-all semantics (D-07):

1. Execute delete mutations for each junction table that has rows in the request body: `delete_${junctionTable}(where: { ${parentFkColumn}: { _eq: $id } })`
2. Execute the `_set` update for scalar columns: `update_modelcatalog_${tableSuffix}_by_pk(pk_columns: {id: $id}, _set: $scalarInput)`
3. Execute insert mutation with nested junction data

Since D-03 says "single atomic mutation per request" and D-07 says "replace all junction rows," the cleanest implementation is to perform the junction deletes and the main update in a **single GraphQL mutation** using multiple root fields. Hasura mutations with multiple root fields execute in sequence within a single transaction, giving atomicity.

Example multi-root mutation structure:
```graphql
mutation UpdateWithJunctions($id: String!, ...) {
  delete_modelcatalog_software_category(where: { software_id: { _eq: $id } }) { affected_rows }
  delete_modelcatalog_software_author(where: { software_id: { _eq: $id } }) { affected_rows }
  update_modelcatalog_software_by_pk(pk_columns: { id: $id }, _set: $scalars) { id }
  insert_modelcatalog_software_category(objects: $categories, on_conflict: ...) { affected_rows }
  insert_modelcatalog_software_author(objects: $authors, on_conflict: ...) { affected_rows }
}
```

Note: For junction tables where the request body contains NO data for that relationship (the field was not included in the request body), do NOT delete existing rows. Only replace relationships that are explicitly provided in the request.

### Recommended Project Structure Change

No new files required. Changes are contained to:

```
model-catalog-api/src/
├── mappers/
│   ├── request.ts              -- Add buildJunctionInserts() helper and/or extend toHasuraInput()
│   └── resource-registry.ts   -- Add parentFkColumn to RelationshipConfig and all junction entries
├── service.ts                  -- Update create() and update() to include junction data
└── mappers/__tests__/
    └── request.test.ts         -- Add tests for junction insert building
```

### Pattern: buildJunctionInserts Helper

```typescript
// Source: derived from resource-registry.ts RelationshipConfig + SQL schema analysis
export function buildJunctionInserts(
  body: Record<string, unknown>,
  resourceConfig: ResourceConfig,
  parentId: string,
): Record<string, unknown> {
  const junctionData: Record<string, unknown> = {};

  for (const [apiFieldName, relConfig] of Object.entries(resourceConfig.relationships)) {
    if (!relConfig.junctionTable || !relConfig.junctionRelName) continue;

    const rawValue = body[apiFieldName];
    if (!rawValue || !Array.isArray(rawValue) || rawValue.length === 0) continue;

    const items = rawValue as Record<string, unknown>[];

    junctionData[relConfig.hasuraRelName] = {
      data: items.map((item) => {
        const targetId = item['id'] as string | undefined;
        // If no id, build full insert for the new nested entity
        const nestedData: Record<string, unknown> = {};
        if (targetId) {
          nestedData['id'] = targetId.startsWith('https://') ? targetId : `${ID_PREFIX}${targetId}`;
        } else {
          nestedData['id'] = `${ID_PREFIX}${randomUUID()}`;
        }
        // Copy over any scalar fields from item (camelCase -> snake_case)
        // ... scalar mapping logic ...
        return {
          [relConfig.junctionRelName!]: {
            data: nestedData,
            on_conflict: {
              constraint: `${targetHasuraTable}_pkey`,
              update_columns: [],
            },
          },
        };
      }),
      on_conflict: {
        constraint: `${relConfig.junctionTable}_pkey`,
        update_columns: [],
      },
    };
  }

  return junctionData;
}
```

### Anti-Patterns to Avoid

- **Sequential mutations for junction rows:** D-03 requires single atomic mutation. Do not loop and call `insert_${junctionTable}` once per item.
- **Modifying junction tables via `_set`:** Hasura `_set` only updates scalar columns on the main entity table.
- **Deleting all junction rows on update unconditionally:** Only delete rows for relationships explicitly included in the request body. Omitted relationship fields = no change to those junctions.
- **Using `junctionTable.replace('modelcatalog_', '')` as parent FK column prefix:** The column naming convention is inconsistent. Use explicit `parentFkColumn` in `RelationshipConfig`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upsert existing nested entities | Custom pre-check query + conditional insert | Hasura `on_conflict` with `update_columns: []` | Atomic, no race condition, simpler |
| Multi-step atomic transaction | Sequential await calls | Single Hasura mutation with multiple root fields | Hasura wraps them in one DB transaction |
| FK constraint violation on target insert | Look up entity before inserting | `on_conflict` on target's primary key | Handles concurrent inserts safely |

**Key insight:** Hasura's nested insert + `on_conflict` eliminates the need for the "check if exists, then link" two-step that would be non-atomic.

---

## Junction Table Complete Reference

All 20+ junction-based relationships in `resource-registry.ts`, with their actual FK column names from SQL migrations:

| API Field | Resource | junctionTable | junctionRelName | Parent FK Column | Target FK Column |
|-----------|----------|---------------|-----------------|------------------|------------------|
| `authors` | softwares/models/etc | `modelcatalog_software_author` | `person` | `software_id` | `person_id` |
| `hasModelCategory` | softwares/models/etc | `modelcatalog_software_category` | `category` | `software_id` | `category_id` |
| `authors` | softwareversions | `modelcatalog_version_author` | `person` | `software_version_id` | `person_id` |
| `hasModelCategory` | softwareversions | `modelcatalog_software_version_category` | `category` | `software_version_id` | `category_id` |
| `hasProcess` | softwareversions | `modelcatalog_software_version_process` | `process` | `software_version_id` | `process_id` |
| `hasGrid` | softwareversions | `modelcatalog_software_version_grid` | `grid` | `software_version_id` | `grid_id` |
| `hasExplanationDiagram` | softwareversions | `modelcatalog_software_version_image` | `image` | `software_version_id` | `image_id` |
| `hasInputVariable` | softwareversions | `modelcatalog_software_version_input_variable` | `variable` | `software_version_id` | `variable_id` |
| `hasOutputVariable` | softwareversions | `modelcatalog_software_version_output_variable` | `variable` | `software_version_id` | `variable_id` |
| `authors` | modelconfigurations | `modelcatalog_configuration_author` | `person` | `configuration_id` | `person_id` |
| `hasInput` | modelconfigurations | `modelcatalog_configuration_input` | `input` | `configuration_id` | `input_id` |
| `hasOutput` | modelconfigurations | `modelcatalog_configuration_output` | `output` | `configuration_id` | `output_id` |
| `hasParameter` | modelconfigurations | `modelcatalog_configuration_parameter` | `parameter` | `configuration_id` | `parameter_id` |
| `hasCausalDiagram` | modelconfigurations | `modelcatalog_configuration_causal_diagram` | `causal_diagram` | `configuration_id` | `causal_diagram_id` |
| `hasOutputTimeInterval` | modelconfigurations | `modelcatalog_configuration_time_interval` | `time_interval` | `configuration_id` | `time_interval_id` |
| `hasRegion` | modelconfigurations | `modelcatalog_configuration_region` | `region` | `configuration_id` | `region_id` |
| `hasModelCategory` | modelconfigurations | `modelcatalog_modelconfiguration_category` | `category` | `model_configuration_id` | `category_id` |
| `authors` | modelconfigurationsetups | `modelcatalog_setup_author` | `person` | `setup_id` | `person_id` |
| `hasInput` | modelconfigurationsetups | `modelcatalog_setup_input` | `input` | `setup_id` | `input_id` |
| `hasOutput` | modelconfigurationsetups | `modelcatalog_setup_output` | `output` | `setup_id` | `output_id` |
| `hasParameter` | modelconfigurationsetups | `modelcatalog_setup_parameter` | `parameter` | `setup_id` | `parameter_id` |
| `calibratedVariable` | modelconfigurationsetups | `modelcatalog_setup_calibrated_variable` | `variable` | `setup_id` | `variable_id` |
| `calibrationTargetVariable` | modelconfigurationsetups | `modelcatalog_setup_calibration_target` | `variable` | `setup_id` | `variable_id` |
| `hasModelCategory` | modelconfigurationsetups | `modelcatalog_modelconfigurationsetup_category` | `category` | `model_configuration_setup_id` | `category_id` |
| `hasIntervention` | parameters | `modelcatalog_parameter_intervention` | `intervention` | `parameter_id` | `intervention_id` |

**Constraint name pattern:** All junction tables use `{tableName}_pkey` as their primary key constraint name (e.g., `modelcatalog_software_category_pkey`). This is standard PostgreSQL behavior for `PRIMARY KEY` defined in `CREATE TABLE`.

**Target entity constraint names:** Target entity tables also use `{tableName}_pkey` (e.g., `modelcatalog_model_category_pkey` for `modelcatalog_model_category`).

---

## Common Pitfalls

### Pitfall 1: FK Column Name Inconsistency for modelconfiguration/modelconfigurationsetup Category Junctions
**What goes wrong:** Code tries `configuration_id` as parent FK for `modelcatalog_modelconfiguration_category`, but the actual column is `model_configuration_id`. Similarly `setup_id` fails for `modelcatalog_modelconfigurationsetup_category` (actual: `model_configuration_setup_id`).
**Why it happens:** The two category junction tables were added later (`1771200004000_modelcatalog_configuration_category`) with full descriptive column names, while the older junction tables shortened them.
**How to avoid:** Use explicit `parentFkColumn` in `RelationshipConfig` for each junction relationship rather than deriving it programmatically.
**Warning signs:** `GraphQL error: column "configuration_id" of relation "modelcatalog_modelconfiguration_category" does not exist`

### Pitfall 2: Relationship Deletion Scope on PUT
**What goes wrong:** Deleting junction rows for ALL relationships of a resource when only some relationships are in the request body, removing links the client did not intend to change.
**Why it happens:** Naive loop over all `resourceConfig.relationships` for deletion.
**How to avoid:** Only delete junction rows for relationships whose API field name is present in the request body (even if empty array — empty array means "clear this relationship").
**Warning signs:** Unintended data loss on PUT when partial updates are expected.

### Pitfall 3: Nested Insert Without on_conflict on the Target Entity
**What goes wrong:** `insert_modelcatalog_model_category_one` fails with unique constraint violation when the category already exists.
**Why it happens:** Missing `on_conflict` on the nested target entity insert.
**How to avoid:** Always include `on_conflict: { constraint: "${targetTable}_pkey", update_columns: [] }` on the nested target entity data block.
**Warning signs:** `GraphQL error: duplicate key value violates unique constraint "modelcatalog_model_category_pkey"`

### Pitfall 4: Hasura INSERT Permission Columns vs. Nested Insert
**What goes wrong:** Hasura rejects the nested insert if the parent table's insert permission does not include the relationship field. However, Hasura handles junction relationships through the junction table's own insert permissions, not the parent table's columns.
**Why it happens:** Confusion between scalar column permissions and relationship permissions.
**How to avoid:** Junction tables have their own `insert_permissions` (e.g., `modelcatalog_software_category` has `columns: [software_id, category_id]` for `user` role). Verify the junction table permission exists — all current junction tables already have user insert+delete permissions per Phase 02-01 decision.
**Warning signs:** `permission denied for table modelcatalog_software_category`

### Pitfall 5: causaldiagrams hasPart Relationship Has No junctionRelName
**What goes wrong:** `hasPart` in `causaldiagrams` has `junctionTable: 'modelcatalog_diagram_part'` but no `junctionRelName` in the registry. The diagram_part table is polymorphic (`part_type` discriminator).
**Why it happens:** The registry entry was not completed with `junctionRelName`.
**How to avoid:** Skip relationships where `junctionRelName` is undefined. Document as a known gap; the polymorphic case requires custom handling outside this phase's scope.
**Warning signs:** Runtime error when trying to access `relConfig.junctionRelName` on `hasPart`.

### Pitfall 6: Array-of-objects vs. Array-of-IDs in Request Body
**What goes wrong:** Clients may send either `hasModelCategory: [{id: "uri", label: ["Economy"]}]` (full objects) or `hasModelCategory: ["uri"]` (ID strings). The transform code must handle both.
**Why it happens:** The v1.8.0 API accepted full objects; some clients may simplify to ID-only.
**How to avoid:** Normalize to objects before processing. If item is a string, wrap as `{id: item}`.
**Warning signs:** TypeError when trying to access `item.id` on a string.

---

## Code Examples

### Verified: Junction Table Column Names (from SQL migrations)

```sql
-- modelcatalog_software_category (migration 1771200003000)
-- parent FK: software_id, target FK: category_id
CREATE TABLE modelcatalog_software_category (
    software_id TEXT REFERENCES modelcatalog_software(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES modelcatalog_model_category(id) ON DELETE CASCADE,
    PRIMARY KEY (software_id, category_id)
);

-- modelcatalog_modelconfiguration_category (migration 1771200004000)
-- parent FK: model_configuration_id (not configuration_id!), target FK: category_id
CREATE TABLE modelcatalog_modelconfiguration_category (
    model_configuration_id TEXT NOT NULL REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES modelcatalog_model_category(id) ON DELETE CASCADE,
    PRIMARY KEY (model_configuration_id, category_id)
);
```

### Verified: Insert Permissions for Junction Tables (from tables.yaml)

```yaml
# modelcatalog_software_category - user role can insert software_id + category_id
insert_permissions:
- role: user
  permission:
    check: {}
    columns: &id040
    - software_id
    - category_id

# modelcatalog_modelconfiguration_category - user role can insert model_configuration_id + category_id
insert_permissions:
- role: user
  permission:
    check: {}
    columns: &id041
    - model_configuration_id
    - category_id
```

### RelationshipConfig Extension (recommended)

```typescript
// Source: model-catalog-api/src/mappers/resource-registry.ts
export interface RelationshipConfig {
  hasuraRelName: string;
  type: 'object' | 'array';
  junctionTable?: string;
  junctionRelName?: string;
  /** FK column name in the junction table pointing back to the parent entity */
  parentFkColumn?: string;
  targetResource: string;
}
```

Example populated entry:
```typescript
hasModelCategory: {
  hasuraRelName: 'categories',
  type: 'array',
  junctionTable: 'modelcatalog_software_category',
  junctionRelName: 'category',
  parentFkColumn: 'software_id',
  targetResource: 'modelcategorys',
},
```

And for the special case:
```typescript
hasModelCategory: {  // in modelconfigurations
  hasuraRelName: 'categories',
  type: 'array',
  junctionTable: 'modelcatalog_modelconfiguration_category',
  junctionRelName: 'category',
  parentFkColumn: 'model_configuration_id',  // NOT 'configuration_id'
  targetResource: 'modelcategorys',
},
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | none (uses package.json `"test": "vitest run"`) |
| Quick run command | `cd model-catalog-api && npm test` |
| Full suite command | `cd model-catalog-api && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| — | `buildJunctionInserts` produces correct nested insert structure for existing category | unit | `cd model-catalog-api && npm test -- request` | Needs new tests in existing file |
| — | `buildJunctionInserts` produces `on_conflict` on both junction row and target entity | unit | `cd model-catalog-api && npm test -- request` | Needs new tests |
| — | `buildJunctionInserts` skips relationship fields with no `junctionRelName` | unit | `cd model-catalog-api && npm test -- request` | Needs new tests |
| — | `toHasuraInput` scalar output unchanged (regression) | unit | `cd model-catalog-api && npm test -- request` | Exists (request.test.ts) |
| — | New nested resource without ID gets generated UUID | unit | `cd model-catalog-api && npm test -- request` | Needs new tests |

### Wave 0 Gaps
- [ ] New test cases in `model-catalog-api/src/mappers/__tests__/request.test.ts` covering junction insert building
- [ ] No new test files needed — extend existing test file

---

## Environment Availability

Step 2.6: SKIPPED — this phase is a TypeScript code change within the existing service. No new external tool dependencies beyond the already-verified Node.js/npm environment.

---

## Open Questions

1. **How should `causaldiagrams.hasPart` be handled?**
   - What we know: `hasPart` has `junctionTable: 'modelcatalog_diagram_part'` but NO `junctionRelName` in the registry. The table is polymorphic (`part_type` column: 'variable' or 'process').
   - What's unclear: Whether this junction should be handled in this phase or skipped.
   - Recommendation: Skip (add guard `if (!relConfig.junctionRelName) continue`) and document as a known gap. The polymorphic table requires special handling that is out of scope per the discussion.

2. **Should `parentFkColumn` be added to `RelationshipConfig` interface, or use a runtime lookup map?**
   - What we know: The interface approach is cleaner and self-documenting; the lookup map avoids changing every registry entry.
   - What's unclear: Project preference between interface extension vs. runtime map.
   - Recommendation: Extend `RelationshipConfig` interface and populate `parentFkColumn` for all junction entries. This makes each entry self-contained and catches missing values at compile time if made required.

3. **Is `on_conflict` on the target entity insert always `update_columns: []` (no-op)?**
   - What we know: D-04 says "existing resources are matched by ID (no-op update) and new ones are created." This means `update_columns: []`.
   - What's unclear: Whether `update_columns: []` is valid Hasura syntax when there are non-null required columns on the target table.
   - Recommendation: This is valid Hasura syntax — `update_columns: []` means "do nothing on conflict," which is equivalent to `INSERT ... ON CONFLICT DO NOTHING`. HIGH confidence this works for all target tables.

---

## Sources

### Primary (HIGH confidence)
- `model-catalog-api/src/mappers/resource-registry.ts` — Complete relationship metadata
- `model-catalog-api/src/mappers/request.ts` — Current toHasuraInput implementation
- `model-catalog-api/src/service.ts` — Current create/update handler implementation
- `graphql_engine/migrations/1771105509000_modelcatalog_schema/up.sql` — Junction table DDL (base schema)
- `graphql_engine/migrations/1771105510000_modelcatalog_extended_schema/up.sql` — Extended junction tables
- `graphql_engine/migrations/1771105511000_modelcatalog_author_relationships/up.sql` — Author junction tables
- `graphql_engine/migrations/1771200003000_modelcatalog_software_category/up.sql` — Software category junction
- `graphql_engine/migrations/1771200004000_modelcatalog_configuration_category/up.sql` — Configuration category junctions (with non-standard FK names)
- `graphql_engine/metadata/tables.yaml` — Hasura insert permissions for all junction tables

### Secondary (MEDIUM confidence)
- Hasura docs (general knowledge): nested insert with `on_conflict` using relationship name as key, `update_columns: []` for no-op upsert

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, existing stack fully understood
- Architecture: HIGH — derived directly from SQL DDL, table metadata, and existing code
- Pitfalls: HIGH — FK column names verified from actual migration files
- Junction FK map: HIGH — all 25 entries derived from SQL DDL, not convention inference

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable schema — changes would require new migrations)
