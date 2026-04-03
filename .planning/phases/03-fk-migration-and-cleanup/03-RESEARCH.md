# Phase 3: FK Migration and Cleanup - Research

**Researched:** 2026-02-21
**Domain:** PostgreSQL FK migration, Hasura metadata, TypeScript SDK removal, Helm chart cleanup
**Confidence:** HIGH — all findings come directly from codebase inspection

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Row classification strategy
- Best-effort auto-classify model rows by matching `model.id` (full URI) against `modelcatalog_model_configuration` and `modelcatalog_model_configuration_setup` tables — the ETL already loaded them
- Two-step process: (1) classify and generate review report, (2) apply FK updates after user reviews
- Review report shows each old model row -> matched modelcatalog row -> classification type
- Orphaned rows (no match in modelcatalog_* tables) keep null FK — stay in place, revisit manually later

#### FK migration approach
- Five tables have direct `model_id` FK to `model` table: `execution`, `model_input`, `model_output`, `model_parameter`, `thread_model`
- Secondary chain: `execution_data_binding`, `execution_parameter_binding`, `execution_result`, `thread_model_io`, `thread_model_parameter` reference `model_io` and `model_parameter`
- `execution` and `thread_model`: add two nullable FK columns (`modelcatalog_configuration_id` and `modelcatalog_setup_id`) — one populated per row depending on classification
- Old `model_id` column: keep but make nullable, drop FK constraint to `model(id)`. New rows won't populate it
- `model_io` table: keep table, add FK to `modelcatalog_dataset_specification`. Execution pipeline stays the same
- `model_parameter` table: replace entirely with `modelcatalog_parameter`. Remove the copy step from Ensemble Manager. `execution_parameter_binding` and `thread_model_parameter` point to `modelcatalog_parameter` directly
- `model_input` / `model_output`: keep (they reference `model_io` which stays)
- No new rows written to `model` table — Ensemble Manager creates new work referencing `modelcatalog_*` IDs directly

#### Migration rollback safety
- Take pg_dump backup before running migration
- Run during maintenance window (brief downtime)
- DB migration deploys first, Ensemble Manager code deploys second — old code still works because `model_id` column stays
- Explicit validation gate after DB migration: count matched vs unmatched rows, spot-check samples. Only deploy new code after validation passes

#### Fuseki removal scope
- Remove from: Helm chart (deployment, service, configmap) and application code (connection strings, client code, config)
- Keep in: Docker Compose (dev) and CI/CD pipelines — lower priority, clean up later
- Keep old v1.8.0 FastAPI API running as fallback — remove in a later phase after v2.0.0 validated in production
- Ensemble Manager: remove `model_catalog_api` config entirely — no longer needs the REST API since it queries `modelcatalog_*` tables directly via Hasura GraphQL

#### SDK dependency removal
- Remove `@mintproject/modelcatalog_client` (^8.0.0) from package.json
- 8 files import from the SDK: model-catalog-functions.ts, model-catalog-graphql-adapter.ts, useModelInputService.ts, useModelParameterService.ts, useModelParameterService.test.ts, subTasksService.ts, threadsService.ts, graphql_functions.ts
- Replace SDK types with GraphQL codegen types — regenerate from Hasura schema to pick up `modelcatalog_*` table types
- model-catalog-functions.ts: remove entirely (fetch-and-copy pattern no longer needed)
- model-catalog-graphql-adapter.ts: rewrite to use codegen types for catalog-to-execution data conversion

### Claude's Discretion
- Exact Hasura migration SQL syntax and ordering
- GraphQL query structure for new modelcatalog_* lookups in Ensemble Manager
- Validation query design for the post-migration gate
- How to handle model_io_variable references during migration

### Deferred Ideas (OUT OF SCOPE)
- Remove Fuseki from Docker Compose and CI/CD — future cleanup
- Remove old v1.8.0 FastAPI deployment — after v2.0.0 validated in production
- Drop model_id column entirely from execution/thread_model — after all consumers adapted
- Drop model table entirely — after model_id column removed
- Full Ensemble Manager rewrite to eliminate model_io copy pattern — model_io stays with FK for now, full replacement in a future phase
</user_constraints>

---

## Summary

Phase 3 is a two-track effort: (1) a database FK migration that reroutes existing `execution` and `thread_model` rows from the old `model` table to the new `modelcatalog_*` tables, and (2) cleanup of the Fuseki deployment and `@mintproject/modelcatalog_client` SDK in the Ensemble Manager.

