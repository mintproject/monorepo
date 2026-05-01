# Phase 12: Model Catalog Configuration File Input — Tapis Compatibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 12-model-catalog-configuration-file-input-tapis-compatibility
**Areas discussed:** Flag storage + shape, Submission skip semantics, UI scope: where to expose

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Flag storage + shape | Where the flag lives + bool vs Tapis enum | ✓ |
| ETL source for flag | TriG predicate / default-required / researcher-hunt | |
| Submission skip semantics | Skip silently / skip+log / strict-Tapis match | ✓ |
| UI scope: where to expose | Configuration / Setup / both | ✓ |

User skipped ETL source — implicitly handled later in discussion via the dedicated ETL question (default to FALSE).

---

## Flag storage + shape

### Q1 — Storage location

| Option | Description | Selected |
|--------|-------------|----------|
| Junction column (Recommended) | modelcatalog_configuration_input.is_optional — per-config flexibility, Tapis-aligned | ✓ |
| Entity column | modelcatalog_dataset_specification.is_optional — global per dataset_spec | |
| Both (entity default + junction override) | Most flexible; doubles surface area | |

**User's choice:** Junction column

### Q2 — Boolean vs enum

| Option | Description | Selected |
|--------|-------------|----------|
| Boolean is_optional (Recommended) | NOT NULL DEFAULT FALSE — matches roadmap "optional flag" scope | ✓ |
| Enum input_mode TEXT | TEXT with CHECK ('REQUIRED','OPTIONAL','FIXED') — future-proofs FIXED | |
| Postgres enum type | CREATE TYPE — type-safe but inconsistent with project patterns | |

**User's choice:** Boolean is_optional

### Q3 — NOT NULL vs nullable

| Option | Description | Selected |
|--------|-------------|----------|
| NOT NULL DEFAULT FALSE (Recommended) | All existing rows backfill to FALSE; matches Phase 9/10 pattern | ✓ |
| Nullable, treat NULL as required | More forgiving; adds nullness handling at every consumer | |

**User's choice:** NOT NULL DEFAULT FALSE

### Q4 — REST API exposure shape

| Option | Description | Selected |
|--------|-------------|----------|
| Field on input object (Recommended) | is_optional flattened onto each ModelConfiguration.hasInput[] item; v1.8.0 unchanged | ✓ |
| Separate hasOptionalInput collection | Mirrors RDF; doubles surface area; worse DX | |
| Junction metadata blob | Flexible but breaks current consumers expecting flat ModelIO[] | |

**User's choice:** Field on input object

---

## Submission skip semantics

### Q1 — Skip behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Skip + log info (Recommended) | Optional + no dataset → omit from fileInputs[], log info; required-missing still throws | ✓ |
| Strict cross-check with Tapis app | Fetch app fileInput.inputMode; only skip if Tapis says OPTIONAL too | |
| Skip silently | Just omit, no log; loses observability | |

**User's choice:** Skip + log info

**Notes:** MINT trusts catalog flag. If Tapis app declares REQUIRED but MINT marks OPTIONAL, Tapis itself rejects the job — error surfaces through existing path. Cross-validation deferred.

---

## UI scope: where to expose

### Q1 — Edit surface

| Option | Description | Selected |
|--------|-------------|----------|
| Configuration + Setup, no inheritance (Recommended) | Both editors gain checkbox; each level independent; mirrors current configure UI | ✓ |
| Setup only | Only on configuration-setup edit; breaks parity with Tapis (apps live at config level) | |
| Configuration-only with Setup inherit | Single source of truth + inheritance logic; net new complexity | |

**User's choice:** Configuration + Setup, no inheritance

### Q2 — Visual marker

| Option | Description | Selected |
|--------|-------------|----------|
| Badge "optional" + checkbox in editor (Recommended) | Read views: small badge next to label; edit mode: checkbox per row | ✓ |
| Italic + checkbox | Italicize label when optional | |
| No visual marker outside edit mode | Cleanest UI but readers can't tell which inputs are optional | |

**User's choice:** Badge "optional" + checkbox in editor

### Q3 — ETL behavior on first load

| Option | Description | Selected |
|--------|-------------|----------|
| Default all to FALSE, post-migration UI/API edits (Recommended) | TriG has no SDM optional predicate; rely on DB DEFAULT FALSE; curators flip via UI/API | ✓ |
| ETL extracts custom predicate | Add SPARQL for sd:hasOptionalInput; verify any existing TriG triple uses such a predicate | |
| ETL skips column entirely | Same end-state; explicitly omit from INSERT statement | |

**User's choice:** Default all to FALSE, post-migration UI/API edits

---

## Claude's Discretion

- Exact migration filename + numbering (continues 1771200016000_* sequence)
- ALTER TABLE SQL syntax
- tables.yaml YAML diff for permissions
- resource-registry.ts shape extension for advertising junction column to buildJunctionInserts
- TS shape for UI editor's input + flag pair
- Whether to index `is_optional` (probably no)
- Log level/format for skip notice
- OpenAPI documentation wording

## Deferred Ideas

- Output optionality (Tapis has no fileOutput inputMode equivalent)
- Tapis app cross-validation at submit time
- FIXED inputMode (Tapis third state)
- ETL extraction of optional predicate from TriG
- Setup-from-Configuration flag inheritance
