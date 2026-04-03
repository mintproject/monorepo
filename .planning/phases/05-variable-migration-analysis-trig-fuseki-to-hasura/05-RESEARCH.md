# Phase 5: Variable Migration Analysis: TriG/Fuseki to Hasura - Research

**Researched:** 2026-03-28
**Domain:** RDF-to-PostgreSQL migration — StandardVariable, Unit entity tables, FK constraints, ETL pipeline extension, REST API integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Create `modelcatalog_standard_variable` table — 303 distinct StandardVariable instances in TriG (313 referenced by VPs). Enables cross-model variable matching.
- **D-02:** Create `modelcatalog_unit` table — 107 Unit instances in TriG (91 distinct URIs referenced by VPs). Enables unit metadata display.
- **D-03:** Create `modelcatalog_variable` table ONLY if TriG source files contain actual `sd:Variable` instances that are not already StandardVariable or VariablePresentation. Research phase must investigate. **FINDING: 0 plain `sd:Variable` instances found in model-catalog.trig. No `modelcatalog_variable` table needed.**
- **D-04:** Investigate TriG source files for `sdm:hasInputVariable`, `sdm:hasOutputVariable`, `sdm:calibratedVariable`, `sdm:calibrationTargetVariable` relationships. Fix ETL extraction if relationships exist but are not being extracted. Current state: 4 junction tables nearly empty (2-20 rows) despite 605 VariablePresentations.
- **D-05:** Single comprehensive ETL update: extract StandardVariable metadata + Unit metadata + populate all junction tables in one pass. No separate ETL runs.
- **D-06:** Full CRUD endpoints for StandardVariable, Unit, and Variable (if table created per D-03). Same permission model as other modelcatalog entities (insert+update+delete for entity tables).
- **D-07:** Bidirectional relationship traversal: StandardVariable <-> VariablePresentation and Unit <-> VariablePresentation. Matches existing bidirectional junction pattern established in Phase 1.
- **D-08:** Add FK constraints: `variable_presentation.has_standard_variable` -> `modelcatalog_standard_variable.id` and `variable_presentation.uses_unit` -> `modelcatalog_unit.id`. Full referential integrity.
- **D-09:** StandardVariable and Unit table schemas match whatever scalar properties exist on the corresponding RDF types in the TriG source data. Research phase extracts actual properties from the ontology/data.

### Claude's Discretion

- Index strategy for new tables and FK columns (common query patterns)
- Hasura metadata configuration details (relationship names, permissions)
- ETL implementation details (SPARQL queries, transform logic)
- Migration ordering (tables before FKs, entities before junctions)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

## Summary

Phase 5 completes the variable data ecosystem in the MINT model catalog Postgres/Hasura stack. Three gaps exist: (1) no `modelcatalog_standard_variable` table despite 303 StandardVariable instances in the TriG data, (2) no `modelcatalog_unit` table despite 107 Unit instances, and (3) junction tables for input/output variables and calibrated variables are nearly empty (2-20 rows) even though the ETL extraction code for those relationships exists and is wired up.

The research has resolved D-03: a SPARQL query against the main TriG file found **0 instances of plain `sd:Variable`** (as distinct from `sd:StandardVariable` or `sd:VariablePresentation`). No `modelcatalog_variable` table is required.

The research has resolved D-09: rdflib queries against the actual TriG data reveal the exact scalar properties present on each type. StandardVariable has: `rdfs:label`, `sd:description`, `owl:sameAs`. Unit (typed as `qudt:Unit`) has: `rdfs:label`, `qudt:abbreviation`, `ccut:hasDimension`, `ccut:hasPart`. The practical columns to store are `id`, `label`, and `description` for StandardVariable; `id` and `label` for Unit (the QUDT/CCUT predicates are ontology-specific and not part of the sd ontology surface).