The current schema has `execution.model_id` and `thread_model.model_id` as `NOT NULL TEXT` foreign keys pointing to `model(id)`. The migration must add nullable FK columns to `execution` and `thread_model`, back-fill them using string-match against `modelcatalog_model_configuration.id` and `modelcatalog_model_configuration_setup.id`, then drop the old FK constraint while keeping the `model_id` column for backward compatibility. The `model_parameter` table gets replaced entirely by `modelcatalog_parameter` — the `execution_parameter_binding.model_parameter_id` and `thread_model_parameter.model_parameter_id` FK constraints must be dropped and recreated pointing to `modelcatalog_parameter.id`. The `model_io` table stays but gains an optional FK column to `modelcatalog_dataset_specification`.

The Ensemble Manager currently uses the `@mintproject/modelcatalog_client` SDK in 8 TypeScript files. All usages are the fetch-and-copy pattern: fetch from the REST API, copy into the `model` table, then use the local copy. After this phase, the Ensemble Manager queries `modelcatalog_*` tables directly via Hasura GraphQL and never writes to the old `model` table. The SDK import can then be removed.

**Primary recommendation:** Write two Hasura migrations in sequence — first the classification/FK column migration (with a manual validation gate between classification SQL and FK update SQL), then the parameter table migration — before making any code changes.

---

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Hasura CLI (`hasura`) | already installed (see `graphql_engine/` directory) | Generate and apply migrations | Project already uses this; migrations live in `graphql_engine/migrations/` |
| PostgreSQL | production DB: `mint-hasura-db-0` in `mint` namespace | FK and column DDL | All schema changes go through Hasura migrations |
| `@graphql-codegen/cli` | `^5.0.7` (already in devDeps) | Regenerate TypeScript types from Hasura schema | Already configured in `codegen.ts` |
| `@graphql-codegen/client-preset` | `^4.8.2` (already in devDeps) | Client-side codegen preset | Already in use |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `pg_dump` | system postgres | Backup before migration | One-time pre-migration safety |
| `kubectl exec` | cluster tool | Access production DB pod for backup | Production: `mint-hasura-db-0` in namespace `mint` |
| Helm (`helm upgrade`) | cluster tool | Deploy chart changes after Fuseki removal | After Helm templates updated |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hasura migrations | Raw `psql` scripts | Hasura CLI keeps migration history and Hasura metadata in sync — must use Hasura CLI to avoid metadata drift |
| GraphQL codegen | Hand-written types | Codegen is already set up and targets `http://graphql.mint.local/v1/graphql`; regenerating picks up new `modelcatalog_*` tables automatically |

---

## Architecture Patterns

### Pattern 1: Hasura Migration File Naming and Structure
**What:** Each migration is a directory named `{timestamp}_{slug}` containing `up.sql` and `down.sql`. All DDL is in SQL, not Hasura YAML.
**When to use:** Every schema change in this project.

**Existing pattern (from `graphql_engine/migrations/`):**
```
1771105509000_modelcatalog_schema/up.sql      -- BEGIN; ... COMMIT;
1771105510000_modelcatalog_extended_schema/up.sql
1771105511000_modelcatalog_author_relationships/up.sql
1771105512000_modelcatalog_software_type/up.sql
```

All multi-statement migrations use explicit `BEGIN; ... COMMIT;` wrapping. The timestamp must be greater than any existing timestamp. The next migration number must be `> 1771105512000`.

**Example structure for Phase 3 migrations:**
```
graphql_engine/migrations/
  1771200000000_fk_migration_classify/up.sql   -- classification + new FK columns
  1771200001000_fk_migration_parameter/up.sql  -- model_parameter -> modelcatalog_parameter
```

### Pattern 2: Classification SQL (matching model.id to modelcatalog tables)
**What:** `model.id` values are full W3ID URIs like `https://w3id.org/okn/i/mint/<uuid>`. The `modelcatalog_model_configuration.id` and `modelcatalog_model_configuration_setup.id` columns contain the same URI format. Classification is a direct string equality match.

**Classification query (verified against actual schema):**
```sql
-- Step 1: Review report — shows every model row and its match
SELECT
    m.id AS model_id,
    mc.id AS config_match,
    ms.id AS setup_match,
    CASE
        WHEN mc.id IS NOT NULL THEN 'ModelConfiguration'
        WHEN ms.id IS NOT NULL THEN 'ModelConfigurationSetup'
        ELSE 'ORPHAN'
    END AS classification
FROM model m
LEFT JOIN modelcatalog_model_configuration mc ON mc.id = m.id
LEFT JOIN modelcatalog_model_configuration_setup ms ON ms.id = m.id
ORDER BY classification, m.id;
```

