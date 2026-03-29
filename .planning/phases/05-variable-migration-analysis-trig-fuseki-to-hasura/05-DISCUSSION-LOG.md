# Phase 5: Variable Migration Analysis: TriG/Fuseki to Hasura - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 05-variable-migration-analysis-trig-fuseki-to-hasura
**Areas discussed:** Migration scope, Junction population, API integration, Schema design

---

## Migration Scope

### Which entities get tables?

| Option | Description | Selected |
|--------|-------------|----------|
| StandardVariable (Recommended) | 313 distinct URIs referenced by 349 VPs. Enables cross-model variable matching. | ✓ |
| Unit | 91 distinct unit URIs referenced by 476 VPs. Enables unit metadata display. | ✓ |
| Variable (abstract) | Abstract base type. Low practical value since VP already captures concrete instances. | ✓ |

**User's choice:** All three selected
**Notes:** None

### Variable table intent

| Option | Description | Selected |
|--------|-------------|----------|
| Table for future use | Create empty table even if no rows today | |
| Only if TriG has data | Create only if actual sd:Variable instances exist in TriG | ✓ |
| You decide | Claude investigates during research | |

**User's choice:** Only if TriG has data
**Notes:** Conditional on actual data existing in TriG source files

---

## Junction Population

### Approach to near-empty junction tables

| Option | Description | Selected |
|--------|-------------|----------|
| Investigate + fix ETL (Recommended) | Check TriG for relationships, fix extraction if they exist | ✓ |
| Accept sparse data | Document and move on if source is genuinely sparse | |
| Both: investigate then decide | Research first, then decide based on findings | |

**User's choice:** Investigate + fix ETL
**Notes:** None

### ETL scope for new entities

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, full ETL update (Recommended) | Single pass: StandardVariable + Unit metadata + all junctions | ✓ |
| Separate passes | Fix junctions first, then add StandardVariable/Unit as second update | |

**User's choice:** Full ETL update in one pass
**Notes:** None

---

## API Integration

### Access level for new entities

| Option | Description | Selected |
|--------|-------------|----------|
| Full CRUD (Recommended) | Full REST CRUD consistent with existing pattern | ✓ |
| Read-only | Only GET list and GET by-id | |
| Read + create, no update/delete | Append-only reference data | |

**User's choice:** Full CRUD
**Notes:** None

### Relationship traversal

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, bidirectional (Recommended) | StandardVariable <-> VP and Unit <-> VP | ✓ |
| Parent-to-child only | Only VP -> StandardVariable/Unit direction | |
| You decide | Claude determines based on existing patterns | |

**User's choice:** Bidirectional
**Notes:** Matches existing bidirectional junction pattern from Phase 1

---

## Schema Design

### FK constraints

| Option | Description | Selected |
|--------|-------------|----------|
| Add FKs (Recommended) | FK constraints on has_standard_variable and uses_unit columns | ✓ |
| Keep denormalized | No FKs, keep TEXT columns as-is | |
| FK with fallback | FKs with NULLs for unresolvable URIs | |

**User's choice:** Add FKs
**Notes:** Full referential integrity

### StandardVariable table schema

| Option | Description | Selected |
|--------|-------------|----------|
| Match TriG properties | Extract whatever properties exist on sd:StandardVariable in TriG | ✓ |
| Minimal (id + label) | Just id and label, others only if they exist | |
| You decide | Claude investigates and designs based on actual data | |

**User's choice:** Match TriG properties
**Notes:** Research phase must extract actual properties from ontology/data

---

## Claude's Discretion

- Index strategy for new tables and FK columns
- Hasura metadata configuration details
- ETL implementation details (SPARQL queries, transform logic)
- Migration ordering

## Deferred Ideas

None — discussion stayed within phase scope.