The ETL pipeline already has wired-in extraction code for all four variable junction relationships (`hasInputVariable`, `hasOutputVariable`, `calibratedVariable`, `calibrationTargetVariable`) and passes the link dicts through transform → load. The root cause of junction sparsity must be investigated by running a diagnostic SPARQL query against the TriG to count actual relationship triples before concluding the ETL is broken vs. the TriG data simply lacks those relationships.

**Primary recommendation:** Follow the established `modelcatalog_model_category` pattern verbatim — migration SQL, Hasura metadata (tracked table + array/object relationships + permissions), API resource registry entry, ETL extract + transform + load additions — for both `modelcatalog_standard_variable` and `modelcatalog_unit`. Then add FK constraints to `modelcatalog_variable_presentation` in a separate migration, and diagnose junction sparsity before ETL repair.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| psycopg2 | already in use | PostgreSQL batch insert via `execute_batch` | Established in `etl/load.py` |
| rdflib | already in use | SPARQL queries against TriG union graph | Established in `etl/extract.py` |
| Hasura migration files | SQL up/down | Schema changes | All previous phases use this pattern |
| Hasura metadata YAML | tables.yaml | Table tracking, relationships, permissions | All previous phases use this pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | already in use | Live HTTP integration tests | Validate new API endpoints |

**Installation:**

No new dependencies required. All required tools are already present in the project.

---

## Architecture Patterns

### Recommended Project Structure

The work spans four layers. Each has an established pattern to follow:

```
graphql_engine/
├── migrations/
│   ├── {timestamp}_modelcatalog_standard_variable_unit/
│   │   ├── up.sql    # CREATE TABLE + indexes
│   │   └── down.sql  # DROP TABLE
│   └── {timestamp}_modelcatalog_variable_fk_constraints/
│       ├── up.sql    # ALTER TABLE variable_presentation ADD FK
│       └── down.sql  # DROP CONSTRAINT
└── metadata/
    └── tables.yaml   # Track tables + relationships + permissions

etl/
├── config.py         # Add TYPE_STANDARD_VARIABLE, TYPE_UNIT constants
├── extract.py        # Add extract_standard_variables(), extract_units()
├── transform.py      # Add valid_standard_variable_ids, valid_unit_ids
└── load.py           # Add to clear_all, load_order, load_all

model-catalog-api/src/mappers/
└── resource-registry.ts  # Update standardvariables, units entries
```

### Pattern 1: Entity Table Migration (from `modelcatalog_model_category`)

All new entity tables follow this exact SQL pattern — TEXT primary key (full URI), label NOT NULL, optional scalar columns, indexes on FK-referenced columns.

```sql
-- Source: graphql_engine/migrations/1771200003000_modelcatalog_software_category/up.sql
-- and     graphql_engine/migrations/1771105510000_modelcatalog_extended_schema/up.sql

CREATE TABLE modelcatalog_standard_variable (
    id          TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    description TEXT
);
CREATE INDEX idx_mc_sv_id ON modelcatalog_standard_variable(id);

CREATE TABLE modelcatalog_unit (
    id    TEXT PRIMARY KEY,
    label TEXT NOT NULL
);
CREATE INDEX idx_mc_unit_id ON modelcatalog_unit(id);
```

**Why `description` on StandardVariable but not Unit:** The rdflib audit found `sd:description` on StandardVariable instances; Unit instances only have `rdfs:label` (plus QUDT/CCUT ontology-specific predicates that are not part of the sd API surface).

### Pattern 2: FK Constraint Migration (from `1771200001000_fk_migration_parameter`)

FK constraints on existing columns are added in a separate migration after the referenced tables exist.

```sql
-- Source: graphql_engine/migrations/1771200001000_fk_migration_parameter/up.sql (pattern)

ALTER TABLE modelcatalog_variable_presentation
    ADD CONSTRAINT fk_vp_standard_variable
        FOREIGN KEY (has_standard_variable)
        REFERENCES modelcatalog_standard_variable(id)
        ON DELETE SET NULL
        DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE modelcatalog_variable_presentation
    ADD CONSTRAINT fk_vp_unit
        FOREIGN KEY (uses_unit)
        REFERENCES modelcatalog_unit(id)
        ON DELETE SET NULL
        DEFERRABLE INITIALLY DEFERRED;
```

