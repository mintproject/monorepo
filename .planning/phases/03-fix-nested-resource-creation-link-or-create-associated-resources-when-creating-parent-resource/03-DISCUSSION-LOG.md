# Phase 3: Fix nested resource creation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 03-fix-nested-resource-creation-link-or-create-associated-resources-when-creating-parent-resource
**Areas discussed:** Linking vs Creating, Mutation Approach, Error Handling, Relationship Scope

---

## Linking vs Creating

### Q1: When a nested resource ID doesn't exist in the database, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Link only | Only create junction rows pointing to existing resources. If nested ID doesn't exist, treat as error. | |
| Link or create | If nested resource exists, link it. If not, create it first, then link. Matches v1.8.0 Fuseki behavior. | ✓ |
| You decide | Claude picks based on codebase patterns and Hasura capabilities. | |

**User's choice:** Link or create
**Notes:** Matches the Fuseki behavior where triples were created freely.

### Q2: When creating a new nested resource on the fly, should it use only provided fields or apply defaults?

| Option | Description | Selected |
|--------|-------------|----------|
| Use provided fields + defaults | Same logic as top-level creation: generate UUID if no ID, set type URI, map camelCase. | ✓ |
| Use only provided fields | Insert exactly what's in the nested object. No auto-generated defaults. | |
| You decide | Claude picks based on consistency with existing create logic. | |

**User's choice:** Use provided fields + defaults

---

## Mutation Approach

### Q3: How should the mutations be structured?

| Option | Description | Selected |
|--------|-------------|----------|
| Hasura nested inserts | Single mutation with nested insert syntax. Atomic, simpler error handling. | ✓ |
| Sequential mutations | Insert parent first, then junction rows separately. Not atomic. | |
| You decide | Claude picks based on Hasura capabilities. | |

**User's choice:** Hasura nested inserts

### Q4: Use on_conflict (upsert) for link-or-create with nested inserts?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, use on_conflict upsert | Handles both cases: existing resource = no-op update, new = created. Atomic. | ✓ |
| Check existence first | Query for nested IDs before mutation. Two round-trips but more explicit. | |
| You decide | Claude picks best approach. | |

**User's choice:** Yes, use on_conflict upsert

---

## Error Handling

### Q5: If the nested insert mutation fails, what should the API return?

| Option | Description | Selected |
|--------|-------------|----------|
| Fail entire request | Return 400/422 with error details. Nothing created if any part fails. | ✓ |
| Create parent, report nested failures | Try parent regardless. Return 201 with warnings. | |
| You decide | Claude picks based on atomic mutation approach. | |

**User's choice:** Fail entire request

---

## Relationship Scope

### Q6: Should nested resource creation apply to all junction-based relationships or a subset?

| Option | Description | Selected |
|--------|-------------|----------|
| All junction relationships | Handle all 20+ junction-based relationships generically using resource-registry metadata. | ✓ |
| Start with hasModelCategory only | Implement for immediate need, extend later. | |
| Junction + object relationships | Also handle non-junction direct FK nested resources. | |

**User's choice:** All junction relationships

### Q7: Should the same nested handling also apply to PUT (update) requests?

| Option | Description | Selected |
|--------|-------------|----------|
| POST and PUT both | Updates should also set/replace nested relationships. For PUT: replace all junction rows. | ✓ |
| POST only for now | Only handle nested resources during creation. | |
| You decide | Claude picks based on update handler. | |

**User's choice:** POST and PUT both

---

## Claude's Discretion

- Implementation details of `toHasuraInput()` refactoring
- Junction FK column name resolution from metadata
- Helper function organization

## Deferred Ideas

None — discussion stayed within phase scope