**Classification counts (validation gate query):**
```sql
SELECT
    CASE
        WHEN mc.id IS NOT NULL THEN 'ModelConfiguration'
        WHEN ms.id IS NOT NULL THEN 'ModelConfigurationSetup'
        ELSE 'ORPHAN'
    END AS classification,
    COUNT(*) AS row_count
FROM model m
LEFT JOIN modelcatalog_model_configuration mc ON mc.id = m.id
LEFT JOIN modelcatalog_model_configuration_setup ms ON ms.id = m.id
GROUP BY 1
ORDER BY 1;
```

### Pattern 3: Adding Nullable FK Columns (ADD COLUMN + UPDATE + ALTER TABLE)
**What:** PostgreSQL `ADD COLUMN` with a FK constraint and `NULL` default. Then `UPDATE` to back-fill. Then optionally add `NOT NULL` only if 100% of rows matched (they won't — orphans stay null).

**Verified pattern (consistent with existing migrations):**
```sql
BEGIN;

-- Add nullable FK columns to execution
ALTER TABLE execution
    ADD COLUMN modelcatalog_configuration_id TEXT
        REFERENCES modelcatalog_model_configuration(id) ON DELETE SET NULL,
    ADD COLUMN modelcatalog_setup_id TEXT
        REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE SET NULL;

-- Add indexes immediately (PostgreSQL does NOT auto-index FKs)
CREATE INDEX idx_execution_mc_config ON execution(modelcatalog_configuration_id);
CREATE INDEX idx_execution_mc_setup ON execution(modelcatalog_setup_id);

-- Back-fill: classify using model_id match
UPDATE execution e
SET modelcatalog_configuration_id = e.model_id
WHERE EXISTS (
    SELECT 1 FROM modelcatalog_model_configuration mc WHERE mc.id = e.model_id
);

UPDATE execution e
SET modelcatalog_setup_id = e.model_id
WHERE modelcatalog_configuration_id IS NULL
AND EXISTS (
    SELECT 1 FROM modelcatalog_model_configuration_setup ms WHERE ms.id = e.model_id
);

-- Same for thread_model
ALTER TABLE thread_model
    ADD COLUMN modelcatalog_configuration_id TEXT
        REFERENCES modelcatalog_model_configuration(id) ON DELETE SET NULL,
    ADD COLUMN modelcatalog_setup_id TEXT
        REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE SET NULL;

CREATE INDEX idx_thread_model_mc_config ON thread_model(modelcatalog_configuration_id);
CREATE INDEX idx_thread_model_mc_setup ON thread_model(modelcatalog_setup_id);

UPDATE thread_model tm
SET modelcatalog_configuration_id = tm.model_id
WHERE EXISTS (
    SELECT 1 FROM modelcatalog_model_configuration mc WHERE mc.id = tm.model_id
);

UPDATE thread_model tm
SET modelcatalog_setup_id = tm.model_id
WHERE modelcatalog_configuration_id IS NULL
AND EXISTS (
    SELECT 1 FROM modelcatalog_model_configuration_setup ms WHERE ms.id = tm.model_id
);

-- Drop FK constraint on model_id (keep column, lose constraint)
-- execution.model_id is currently NOT NULL with FK to model(id)
ALTER TABLE execution
    DROP CONSTRAINT execution_model_id_fkey,
    ALTER COLUMN model_id DROP NOT NULL;

ALTER TABLE thread_model
    DROP CONSTRAINT thread_model_model_id_fkey,
    ALTER COLUMN model_id DROP NOT NULL;

COMMIT;
```

### Pattern 4: Replacing model_parameter FK with modelcatalog_parameter FK
**What:** `execution_parameter_binding.model_parameter_id` currently has an FK to `model_parameter(id)`. Same for `thread_model_parameter.model_parameter_id`. Drop the old FK constraints and add new ones to `modelcatalog_parameter(id)`.

**Critical detail:** The `model_parameter_id` column in these tables stores the same URI format as `modelcatalog_parameter.id`. The ETL populated `modelcatalog_parameter` with these IDs. So the values already in the columns will satisfy the new FK constraint for rows that were matched.

**However:** Rows where the old `model_parameter_id` does not exist in `modelcatalog_parameter` will violate the new FK. The constraint must be added as `DEFERRABLE` or the orphaned rows must be nulled out first. Given the context decisions (orphans stay with null FKs), the FK should be nullable.

```sql
BEGIN;

-- Add optional FK to model_io referencing modelcatalog_dataset_specification
ALTER TABLE model_io
    ADD COLUMN modelcatalog_dataset_specification_id TEXT
        REFERENCES modelcatalog_dataset_specification(id) ON DELETE SET NULL;

CREATE INDEX idx_model_io_mc_ds ON model_io(modelcatalog_dataset_specification_id);

-- Back-fill model_io -> modelcatalog_dataset_specification
UPDATE model_io mio
SET modelcatalog_dataset_specification_id = mio.id
WHERE EXISTS (
    SELECT 1 FROM modelcatalog_dataset_specification ds WHERE ds.id = mio.id
);

-- Drop old FK from execution_parameter_binding to model_parameter
ALTER TABLE execution_parameter_binding
    DROP CONSTRAINT execution_parameter_binding_model_parameter_id_fkey;

-- Drop old FK from thread_model_parameter to model_parameter
ALTER TABLE thread_model_parameter
    DROP CONSTRAINT thread_model_parameter_parameter_id_fkey;

-- Add new nullable FKs to modelcatalog_parameter
-- Only rows with matching parameter IDs get the FK satisfied
ALTER TABLE execution_parameter_binding
    ADD CONSTRAINT execution_parameter_binding_modelcatalog_parameter_id_fkey
    FOREIGN KEY (model_parameter_id) REFERENCES modelcatalog_parameter(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE thread_model_parameter
    ADD CONSTRAINT thread_model_parameter_modelcatalog_parameter_id_fkey
    FOREIGN KEY (model_parameter_id) REFERENCES modelcatalog_parameter(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

COMMIT;
```

**Warning:** Before adding the new FK constraints, any `model_parameter_id` values that do NOT exist in `modelcatalog_parameter.id` will cause a constraint violation even on `DEFERRABLE`. These rows must be identified and either nulled out or left — the decisions say orphans keep null FK, meaning we should set `model_parameter_id = NULL` for unmatched rows before adding the FK.

### Pattern 5: Hasura Metadata Updates (tables.yaml)
**What:** After adding FK columns, Hasura auto-detects the new FK constraints but does NOT automatically expose them as relationships. The `tables.yaml` must be updated to add object_relationships and array_relationships for the new FK columns.

**Existing pattern in `graphql_engine/metadata/tables.yaml`:**
```yaml
- table:
    name: execution
    schema: public
  object_relationships:
  - name: modelcatalog_configuration
    using:
      foreign_key_constraint_on: modelcatalog_configuration_id
  - name: modelcatalog_setup
    using:
      foreign_key_constraint_on: modelcatalog_setup_id
```

The `tables.yaml` update must also expose the new `modelcatalog_*` tables themselves if they are not yet in the metadata (they may not be — check before assuming).

### Pattern 6: GraphQL Codegen — Regenerating Types
**What:** After DB schema changes + Hasura metadata updates, run codegen to regenerate `src/classes/graphql/types.ts`. The codegen config in `codegen.ts` targets `http://graphql.mint.local/v1/graphql` which requires local Hasura to be running with the updated metadata.

```bash
# In mint-ensemble-manager directory
npm run codegen
```

This regenerates both `src/classes/graphql/types.ts` and the `src/classes/graphql/` client files.

### Pattern 7: New GraphQL Queries for modelcatalog_* Lookups
**What:** The Ensemble Manager needs new GraphQL queries to look up `modelcatalog_model_configuration` or `modelcatalog_model_configuration_setup` by ID, returning their inputs, outputs, and parameters. These replace the REST API fetch pattern.

**Example query structure for new lookup:**
```graphql
# src/classes/graphql/queries/model/get-modelcatalog-setup.graphql
query get_modelcatalog_setup($id: String!) {
    modelcatalog_model_configuration_setup_by_pk(id: $id) {
        id
        label
        description
        has_software_image
        setup_parameters {
            parameter {
                id
                label
                has_default_value
                has_fixed_value
                has_minimum_accepted_value
                has_maximum_accepted_value
                parameter_type
            }
        }
        setup_inputs {
            input {
                id
                label
                has_format
                position
            }
        }
        setup_outputs {
            output {
                id
                label
                has_format
            }
        }
    }
}
```

Note: The relationship names in the query depend on what Hasura exposes — these must match the names in `tables.yaml`. The `modelcatalog_*` tables need to be tracked in Hasura metadata before these queries work.

### Anti-Patterns to Avoid
- **Dropping FK constraint before nulling orphaned rows:** If `execution_parameter_binding.model_parameter_id` has values that don't exist in `modelcatalog_parameter.id`, adding a non-deferrable FK will fail. Always null orphaned FK values before adding the new constraint.
- **Adding FK constraint without adding index:** PostgreSQL does NOT auto-create an index on FK columns. Every new FK column needs an explicit `CREATE INDEX` to avoid full table scans on joins.
- **Editing tables.yaml directly without applying via Hasura CLI:** Hasura metadata must be applied with `hasura metadata apply` — editing the file alone has no effect on the running instance.
- **Running codegen against stale schema:** Codegen must run after Hasura metadata is applied and the local Hasura instance reflects the new tables.
- **Removing `model_catalog_api` from config.json before the code that reads it is also removed:** The config key must be removed from the Helm ConfigMap template and the TypeScript `MintPreferences` interface in the same code deployment.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Generating TypeScript types from schema | Manual type files | `npm run codegen` | Codegen is already configured; manual types go stale immediately |
| Finding constraint names before dropping them | Guess constraint names | Query `pg_constraint` or `information_schema.table_constraints` | Exact constraint names from init migration: `execution_model_id_fkey`, `thread_model_model_id_fkey`, `execution_parameter_binding_model_parameter_id_fkey`, `thread_model_parameter_parameter_id_fkey` |
| Verifying orphaned parameter rows | Count by hand | SQL validation query against `modelcatalog_parameter` | Systematic count needed before adding new FK constraint |

**Key insight:** The constraint names are deterministic from the init migration SQL. They are documented below so the migration SQL can reference them directly.

---

## Common Pitfalls

### Pitfall 1: Unique Constraint on thread_model Breaks After model_id Goes Nullable
**What goes wrong:** `thread_model` has `UNIQUE (thread_id, model_id)`. If `model_id` becomes nullable, PostgreSQL treats `NULL` as distinct in unique constraints — multiple rows with `(thread_id, NULL)` would be allowed. This is probably fine for now (no new rows will have null model_id) but is a subtle semantic change.
**Why it happens:** PostgreSQL UNIQUE constraint semantics for NULL values.
**How to avoid:** Don't drop or alter the unique constraint in this phase. New rows will use `modelcatalog_configuration_id` or `modelcatalog_setup_id` as the uniqueness signal; enforce that at the application level for now.
**Warning signs:** Application logic that relied on the unique constraint to prevent duplicate thread_model rows.

### Pitfall 2: execution_parameter_binding Primary Key Includes model_parameter_id
**What goes wrong:** `execution_parameter_binding` has PK `(execution_id, model_parameter_id)`. When `model_parameter_id` changes meaning (now references `modelcatalog_parameter`), the PK still enforces uniqueness by the string value — no structural issue. But if two parameters had different IDs in `model_parameter` vs `modelcatalog_parameter`, they won't match.
**Why it happens:** The ETL used the same URI format, so IDs should match exactly.
**How to avoid:** Before adding the new FK constraint, run: `SELECT epb.model_parameter_id FROM execution_parameter_binding epb LEFT JOIN modelcatalog_parameter mp ON mp.id = epb.model_parameter_id WHERE mp.id IS NULL` to find orphans.
**Warning signs:** FK constraint addition fails with a foreign key violation error.

### Pitfall 3: thread_model_parameter Primary Key Includes parameter_value
**What goes wrong:** `thread_model_parameter` has PK `(thread_model_id, model_parameter_id, parameter_value)`. The `model_parameter_id` column still holds the string ID — no structural change needed to the PK. Same matching issue as above.
**How to avoid:** Same orphan-check query as above, applied to `thread_model_parameter`.

### Pitfall 4: Hasura tracks table relationships via constraint names
**What goes wrong:** After dropping `execution_model_id_fkey`, Hasura's `tables.yaml` may still reference a relationship named `model` using `foreign_key_constraint_on: model_id`. This will cause Hasura to error on metadata apply because the FK constraint no longer exists.
**Why it happens:** Hasura uses FK constraints to back object relationships. If the FK is dropped, the relationship entry in `tables.yaml` becomes invalid.
**How to avoid:** When dropping `execution_model_id_fkey` in the migration, simultaneously update `tables.yaml` to remove the `model` relationship from `execution` and `thread_model`. Add the new relationships for `modelcatalog_configuration_id` and `modelcatalog_setup_id`.
**Warning signs:** `hasura metadata apply` fails with "constraint not found" or "relationship broken" errors.

### Pitfall 5: Removing model_catalog_api from Config Template but Not from MintPreferences Interface
**What goes wrong:** The TypeScript `MintPreferences` interface in `mint-types.ts` has `model_catalog_api?: string`. If the Helm ConfigMap template removes it but the TypeScript code still references it (e.g., `fetchModelFromCatalog` uses `prefs.model_catalog_api`), the code will fail at runtime.
**Why it happens:** Config removal must be coordinated across Helm template AND TypeScript code in the same deployment.
**How to avoid:** Remove all usages of `prefs.model_catalog_api` in TypeScript before or simultaneously with removing it from the Helm ConfigMap template. `threadsService.ts` calls `fetchModelFromCatalog(... mint_prefs)` which reads `prefs.model_catalog_api` — this call must be replaced with the new Hasura GraphQL lookup.

### Pitfall 6: model_io_variable References After model_io Gains FK Column
**What goes wrong:** The `model_io_variable` table has FK to `model_io(id)` and to `variable(id)`. Adding a new nullable column to `model_io` is safe. But `model_io_variable.model_io_id` stores the same URI-format IDs. If existing `model_io` rows get a new `modelcatalog_dataset_specification_id`, nothing in `model_io_variable` needs to change — the rows still reference `model_io.id` (the old URI, unchanged).
**How to avoid:** No action needed on `model_io_variable` during the FK migration. The table stays pointing to `model_io.id` as before.

### Pitfall 7: Fuseki Helm Components Have PVC with keep Policy
**What goes wrong:** `model_catalog_endpoint.yaml` uses PVCs with `helm.sh/resource-policy: keep` annotation. Removing the template removes the Deployment and Service but the PVC stays behind. This is intentional (data preservation) but the operator may be surprised.
**Warning signs:** `helm upgrade` succeeds but old PVC still exists in the namespace.
**How to avoid:** Document that the PVC is retained intentionally. Do NOT add `--delete-namespace` or manually delete PVCs.

---

## Code Examples

### Finding Exact Constraint Names Before Dropping

```sql
-- Verified against init migration SQL (1662641297914_init/up.sql)
-- These are the exact constraint names as created in the init migration:
-- execution_model_id_fkey
-- thread_model_model_id_fkey
-- execution_parameter_binding_model_parameter_id_fkey
-- thread_model_parameter_parameter_id_fkey

-- Verify they still exist (run on production before migration):
SELECT conname, contype, conrelid::regclass
FROM pg_constraint
WHERE conname IN (
    'execution_model_id_fkey',
    'thread_model_model_id_fkey',
    'execution_parameter_binding_model_parameter_id_fkey',
    'thread_model_parameter_parameter_id_fkey'
);
```

### Post-Migration Validation Query
```sql
-- Check execution rows:
SELECT
    COUNT(*) FILTER (WHERE modelcatalog_configuration_id IS NOT NULL) AS matched_config,
    COUNT(*) FILTER (WHERE modelcatalog_setup_id IS NOT NULL)         AS matched_setup,
    COUNT(*) FILTER (WHERE modelcatalog_configuration_id IS NULL AND modelcatalog_setup_id IS NULL) AS orphaned,
    COUNT(*) AS total
FROM execution;

-- Check thread_model rows:
SELECT
    COUNT(*) FILTER (WHERE modelcatalog_configuration_id IS NOT NULL) AS matched_config,
    COUNT(*) FILTER (WHERE modelcatalog_setup_id IS NOT NULL)         AS matched_setup,
    COUNT(*) FILTER (WHERE modelcatalog_configuration_id IS NULL AND modelcatalog_setup_id IS NULL) AS orphaned,
    COUNT(*) AS total
FROM thread_model;

-- Check parameter binding orphans before adding new FK:
SELECT COUNT(*) AS orphaned_param_bindings
FROM execution_parameter_binding epb
WHERE NOT EXISTS (
    SELECT 1 FROM modelcatalog_parameter mp WHERE mp.id = epb.model_parameter_id
);

SELECT COUNT(*) AS orphaned_thread_params
FROM thread_model_parameter tmp
WHERE NOT EXISTS (
    SELECT 1 FROM modelcatalog_parameter mp WHERE mp.id = tmp.model_parameter_id
);
```

### Null Out Orphaned Parameter Bindings Before Adding FK
```sql
-- This must run BEFORE adding FK constraint from execution_parameter_binding to modelcatalog_parameter
-- Otherwise the constraint addition will fail with a FK violation

-- For execution_parameter_binding: we cannot set model_parameter_id to NULL
-- because it is part of the PRIMARY KEY. Instead, we delete orphaned rows:
DELETE FROM execution_parameter_binding epb
WHERE NOT EXISTS (
    SELECT 1 FROM modelcatalog_parameter mp WHERE mp.id = epb.model_parameter_id
);

-- Same for thread_model_parameter:
DELETE FROM thread_model_parameter tmp
WHERE NOT EXISTS (
    SELECT 1 FROM modelcatalog_parameter mp WHERE mp.id = tmp.model_parameter_id
);
```

**Note:** Deleting vs nulling — because `model_parameter_id` is part of both PKs, it cannot be set to NULL. The correct action is to delete orphaned binding rows. These represent executions or thread setups whose parameters no longer exist in the catalog. This must be surfaced in the review report.

### Removing model_catalog_api from MintPreferences
```typescript
// In src/classes/mint/mint-types.ts
// Remove this line:
//   model_catalog_api?: string;
// and remove from MintPreferences interface

// In src/classes/mint/model-catalog-functions.ts
// Remove entire file (fetch-and-copy pattern no longer needed)

// In src/api/api-v1/services/threadsService.ts
// Remove: import { fetchModelFromCatalog } from "@/classes/mint/model-catalog-functions";
// Remove: import { ModelConfigurationSetup } from "@mintproject/modelcatalog_client";
// Replace: fetchModelFromCatalog() call with new GraphQL lookup
```

### New GraphQL Lookup Pattern (replacing fetchModelFromCatalog)
```typescript
// Replaces the REST API call pattern in threadsService.ts
// Uses the existing GraphQL client setup (ApolloClient via GraphQL.instance())

import getModelcatalogSetupGQL from "@/classes/graphql/queries/model/get-modelcatalog-setup.graphql";

const getModelcatalogSetupById = async (
    id: string,
    access_token: string
) => {
    const client = GraphQL.instanceUsingAccessToken(access_token);
    const result = await client.query({
        query: getModelcatalogSetupGQL,
        variables: { id },
        fetchPolicy: "no-cache"
    });
    return result.data.modelcatalog_model_configuration_setup_by_pk;
};
```

### Removing model_catalog_api from Helm ConfigMap
```yaml
# In helm-charts/charts/mint/templates/ensemble-manager-config.yaml
# Remove this line:
#   "model_catalog_api": "http://{{ include "mint.prefix" . }}-model-catalog/{{ .Values.components.model_catalog_api.api_version }}",

# In helm-charts/charts/mint/values.yaml
# Remove from ensemble-manager config section:
# (check which values.yaml keys feed into the model_catalog_api line)
```

### Fuseki Helm Component Removal Checklist
The following files in `helm-charts/charts/mint/templates/` reference `model_catalog_endpoint` (Fuseki):
- `model-catalog-endpoint.yaml` — main Deployment + Service → **disable or delete**
- `model-catalog-endpoint-backup.yaml` — backup job → **disable or delete**
- `ingress-model-catalog-endpoint.yaml` — ingress → **disable or delete**
- `pvc-model-catalog.yaml` — PVC → **keep** (has `helm.sh/resource-policy: keep`; will survive chart change)
- `post-install-model-catalog-endpoint.yaml` — post-install hook → **disable or delete**

In `values.yaml`, set `components.model_catalog_endpoint.enabled: false` OR remove the component entirely. The safest approach is to add `{{ if .Values.components.model_catalog_endpoint.enabled }}` guards to each template and set the value to `false`.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Ensemble Manager fetches from REST API (`model_catalog_api`) then copies into `model` table | Ensemble Manager queries `modelcatalog_*` tables directly via Hasura GraphQL | Eliminates REST API dependency, removes copy overhead, single source of truth |
| `model_id` FK to `model(id)` in `execution` and `thread_model` | `modelcatalog_configuration_id` / `modelcatalog_setup_id` FKs to normalized tables | Proper relational integrity, no denormalized copy |
| `model_parameter` table populated by copying from REST API response | `modelcatalog_parameter` table populated by ETL from RDF | Single load from authoritative source |
| Fuseki running as a Kubernetes service in the mint namespace | Fuseki removed from Helm chart; data is already in PostgreSQL via ETL | Reduced infrastructure footprint |
| `@mintproject/modelcatalog_client` SDK providing TypeScript types | GraphQL codegen types from Hasura schema | Types stay in sync with actual DB schema |

**Deprecated/outdated after this phase:**
- `model-catalog-functions.ts`: entire file — fetch-and-copy REST API pattern
- `model_catalog_api` config key in `MintPreferences` and Helm ConfigMap
- `model` table as target for new writes (table stays but no new inserts)
- Fuseki deployment, service, configmap, backup job, post-install hook in Helm

---

## Open Questions

1. **Are modelcatalog_* tables already tracked in Hasura metadata?**
   - What we know: `tables.yaml` only shows `public` schema tables from the init migration. The Phase 2 migrations added the `modelcatalog_*` tables to the DB but it is unclear whether the Hasura metadata in `graphql_engine/metadata/tables.yaml` was updated to track them.
   - What's unclear: Whether `tables.yaml` needs to have all `modelcatalog_*` tables added before new GraphQL queries against them will work.
   - Recommendation: Inspect the current `tables.yaml` for any `modelcatalog_` entries before writing Phase 3 tasks. If missing, adding them to metadata is a prerequisite for the new GraphQL queries.

2. **Are there orphaned execution_parameter_binding rows in production?**
   - What we know: `execution_parameter_binding.model_parameter_id` references `model_parameter.id`. The ETL loaded `modelcatalog_parameter` with the same IDs. If the ETL was complete, all IDs should match. If the ETL missed any, those rows are orphans.
   - What's unclear: Whether the production database has complete ETL coverage. The review report (classification step) should include parameter binding coverage.
   - Recommendation: The classification script should check for `execution_parameter_binding` rows whose `model_parameter_id` does NOT exist in `modelcatalog_parameter` and include that count in the review report before deciding to delete them.

3. **Does `threadsService.ts` need the model_catalog_api call replaced or just removed?**
   - What we know: `threadsService.createThread()` calls `fetchModelFromCatalog()` which hits the REST API. This endpoint's `thread.modelid` parameter suggests it's looking up a model by short name, not W3ID. This is legacy behavior for the old `/threads` API endpoint.
   - What's unclear: Whether the legacy `threadsService.ts` endpoint is still in use in production or has been superseded by the newer subtasks API.
   - Recommendation: Check whether the `POST /threads` route is still called by any client before deciding to fully remove vs. rewrite the `fetchModelFromCatalog` call.

4. **How to handle model_io_variable during migration?**
   - What we know: `model_io_variable` references `model_io.id` and `variable.id`. These are strings. Adding `modelcatalog_dataset_specification_id` to `model_io` is additive and doesn't affect `model_io_variable`. The `variable` table contains MINT-domain variables, separate from model catalog variables.
   - What's unclear: Whether `model_io_variable.variable_id` needs any mapping to `modelcatalog_variable_presentation.id` for future queries.
   - Recommendation: Leave `model_io_variable` untouched in this phase. The decisions explicitly defer full replacement of the `model_io` copy pattern to a future phase.

---

## Sources

### Primary (HIGH confidence)
- **Codebase direct inspection** — all findings verified by reading actual files:
  - `/Users/mosorio/repos/mint/graphql_engine/migrations/1662641297914_init/up.sql` — exact constraint names, table schemas, current FK structure
  - `/Users/mosorio/repos/mint/graphql_engine/migrations/1771105509000_modelcatalog_schema/up.sql` — `modelcatalog_*` table schemas with actual column names
  - `/Users/mosorio/repos/mint/mint-ensemble-manager/package.json` — exact SDK version `^8.0.0`, codegen version `^5.0.7`
  - `/Users/mosorio/repos/mint/mint-ensemble-manager/src/classes/mint/model-catalog-functions.ts` — exact REST API call pattern
  - `/Users/mosorio/repos/mint/mint-ensemble-manager/src/classes/mint/model-catalog-graphql-adapter.ts` — exact SDK type imports
  - `/Users/mosorio/repos/mint/mint-ensemble-manager/src/api/api-v1/services/subTasksService.ts` — SDK usage in service layer
  - `/Users/mosorio/repos/mint/mint-ensemble-manager/src/api/api-v1/services/threadsService.ts` — `fetchModelFromCatalog` usage
  - `/Users/mosorio/repos/mint/mint-ensemble-manager/codegen.ts` — codegen config pointing to `http://graphql.mint.local/v1/graphql`
  - `/Users/mosorio/repos/mint/helm-charts/charts/mint/templates/model-catalog-endpoint.yaml` — Fuseki Deployment/Service
  - `/Users/mosorio/repos/mint/helm-charts/charts/mint/templates/ensemble-manager-config.yaml` — `model_catalog_api` in Helm ConfigMap
  - `/Users/mosorio/repos/mint/graphql_engine/metadata/tables.yaml` — Hasura relationship definitions for `execution`, `model`, `model_parameter`, etc.

---

## Metadata

**Confidence breakdown:**
- DB migration SQL patterns: HIGH — derived directly from existing migrations and init schema
- Exact constraint names: HIGH — read directly from `1662641297914_init/up.sql`
- SDK import locations: HIGH — grepped all 8 files confirmed by codebase scan
- Helm Fuseki component list: HIGH — read all template files directly
- GraphQL query structure for new `modelcatalog_*` lookups: MEDIUM — pattern is consistent with existing query structure, but exact Hasura relationship names depend on `tables.yaml` entries that may not exist yet
- Orphan row counts: LOW — cannot determine without running queries against production DB

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable schema; codegen deps move faster)