**Critical ordering:** The FK migration must run AFTER `modelcatalog_standard_variable` and `modelcatalog_unit` are populated by the ETL, otherwise existing VP rows with non-null `has_standard_variable`/`uses_unit` values will violate the new constraint. Use `DEFERRABLE INITIALLY DEFERRED` to allow batch loading within a transaction.

**Alternative:** Add FK constraints only after a successful ETL run (planner decision). The column values currently reference URIs that do not yet have corresponding rows in the new tables.

### Pattern 3: Hasura Metadata — Entity Table

Following `modelcatalog_model_category` (lines ~3779-3850 in tables.yaml):

```yaml
# Source: graphql_engine/metadata/tables.yaml (modelcatalog_model_category section)
- table:
    name: modelcatalog_standard_variable
    schema: public
  array_relationships:
  - name: variable_presentations
    using:
      foreign_key_constraint_on:
        column: has_standard_variable
        table:
          name: modelcatalog_variable_presentation
          schema: public
  insert_permissions:
  - role: user
    permission:
      check: {}
      columns: &sv_cols
      - id
      - label
      - description
  select_permissions:
  - role: anonymous
    permission:
      columns: [id, label, description]
      filter: {}
  - role: user
    permission:
      columns: *sv_cols
      filter: {}
  update_permissions:
  - role: user
    permission:
      columns: *sv_cols
      filter: {}
      check: null
  delete_permissions:
  - role: user
    permission:
      filter: {}
```

**Unit table** follows the same structure but with columns `[id, label]`.

**variablepresentations table** needs a new object relationship added after FK constraints exist:

```yaml
# Add to the existing modelcatalog_variable_presentation entry
  object_relationships:
  - name: standard_variable
    using:
      foreign_key_constraint_on: has_standard_variable
  - name: unit
    using:
      foreign_key_constraint_on: uses_unit
```

### Pattern 4: Resource Registry Entry (from `model-catalog-api/src/mappers/resource-registry.ts`)

The `standardvariables` and `units` entries currently have `hasuraTable: null`. Update them:

```typescript
// Source: model-catalog-api/src/mappers/resource-registry.ts lines ~947-963
standardvariables: {
  hasuraTable: 'modelcatalog_standard_variable',  // was null
  typeUri: 'https://w3id.org/okn/o/sd#StandardVariable',
  typeName: 'StandardVariable',
  typeArray: ['StandardVariable'],
  idPrefix: ID_PREFIX,
  relationships: {
    variablePresentations: {
      hasuraRelName: 'variable_presentations',
      type: 'array',
      targetResource: 'variablepresentations',
    },
  },
},

units: {
  hasuraTable: 'modelcatalog_unit',  // was null
  typeUri: 'https://w3id.org/okn/o/sd#Unit',
  typeName: 'Unit',
  typeArray: ['Unit'],
  idPrefix: ID_PREFIX,
  relationships: {
    variablePresentations: {
      hasuraRelName: 'variable_presentations',
      type: 'array',
      targetResource: 'variablepresentations',
    },
  },
},
```

**Note on `variables`:** Keep `hasuraTable: null` — no `sd:Variable` instances exist in TriG (D-03 resolved: 0 found).

### Pattern 5: ETL Extract Function

Following `extract_variable_presentations()` (lines ~1159-1192 in extract.py):

