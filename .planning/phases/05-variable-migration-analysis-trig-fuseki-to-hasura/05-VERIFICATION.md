---
phase: 05-variable-migration-analysis-trig-fuseki-to-hasura
verified: 2026-03-29T14:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
gaps:
  - truth: "FK constraint exists from variable_presentation.has_standard_variable to modelcatalog_standard_variable.id"
    status: resolved
    reason: "Migration directory 1771200006000_modelcatalog_variable_fk_constraints/ does not exist on disk. The graphql_engine submodule is checked out at b1483fa (Plan 01 state). Commit a66adeb, which should contain the FK migration, is not present in the local submodule history. The parent repo pointer was updated (commit 3832dda) but the submodule was never updated to that commit."
    artifacts:
      - path: "graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/up.sql"
        issue: "File does not exist — submodule not updated to commit a66adeb"
      - path: "graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/down.sql"
        issue: "File does not exist — submodule not updated to commit a66adeb"
    missing:
      - "Run `git submodule update` in the parent repo to bring graphql_engine to commit a66adeb, or verify that commit a66adeb was pushed to the graphql_engine remote"
  - truth: "FK constraint exists from variable_presentation.uses_unit to modelcatalog_unit.id"
    status: resolved
    reason: "Same root cause as above — both FK constraints are in the missing migration."
    artifacts:
      - path: "graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/up.sql"
        issue: "File does not exist — fk_vp_unit constraint not on disk"
    missing:
      - "Same fix as above — update the graphql_engine submodule"
  - truth: "Load order places standard_variable and unit before variable_presentation"
    status: resolved
    reason: "etl/load.py load_order places modelcatalog_standard_variable (line 203) and modelcatalog_unit (line 204) AFTER modelcatalog_variable_presentation (line 193). After FK constraints from Plan 03 are applied, loading VP before its FK targets will violate referential integrity. The SUMMARY documented this as an intentional deviation, but the plan explicitly required new tables before VP."
    artifacts:
      - path: "etl/load.py"
        issue: "modelcatalog_standard_variable at position 203, modelcatalog_unit at 204 — both come after modelcatalog_variable_presentation at line 193 in load_order list"
    missing:
      - "Move 'modelcatalog_standard_variable' and 'modelcatalog_unit' entries in load_order to appear before 'modelcatalog_variable_presentation'"
human_verification:
  - test: "Verify FK migration file content in graphql_engine submodule after update"
    expected: "up.sql contains ADD CONSTRAINT fk_vp_standard_variable and fk_vp_unit with ON DELETE SET NULL and DEFERRABLE INITIALLY DEFERRED"
    why_human: "Commit a66adeb is not in local submodule history; cannot read the file without fetching the remote"
---

# Phase 5: Variable Migration Analysis - Verification Report

**Phase Goal:** Complete the variable ecosystem migration by creating StandardVariable and Unit entity tables, adding FK constraints from VariablePresentation, extending the ETL pipeline to extract and load these entities, and enabling full CRUD API endpoints with bidirectional relationship traversal.
**Verified:** 2026-03-29T14:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | modelcatalog_standard_variable table DDL exists with id TEXT PK, label TEXT NOT NULL, description TEXT | VERIFIED | `graphql_engine/migrations/1771200005000.../up.sql` lines 3-7 |
| 2 | modelcatalog_unit table DDL exists with id TEXT PK, label TEXT NOT NULL | VERIFIED | Same migration, lines 12-15 |
| 3 | Hasura tracks both new tables with full CRUD permissions and bidirectional relationships | VERIFIED | `tables.yaml` lines 4076-4194 — both entries present with insert/select/update/delete permissions and array_relationships |
| 4 | VP has object_relationships for standard_variable and unit in Hasura metadata | VERIFIED | `tables.yaml` lines 4188-4194 |
| 5 | API resource registry enables CRUD for standardvariables and units with VP relationships | VERIFIED | `resource-registry.ts` lines 958-986: both entries have real hasuraTable values and relationship configs; VP has hasStandardVariable and usesUnit object relationships |
| 6 | ETL extracts StandardVariable and Unit from TriG using SPARQL | VERIFIED | `extract.py` lines 1262-1304: both functions exist, use correct type URIs from config |
| 7 | FK constraint from variable_presentation to modelcatalog_standard_variable exists | FAILED | Migration directory 1771200006000 does not exist on disk — graphql_engine submodule not updated |
| 8 | FK constraint from variable_presentation to modelcatalog_unit exists | FAILED | Same root cause as above |