```python
# Source: etl/extract.py extract_variable_presentations() pattern
def extract_standard_variables(ds: Graph) -> List[Dict[str, Any]]:
    """Extract StandardVariable entities."""
    TYPE_STANDARD_VARIABLE = f"{config.SD}StandardVariable"
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description
    WHERE {{
        ?id a <{TYPE_STANDARD_VARIABLE}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
    }}
    """
    results = []
    for row in ds.query(query):
        results.append({
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
        })
    print(f"Extracted {len(results)} StandardVariable entities")
    return results


def extract_units(ds: Graph) -> List[Dict[str, Any]]:
    """Extract Unit entities (typed as qudt:Unit or sd:Unit)."""
    QUDT_UNIT = "http://qudt.org/1.1/schema/qudt#Unit"
    query = f"""
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label
    WHERE {{
        ?id a <{QUDT_UNIT}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
    }}
    """
    results = []
    for row in ds.query(query):
        results.append({
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
        })
    print(f"Extracted {len(results)} Unit entities")
    return results
```

**Type URI for Unit:** Units in the TriG are typed as `http://qudt.org/1.1/schema/qudt#Unit` (QUDT ontology), not `sd:Unit`. A small subset is also typed as `https://w3id.org/okn/o/sd#Unit`. The SPARQL query must use the QUDT type URI to capture all 107 Unit instances found by the audit. Add `TYPE_UNIT = "http://qudt.org/1.1/schema/qudt#Unit"` to `config.py`.

### Pattern 6: ETL Load Order Update

Add new entity tables to `load_order` in `load.py` before `modelcatalog_variable_presentation` (since VP will eventually FK-reference them):

```python
# Source: etl/load.py load_all() load_order list
load_order = [
    ...
    'modelcatalog_standard_variable',  # NEW — before variable_presentation
    'modelcatalog_unit',               # NEW — before variable_presentation
    'modelcatalog_variable_presentation',
    ...
]
```

Also add to `clear_all()` TRUNCATE list (before `modelcatalog_variable_presentation` due to FK):

```sql
-- add to TRUNCATE in clear_all()
modelcatalog_standard_variable,
modelcatalog_unit,
```

### Anti-Patterns to Avoid

- **Adding FK constraint before ETL runs:** The 605 existing VP rows with `has_standard_variable` and `uses_unit` values will violate FK constraints if the referenced tables are empty. Always populate `modelcatalog_standard_variable` and `modelcatalog_unit` before adding the FK.
- **Using `sd:Unit` type URI for SPARQL extraction:** Most Unit instances are typed as `qudt:Unit`, not `sd:Unit`. Using `sd:Unit` alone would miss most records.
- **Creating the `modelcatalog_variable` table:** D-03 is resolved — 0 plain `sd:Variable` instances exist in TriG. Building a table for them wastes effort.
- **Assuming junction sparsity means broken ETL:** The SPARQL extraction code for all 4 variable junction relationships exists and is correctly wired. Sparsity may reflect the actual TriG data having few explicit variable-to-parent relationship triples. Must diagnose first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Batch PostgreSQL insert | Custom loop | `execute_batch` from psycopg2.extras | Already the pattern in `etl/load.py` |
| Hasura permission YAML | Manual construction | Copy YAML anchor pattern from tables.yaml | YAML anchors (`&id020`, `*id020`) are already used throughout tables.yaml for DRY column lists |
| FK validation in ETL | Custom validator | Existing `valid_*_ids` set pattern in transform.py | All other junction builders use this pattern |
| API CRUD handlers | Custom handler | Existing generic service handles it once `hasuraTable` is set | `null` → real table name in resource-registry.ts unlocks full CRUD via the generic service |

**Key insight:** The generic service layer (`model-catalog-api/src/services/service.ts`) already handles CRUD for any resource registered with a non-null `hasuraTable`. Updating `standardvariables.hasuraTable` and `units.hasuraTable` from `null` to their actual table names is the only API-layer change needed (plus resource registry relationship configs).

---

## Runtime State Inventory

Not applicable — this is a greenfield addition (new tables, not a rename/refactor). No stored data needs migration. Existing `variable_presentation.has_standard_variable` and `uses_unit` columns contain URI strings that will become FK-validated after the new tables are populated by ETL.

---

## Common Pitfalls

### Pitfall 1: FK Constraint Ordering

**What goes wrong:** Adding FK constraints to `modelcatalog_variable_presentation` before `modelcatalog_standard_variable` and `modelcatalog_unit` are populated causes existing VP rows to violate referential integrity.

**Why it happens:** 349 VP rows have non-null `has_standard_variable` values, 476 have non-null `uses_unit` values. These URIs don't exist in any table yet.

**How to avoid:** Split into two migrations. Migration 1: CREATE new tables. Run ETL to populate them. Migration 2: ALTER TABLE to add FK constraints. Alternatively, use `DEFERRABLE INITIALLY DEFERRED` FK and load everything in one transaction.

**Warning signs:** `psycopg2.errors.ForeignKeyViolation` during ETL run after adding FK but before ETL populates new tables.

### Pitfall 2: Unit Type URI Mismatch

**What goes wrong:** SPARQL query uses `sd:Unit` type URI and extracts 0 or very few units.

**Why it happens:** The TriG data types units as `http://qudt.org/1.1/schema/qudt#Unit` (QUDT ontology), not `https://w3id.org/okn/o/sd#Unit`. The rdflib audit found 107 `qudt:Unit` instances but the `sd:Unit` count was not separately measured.

**How to avoid:** Use `qudt:Unit` as the primary type in the SPARQL extraction query for units. Optionally add `sd:Unit` as a secondary type with UNION.

**Warning signs:** `extract_units()` returning < 50 results.

### Pitfall 3: Duplicate StandardVariable URIs Across TriG Files

**What goes wrong:** Loading all seven TriG files results in duplicate StandardVariable rows.

**Why it happens:** The same StandardVariable entities (e.g., MINT canonical variables) appear in multiple catalog partitions (model-catalog.trig and model-catalog-dev.trig each have ~303 instances with significant overlap).

**How to avoid:** The existing `deduplicate_by_id()` function in `transform.py` handles this — apply it to `standard_variables` and `units` collections exactly as it is applied to `variable_presentations`.

**Warning signs:** Unique constraint violations on `modelcatalog_standard_variable.id` during ETL load.

### Pitfall 4: Junction Sparsity May Be Data, Not Bug

**What goes wrong:** Plan tasks assume ETL is broken and schedule complex debugging work, but the TriG data simply doesn't have the relationships.

**Why it happens:** The ETL extraction code for all 4 variable junction relationships is present and wired in `extract_software_versions()` (lines ~322-356 in extract.py) and `extract_model_configuration_setups()` (lines ~763-791). The code was written and not reported as broken.

**How to avoid:** Run a diagnostic SPARQL count query against the TriG before writing ETL repair tasks. If the TriG has 0 `hasInputVariable` triples, junction sparsity is expected.

**Warning signs:** ETL produces 0 junction rows AND diagnostic SPARQL also shows 0 triples — this is data absence, not a bug.

### Pitfall 5: `has_standard_variable` Column Needs Hasura Object Relationship

**What goes wrong:** After adding FK, Hasura cannot traverse `VariablePresentation -> StandardVariable` because no object relationship is configured.

**Why it happens:** The existing `modelcatalog_variable_presentation` entry in tables.yaml has only array relationships (junction tables going out). The `has_standard_variable` and `uses_unit` scalar FK columns need object relationships declared.

**How to avoid:** After adding FK constraints in the migration, also update `tables.yaml` to add `object_relationships` for `standard_variable` and `unit` on the `modelcatalog_variable_presentation` table entry.

---

## Code Examples

### Verified: Diagnostic SPARQL for Junction Sparsity

Run this against the TriG to determine if relationships exist before writing ETL repair tasks:

```python
# Source: pattern from etl/extract.py
input_var_query = f"""
PREFIX sdm: <{config.SDM}>

SELECT (COUNT(*) AS ?count)
WHERE {{
    ?version sdm:hasInputVariable ?variable .
}}
"""
result = list(ds.query(input_var_query))
print(f"hasInputVariable triples: {result[0][0]}")
```