**Score:** 6/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `graphql_engine/migrations/1771200005000_modelcatalog_standard_variable_unit/up.sql` | CREATE TABLE DDL for standard_variable and unit | VERIFIED | Contains both CREATE TABLE statements plus VP index statements |
| `graphql_engine/migrations/1771200005000_modelcatalog_standard_variable_unit/down.sql` | DROP TABLE rollback | VERIFIED | Contains DROP TABLE IF EXISTS for both tables and indexes |
| `graphql_engine/metadata/tables.yaml` | Hasura tracking for new tables | VERIFIED | Lines 4076-4155: both table entries with full permission sets |
| `model-catalog-api/src/mappers/resource-registry.ts` | Resource registry with real table names | VERIFIED | Lines 958-986: standardvariables and units both have real hasuraTable values |
| `etl/config.py` | Type URI constants TYPE_STANDARD_VARIABLE and TYPE_UNIT | VERIFIED | Lines 46-47: both constants present with correct URIs |
| `etl/extract.py` | SPARQL extraction functions for new entity types | VERIFIED | Lines 1262-1328: extract_standard_variables, extract_units, diagnose_junction_sparsity all present and wired into extract_all() |
| `etl/transform.py` | Dedup and label logic for new entities | VERIFIED | Lines 663-668, 691-692, 774-775: full transform pipeline for both entity types |
| `etl/load.py` | Load order with new tables before VP | FAILED | Lines 203-204: new tables appear after modelcatalog_variable_presentation (line 193), not before it |
| `graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/up.sql` | ADD CONSTRAINT FK statements | MISSING | Directory does not exist — submodule at b1483fa, not a66adeb |
| `graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/down.sql` | DROP CONSTRAINT rollback | MISSING | Directory does not exist |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `graphql_engine/metadata/tables.yaml` | modelcatalog_standard_variable | Hasura table tracking | WIRED | `name: modelcatalog_standard_variable` at line 4077 |
| `graphql_engine/metadata/tables.yaml` | modelcatalog_unit | Hasura table tracking | WIRED | `name: modelcatalog_unit` at line 4118 |
| `model-catalog-api/src/mappers/resource-registry.ts` | modelcatalog_standard_variable | hasuraTable field | WIRED | `hasuraTable: 'modelcatalog_standard_variable'` at line 959 |
| `model-catalog-api/src/mappers/resource-registry.ts` | modelcatalog_unit | hasuraTable field | WIRED | `hasuraTable: 'modelcatalog_unit'` at line 974 |
| `etl/extract.py` | `etl/config.py` | TYPE_STANDARD_VARIABLE constant | WIRED | `config.TYPE_STANDARD_VARIABLE` used in SPARQL query at line 1270 |
| `etl/load.py` | modelcatalog_standard_variable | load_order list | PARTIAL | Present in load_order (line 203) but placed AFTER modelcatalog_variable_presentation (line 193) |
| `modelcatalog_variable_presentation.has_standard_variable` | `modelcatalog_standard_variable.id` | FK constraint fk_vp_standard_variable | NOT_WIRED | Migration file missing — submodule not updated |
| `modelcatalog_variable_presentation.uses_unit` | `modelcatalog_unit.id` | FK constraint fk_vp_unit | NOT_WIRED | Migration file missing — submodule not updated |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces database schema, Hasura metadata, and ETL pipeline code, not UI components rendering dynamic data. The ETL pipeline is a batch process not a running server.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| config.py type URIs importable | `python -c "import sys; sys.path.insert(0, '/Users/mosorio/repos/mint'); from etl import config; print(config.TYPE_STANDARD_VARIABLE, config.TYPE_UNIT)"` | Skipped — running from verifier context | ? SKIP |
| extract.py has 3 new functions | `grep -c "def extract_standard_variables\|def extract_units\|def diagnose_junction_sparsity" etl/extract.py` | Returns 3 (lines 1262, 1286, 1307) | PASS |
| FK migration exists on disk | `ls graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/` | Directory not found | FAIL |

### Requirements Coverage

No REQUIREMENTS.md found at `.planning/REQUIREMENTS.md`. Requirements are defined in CONTEXT.md (05-CONTEXT.md) as decisions D-01 through D-09.

| Requirement | Source Plan | Description | Status | Evidence |
|------------|-------------|-------------|--------|---------|
| D-01 | 05-01 | Create modelcatalog_standard_variable table | SATISFIED | up.sql line 3; tables.yaml line 4077; resource-registry.ts line 959 |
| D-02 | 05-01 | Create modelcatalog_unit table | SATISFIED | up.sql line 12; tables.yaml line 4118; resource-registry.ts line 974 |
| D-03 | 05-03 | Create modelcatalog_variable table only if sd:Variable instances exist; research confirmed 0 instances | SATISFIED | No table created; variables entry keeps hasuraTable: null (resource-registry.ts line 989); documented in SUMMARY-03 |
| D-04 | 05-02 | Investigate junction table sparsity via SPARQL diagnostic | SATISFIED | `diagnose_junction_sparsity()` function wired into extract_all() at line 1357-1358 |
| D-05 | 05-02 | Single comprehensive ETL update for all new entities | SATISFIED | Single extract.py update covers StandardVariable, Unit, and diagnostic in extract_all() |
| D-06 | 05-01 | Full CRUD endpoints for StandardVariable and Unit | SATISFIED | Both entries in resource-registry.ts have real hasuraTable values; Hasura permissions in tables.yaml include insert/update/delete |
| D-07 | 05-01 | Bidirectional relationship traversal StandardVariable <-> VP and Unit <-> VP | SATISFIED | tables.yaml: array_relationships on standard_variable and unit tables, object_relationships on VP; resource-registry.ts: variablepresentations has hasStandardVariable and usesUnit |
| D-08 | 05-03 | FK constraints from VP.has_standard_variable and VP.uses_unit | BLOCKED | Migration files do not exist on disk — submodule not updated to commit a66adeb |
| D-09 | 05-01, 05-02 | Table schemas match actual RDF properties from TriG source | SATISFIED | StandardVariable: id, label, description matches research findings; Unit: id, label matches qudt:Unit properties |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `etl/load.py` | 193 vs 203-204 | modelcatalog_standard_variable and modelcatalog_unit appear AFTER modelcatalog_variable_presentation in load_order | BLOCKER | Once FK constraints from Plan 03 are applied to the running database, the ETL will fail if VP is loaded before its FK targets exist |
| `graphql_engine` submodule | — | Submodule checked out at b1483fa but parent pointer references a66adeb; `git status` shows `M graphql_engine` | BLOCKER | FK constraint migration files (1771200006000) are not accessible on disk; cannot be applied to the database |

### Human Verification Required

#### 1. Confirm Commit a66adeb Exists on Remote

**Test:** In the graphql_engine submodule directory, run `git fetch origin && git show origin/master | head` or check GitHub at `https://github.com/mintproject/graphql_engine` to confirm commit a66adeb is present on the remote master branch.
**Expected:** Commit a66adeb is present and contains `migrations/1771200006000_modelcatalog_variable_fk_constraints/up.sql` and `down.sql`.
**Why human:** The verifier cannot perform git fetch operations or access remote repositories.

#### 2. Confirm FK Migration Content After Submodule Update

**Test:** After running `git submodule update --remote graphql_engine` (or `git submodule update`), read `graphql_engine/migrations/1771200006000_modelcatalog_variable_fk_constraints/up.sql` and verify:
- Contains `ADD CONSTRAINT fk_vp_standard_variable FOREIGN KEY (has_standard_variable) REFERENCES modelcatalog_standard_variable(id)`
- Contains `ADD CONSTRAINT fk_vp_unit FOREIGN KEY (uses_unit) REFERENCES modelcatalog_unit(id)`
- Both use `ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED`
**Expected:** Both constraints present with correct semantics per D-08.
**Why human:** File is not accessible until submodule is updated.

### Gaps Summary

Three gaps block full goal achievement:

**Gap 1 (Critical — Root Cause): Submodule not updated to FK migration commit.**
The graphql_engine submodule is checked out at commit b1483fa (the state after Plan 01). The parent repo commit 3832dda recorded the submodule pointer advancing to a66adeb (Plan 03 FK migration), but `git submodule update` was never run. As a result, the migration directory `1771200006000_modelcatalog_variable_fk_constraints/` does not exist on disk and cannot be applied to the database. D-08 (FK constraints for referential integrity) is blocked.

**Fix:** Run `git submodule update` in the root of the mint repository to checkout graphql_engine at a66adeb. If a66adeb is not on the remote, the submodule commit was created locally and needs to be pushed first.

**Gap 2 (Dependent on Gap 1): FK constraints fk_vp_standard_variable and fk_vp_unit do not exist on disk.**
Truths 7 and 8 both fail from the same root cause as Gap 1.

**Gap 3 (Ordering): ETL load order is incorrect for post-FK state.**
`modelcatalog_standard_variable` and `modelcatalog_unit` are loaded after `modelcatalog_variable_presentation` in `etl/load.py`. This works now (no FK constraints enforced in DB yet), but will cause constraint violations once the Plan 03 migration is applied to a running database with ETL. The SUMMARY called this intentional but the plan spec required the opposite ordering, and the FK migration makes it a correctness issue.

**Fix:** In `etl/load.py`, move `'modelcatalog_standard_variable'` and `'modelcatalog_unit'` to appear before `'modelcatalog_variable_presentation'` in the `load_order` list.

---

_Verified: 2026-03-29T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