### Verified: TRUNCATE Order in clear_all()

New tables must appear in `clear_all()` BEFORE `modelcatalog_variable_presentation` because of the FK dependency chain:

```python
# Source: etl/load.py clear_all() truncate list
cur.execute("""
    TRUNCATE TABLE
        ...
        modelcatalog_standard_variable,   # ADD - referenced by VP
        modelcatalog_unit,                # ADD - referenced by VP
        modelcatalog_variable_presentation,
        ...
    CASCADE
""")
```

### Verified: API null-table behavior (before this phase)

The existing generic service returns `200 []` for list and `404` for get-by-id when `hasuraTable: null`. This matches the established pattern documented in STATE.md:

> `[Phase 02-api-integration]: null-table resource types return 200 [] for list and 404 for get-by-id`

After this phase, `standardvariables` and `units` will return real data without any service code changes.

---

## D-03 Decision: No `modelcatalog_variable` Table

**Finding (HIGH confidence, verified by rdflib query against model-catalog.trig):**

```
StandardVariable instances: 303
Unit instances (qudt): 107
Variable (abstract) instances: 0
```

The abstract `sd:Variable` type has no instances in the TriG data. The `variables` resource entry in the API registry (`hasuraTable: null`) should remain `null`. No migration, no ETL code, no Hasura metadata needed for this type.

---

## D-09 Properties: Actual Scalar Columns

**Finding (HIGH confidence, rdflib predicate audit on model-catalog.trig):**

### StandardVariable

| TriG Predicate | Column Name | Type | Notes |
|----------------|-------------|------|-------|
| URI subject | `id` | TEXT PK | Full URI |
| `rdfs:label` | `label` | TEXT NOT NULL | e.g., "channel_water__24-hour..." |
| `sd:description` | `description` | TEXT | Optional free-text |
| `owl:sameAs` | _(skip)_ | — | External ontology URI link — not useful for API surface |

### Unit

| TriG Predicate | Column Name | Type | Notes |
|----------------|-------------|------|-------|
| URI subject | `id` | TEXT PK | Full URI (URL-encoded) |
| `rdfs:label` | `label` | TEXT NOT NULL | e.g., "m^3/s", "%" |
| `qudt:abbreviation` | _(skip)_ | — | QUDT ontology — out of sd API scope |
| `ccut:hasDimension` | _(skip)_ | — | CCUT ontology — out of sd API scope |
| `ccut:hasPart` | _(skip)_ | — | CCUT ontology — out of sd API scope |

Only `id` and `label` are needed for the Unit table. The QUDT/CCUT predicates are not part of the `sd:` ontology surface exposed by the API.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| URI string in `has_standard_variable` (denormalized) | FK to `modelcatalog_standard_variable` | This phase | Enables relational joins, label display, cross-model matching |
| URI string in `uses_unit` (denormalized) | FK to `modelcatalog_unit` | This phase | Enables unit metadata display and filtering |
| Junction tables nearly empty | Populated from TriG after ETL fix | This phase | Variable relationships usable from API |

---

## Open Questions

1. **Junction Sparsity Root Cause**
   - What we know: ETL extraction code for all 4 variable junctions is present and wired in. Junction tables have 2-20 rows (integration test data only).
   - What's unclear: Whether the TriG source data actually contains `hasInputVariable`/`hasOutputVariable`/`calibratedVariable`/`calibrationTargetVariable` triples at meaningful volume. The extraction code has never been reported as broken.
   - Recommendation: The FIRST task in the plan should run a diagnostic SPARQL count on all 4 relationship predicates across the main TriG file. If counts are > 0 but < expected, investigate ETL. If counts are near-zero, the data simply lacks those relationships and junction population is complete.

2. **FK Constraint Timing**
   - What we know: 605 VP rows have URIs in `has_standard_variable`/`uses_unit`. FK migration will fail if those URIs don't exist in new tables.
   - What's unclear: Whether the ETL will produce exactly matching URIs (same URL encoding, same namespace expansion).
   - Recommendation: Run ETL first, verify row counts and URI match, THEN apply FK migration.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | ETL load, FK migration | Assumed (Phase 1-4 completed successfully) | — | — |
| rdflib (Python) | ETL extract | Yes (used in all prior phases) | — | — |
| psycopg2 (Python) | ETL load | Yes (used in all prior phases) | — | — |
| Hasura (running in cluster) | Metadata apply | Assumed (deploy-hasura.sh script exists) | — | — |
| deploy-hasura.sh | Migrations + metadata apply | Yes (`scripts/deploy-hasura.sh` from quick-260328-hu8) | — | — |

---

## Validation Architecture

> `workflow.nyquist_validation` key is absent from `.planning/config.json` — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | `model-catalog-api/vitest.config.ts` (inferred from existing test files) |
| Quick run command | `cd model-catalog-api && npm test -- --run` |
| Full suite command | `cd model-catalog-api && npm test -- --run` |
| Integration test run | `MINT_API_TOKEN=<token> npm test -- junction-integration` |

### Phase Requirements to Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| D-01 | GET /standardvariables returns list | smoke (live HTTP) | `MINT_API_TOKEN=<token> npm test -- junction-integration` | Extend `junction-integration.test.ts` |
| D-02 | GET /units returns list | smoke (live HTTP) | Same | Extend existing file |
| D-06 | POST/PUT/DELETE on standardvariables and units | integration (live HTTP) | Same | Extend existing file |
| D-07 | VP response includes `hasStandardVariable` object (not URI string) | integration | Same | Extend existing file |
| D-08 | FK enforced — VP insert with unknown standard_variable URI fails | unit | `npm test -- service` | New test or existing service test |

### Wave 0 Gaps

- [ ] Add `standardvariables` and `units` CRUD tests to `model-catalog-api/src/__tests__/junction-integration.test.ts`
- [ ] Add VP relationship traversal test (VP returns embedded StandardVariable object)
- No new framework setup needed — vitest is already configured.

---

## Sources

### Primary (HIGH confidence)

- `etl/extract.py` — SPARQL extraction patterns, actual extraction code for all entity and junction types
- `etl/transform.py` — Junction builder pattern with FK validation
- `etl/load.py` — Load order, `clear_all`, `load_table`, `load_self_referential_table` patterns
- `graphql_engine/metadata/tables.yaml` — Hasura metadata YAML patterns for entity tables
- `graphql_engine/migrations/1771200004000_modelcatalog_configuration_category/up.sql` — Most recent migration pattern
- `model-catalog-api/src/mappers/resource-registry.ts` — Resource registry entry structure including null-table resources
- `.planning/quick/260328-r01-analyze-variables-hasura-vs-trig-fuseki/VARIABLE-ANALYSIS.md` — Comprehensive pre-analysis

### Secondary (MEDIUM confidence)

- rdflib SPARQL query results against `/model-catalog-endpoint/data/model-catalog.trig` — used to count entity instances and enumerate predicates for D-03 and D-09
- `graphql_engine/migrations/1771200001000_fk_migration_parameter/up.sql` — FK migration pattern (referenced by name, content not read but inferred from pattern)

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools already in use
- Architecture patterns: HIGH — code was directly read and patterns verified against existing implementations
- Entity properties: HIGH — rdflib query against actual TriG data
- D-03 (no Variable table): HIGH — rdflib query returned 0 instances
- Junction sparsity root cause: MEDIUM — extraction code is present but actual TriG relationship counts not measured (flagged as Open Question 1)
- FK constraint timing: MEDIUM — URI matching between TriG extracts and existing VP column values not verified

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain — TriG data and codebase patterns do not change rapidly)
