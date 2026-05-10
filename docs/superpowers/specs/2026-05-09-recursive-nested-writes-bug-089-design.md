# Recursive Nested POST/PUT for model-catalog-api (bug-089)

**Date:** 2026-05-09
**Status:** Design — pending implementation
**Owner:** Maximiliano Osorio
**Related:** bug-087 (junction on_conflict label clobber + PUT FK target mismatch)
**Target version:** model-catalog-api v2.1.0 (breaking)

## Summary

Make `POST` and `PUT` on every model-catalog-api resource accept arbitrarily nested payloads that drive a single atomic Hasura mutation. Replace-subtree semantics on `PUT`. Bug-087 safe upserts (dynamic `update_columns`). Reject deprecated string-id arrays with 400. Fold in bug-087 PUT FK-target mismatch fix.

## Problem

Today, write paths in `model-catalog-api` are asymmetric and shallow:

- **POST** (`src/service.ts:200-210` + `src/mappers/request.ts buildJunctionInserts`): supports a single level of junction-based nested target inserts. With the bug-087 fix, link-only payloads emit a flat FK on the junction row; payloads with target-entity scalars emit a nested target insert with `update_columns:[]`.
- **PUT** (`src/service.ts:300-455`): junction relationships use delete-then-insert with flat FK columns only. Cannot create or update nested target entities inline. Uses naive `${junctionRelName}_id` for the FK column, which mismatches the actual FK target table for some relationships (bug-087 secondary issue: `configuration_input.input_id` targets `dataset_specification`, not `variable_presentation`).
- **Recursion:** unsupported. Software → SoftwareVersion → ModelConfiguration → ModelConfigurationSetup must be four separate calls.

Clients (UI, mint-ensemble-manager, dynamo notebooks) need to write whole subtrees in one call. PUT semantics must be predictable. Bug-087's PUT FK-target mismatch must be fixed.

## Requirements

Locked decisions:

1. **Recursive nesting on POST and PUT**, all 46 resources in `resource-registry.ts`.
2. **PUT replace semantics** — payload IS the new state of every relationship at every depth. Direct children not in payload get unlinked/deleted.
3. **Single atomic Hasura mutation** per request — single Postgres transaction, all-or-nothing.
4. **Dynamic `update_columns`** per nested row = exact list of scalar fields the client supplied for that row. id-only payload → `update_columns:[]` → bug-087 safe link. id+scalars → updates only those columns.
5. **Auto-generate UUID** for nested entities missing `id` (current `${ID_PREFIX}${randomUUID()}` behavior preserved).
6. **Reject string-id arrays** (`hasInput: ["id1"]`) with HTTP 400 — breaking. Object form (`hasInput: [{id: "id1"}]`) is the only accepted shape.
7. **FK-on-child relationships recurse uniformly** with junction-based ones.
8. **Bug-087 PUT FK target mismatch** folded in: resolve target FK column from `resource-registry`, not naive `${junctionRelName}_id`.
9. **Hard caps + cycle detection**: depth ≤ 8, total nodes ≤ 500, per-relationship array length ≤ 200; reject duplicated id on ancestor path.

## Out of scope

- Cross-resource ID type validation pre-mutation (e.g., reject VP id in DatasetSpec slot before Hasura). Trust Hasura FK constraints to fire.
- Partial-update PATCH verb (PUT remains full replace).
- Recursive DELETE.
- Webhook/event emission per nested write.
- Per-resource permission checks beyond JWT forward (Hasura RLS handles).

## Architecture

```
HTTP request body
        │
        ▼
┌──────────────────────────────────────────────┐
│ buildTree(body, rootCfg)        nested-tree.ts│
│  - recurse via resource-registry              │
│  - normalize payload shape (reject string-id) │
│  - assign ids (rawId or auto-UUID)            │
│  - validate caps (depth≤8, nodes≤500, arr≤200)│
│  - cycle detection (visited-id set per branch)│
│  - capture per-node columns keys (for         │
│    dynamic update_columns)                    │
└──────────────────────────────────────────────┘
        │  WriteTree
        ▼
┌──────────────────────────────────────────────┐
│ compile(tree, verb)         mutation-compiler.ts│
│  POST → nested insert with on_conflict        │
│         per-node update_columns from columns  │
│  PUT  → multi-root mutation:                  │
│         (a) update_<root>_by_pk _set: scalars │
│         (b) for each junction: delete-by-     │
│             parent + insert nested subtree    │
│         (c) for each child-fk: clear-old +    │
│             link-new (recursing if children   │
│             carry their own subtrees)         │
│  emit (mutationStr, variables)                │
└──────────────────────────────────────────────┘
        │
        ▼
   writeClient.mutate({mutation, variables})
        │
        ▼
   Hasura → PostgreSQL  (single transaction)
```

## Modules

| File | Role | Estimated LoC |
|------|------|---------------|
| `src/mappers/nested-tree.ts` | NEW. payload → tree, validation, cycle/cap checks | ~200 |
| `src/mappers/mutation-compiler.ts` | NEW. tree → Hasura mutation string + variables | ~250 |
| `src/mappers/request.ts` | Shrink. `buildJunctionInserts` deleted; `toHasuraInput` retained for root scalars | -120 |
| `src/service.ts` | Slim `create`/`update`. Replace inline junction/childFk builders with `compile(buildTree(...))` | -150 +30 |
| `src/mappers/__tests__/nested-tree.test.ts` | NEW unit tests | ~250 |
| `src/mappers/__tests__/mutation-compiler.test.ts` | NEW unit tests | ~300 |
| `src/__tests__/integration/nested-writes.test.ts` | NEW E2E tests against running Hasura | ~200 |

## WriteTree node shape

```typescript
interface WriteNode {
  table: string;              // e.g. "modelcatalog_model_configuration"
  id: string;                 // full URI, always present (auto-gen if absent)
  columns: Record<string, unknown>;  // snake_case scalar columns from payload
                                     // keys here drive update_columns dynamically
  junctions: JunctionEdge[];  // M:M via junction table
  childFks: ChildFkEdge[];    // 1:M via FK column on child
  apiType?: string;           // for error messages and logging
}

interface JunctionEdge {
  apiFieldName: string;          // "hasInput"
  junctionTable: string;         // "modelcatalog_configuration_input"
  junctionRelName: string;       // "input"
  parentFkColumn: string;        // "configuration_id"
  targetFkColumn: string;        // resolved from registry, NOT naive `${junctionRelName}_id`
  junctionColumns: Record<string, unknown>[]; // per-row extra junction cols (is_optional, etc.)
  children: WriteNode[];         // nested target entities, one per junction row
}

interface ChildFkEdge {
  apiFieldName: string;       // "hasConfiguration"
  childTable: string;         // "modelcatalog_model_configuration"
  childFkColumn: string;      // "model_version_id"
  children: WriteNode[];
}
```

### Bug-087 fold-in: target FK resolution + better wrong-type errors

The current convention `${junctionRelName}_id` happens to be correct for every junction shipped today (e.g. `configuration_input.input_id` matches `junctionRelName='input'`). The bug-087 secondary issue was not a naming bug: the FK column name was right (`input_id`), but clients were sending a `VariablePresentation` id into a column whose FK targets `dataset_specification`. Hasura raised a generic FK violation that did not point the caller at the real cause.

Two changes fold in here:

1. **Explicit override.** Add an optional `targetFkColumn?: string` to the relationship config in `src/mappers/resource-registry.ts`. The `WriteNode` builder reads `relConfig.targetFkColumn ?? \`${relConfig.junctionRelName}_id\`` so future relationships that break the convention have a place to declare their column without changing call sites.
2. **Wrong-type error mapping.** When Hasura returns `Foreign key violation` on a junction insert, the API maps it to a 400 with hint: `"id may target wrong resource type — expected <targetResource> for <apiFieldName>"` derived from the registry. Catches the bug-087 PUT case at runtime with an actionable message.

Pre-mutation cross-resource ID type validation remains explicitly out of scope (would require a Hasura introspection call per nested id).

## Validation rules

All run during `buildTree` (pass 1 — fail fast before any GraphQL is built):

| Rule | Limit | Error code | HTTP | Message template |
|------|-------|-----------|------|------------------|
| Max depth | 8 | `DEPTH_EXCEEDED` | 400 | `"nested payload exceeds max depth 8 at <path>"` |
| Max total nodes | 500 | `TOO_MANY_NODES` | 413 | `"nested payload exceeds max nodes 500 (got N)"` |
| Max array length | 200 per relationship | `ARRAY_TOO_LONG` | 413 | `"hasX array exceeds max length 200 at <path>"` |
| Cycle detection | id seen on ancestor path | `CYCLE` | 400 | `"cycle detected: id <X> appears on its own ancestor path at <path>"` |
| String-id rejection | `hasX:["id1"]` | `STRING_ID_DEPRECATED` | 400 | `"string-id form deprecated; send [{id:'<id>'}] (resource <T>, field <F>)"` |
| Unknown relationship field | not in registry | `UNKNOWN_FIELD` | 400 | `"unknown relationship field <name> on <type>"` |
| Unknown scalar column | not in field-maps | (drop silently — current behavior) | — | — |
| Missing target config | `targetResource` has no `hasuraTable` | `TARGET_NOT_IMPLEMENTED` | 501 | `"target type <X> not implemented"` |

**Path tracking:** Each error carries a JSON-pointer-style path, e.g. `/hasVersion/0/hasConfiguration/2/hasInput/0`. Built incrementally at each recursion call site.

**Cycle detection:** `visited: Set<string>` passed by value (cloned at each recursion). A cycle = the same id appears twice on a single root→leaf path. Sibling repeats are legal (the same target linked from two configs is a normal pattern).

**Auto-id:** if `item.id` is absent at any depth, mint `${ID_PREFIX}${randomUUID()}`. The auto-generated id is logged with `apiType` to ease debugging.

## POST mutation compilation

Single root mutation using Hasura native nesting. Recursive emit per node:

```graphql
mutation CreateMutation {
  insert_modelcatalog_<table>_one(
    object: {
      id: "<root_id>",
      <scalar_columns>,
      # for each junction edge:
      <junctionRelName>: {
        data: [
          {
            <junctionColumns>,                # per-row extras (is_optional, etc.)
            <junctionRelName>: {              # nested target entity
              data: { id, <scalars>, <its own junctions/childFks recursed> },
              on_conflict: {
                constraint: <table>_pkey,
                update_columns: [<keys from node.columns>]   # bug-087 dynamic
              }
            }
          },
          ...
        ],
        on_conflict: {
          constraint: <junctionTable>_pkey,
          update_columns: []                  # junction PK never updated
        }
      },
      # for each childFk edge:
      <childRelName>: {
        data: [<child node objects, recursed>],
        on_conflict: { constraint: <childTable>_pkey, update_columns: [<keys>] }
      }
    }
  ) { id }
}
```

Per-node `update_columns = Object.keys(node.columns)`. Empty `columns` (link-only) → `[]` → no clobber (bug-087 safe). Non-empty → only those keys updated on conflict.

## PUT mutation compilation

Multi-root mutation. Replace-subtree at every level:

```graphql
mutation UpdateMutation($id: String!, $set: ..._set_input!, <var decls>) {
  # 1. Update root scalars
  update_modelcatalog_<rootTable>_by_pk(
    pk_columns: { id: $id }, _set: $set
  ) { id }

  # 2. For each junction edge in payload:
  del_<hasuraRelName>: delete_modelcatalog_<junctionTable>(
    where: { <parentFkColumn>: { _eq: $id } }
  ) { affected_rows }
  ins_<hasuraRelName>: insert_modelcatalog_<junctionTable>(
    objects: $junc_<hasuraRelName>,    # built from JunctionEdge.children, nested
    on_conflict: { constraint: <junctionTable>_pkey, update_columns: [] }
  ) { affected_rows }

  # 3. For each childFk edge in payload:
  clear_<hasuraRelName>: update_modelcatalog_<childTable>(
    where: { <childFkColumn>: { _eq: $id }, id: { _nin: $child_ids_<hasuraRelName> } },
    _set: { <childFkColumn>: null }
  ) { affected_rows }
  upsert_<hasuraRelName>: insert_modelcatalog_<childTable>(
    objects: $child_<hasuraRelName>,   # nested objects with <childFkColumn>: $id
    on_conflict: { constraint: <childTable>_pkey, update_columns: [<keys>] }
  ) { affected_rows }
}
```

### Recursion semantics

Each `objects` array contains nested `WriteNode`s rendered using the POST-style nested insert syntax. So PUT replaces direct children at the root via delete-then-insert, but each child carries its own full nested subtree with `on_conflict` semantics — all atomic in the same Hasura mutation document, hence the same Postgres transaction.

**Replace at every depth:** The delete-by-parent-FK at the root level drops all old junction rows for that parent. The inserted nested subtree carries the new state. For grandchildren: each child node's junction edges re-emit their own delete-by-parent-FK + insert in the same multi-root mutation, scoped by the child's id. Each level guarantees "what's in the payload IS the state" for its direct children.

### Bug-087 PUT FK fix

`targetFkColumn` resolved from registry, so `configuration_input` insert uses correct `input_id` → `dataset_specification` (not VariablePresentation). A wrong-table id at top level is rejected by Hasura's FK constraint with a clear error. Type-checking the id against the target table requires another query — explicitly out of scope; trust Hasura.

### Variable hoisting

Junction-edge objects and childFk-edge objects are extracted to GraphQL variables (`$junc_<x>`, `$child_<x>`) to avoid string interpolation of complex JSON. The mutation string has fixed shape; variables carry the data. Same pattern as the current PUT.

## Verb dispatch in service.ts

```typescript
// create()
const tree = buildTree(body, resourceConfig);
const { mutation, variables } = compilePost(tree);
await writeClient.mutate({ mutation, variables });

// update()
const tree = buildTree({ ...body, id: fullId }, resourceConfig);
const { mutation, variables } = compilePut(tree);
await writeClient.mutate({ mutation, variables });
```

## Error handling

| Failure | HTTP | Body shape |
|---------|------|------------|
| `buildTree` validation fail | 400 / 413 | `{ error, path, code }` (codes from validation table above) |
| Unknown root resource | 404 | `{ error: "Unknown resource type: X" }` (current behavior) |
| Hasura constraint violation | 400 | passthrough Hasura message + `{ path: <best-effort from variable name> }` |
| Hasura FK violation | 400 | `{ error: "FK violation on <column>", hint: "id may target wrong resource type" }` (catches bug-087 PUT FK runtime case) |
| Hasura auth fail | 401 | passthrough |
| Network / Hasura 5xx | 502 | `{ error: "upstream Hasura error" }` |

**Atomicity:** All writes in single mutation = single Postgres transaction = all-or-nothing. No partial state on failure.

**Logging:** On 4xx, log `{ verb, resource, root_id, error_code, path, payload_node_count }`. No payload body (PII risk + log volume). On 5xx, log full Hasura error and the emitted mutation string for debugging.

## Test strategy

Vitest, follows existing pattern in `src/mappers/__tests__/`.

### `nested-tree.test.ts`

- happy: 1-level junction (`hasInput=[{id, label}]`)
- happy: 4-level recursion (Software > Version > Config > Setup)
- happy: mixed junction + childFk at same node
- happy: link-only payload (id-only) → empty `columns` (bug-087 regression)
- happy: auto-id generation when id absent
- error: depth=9 → 400 `DEPTH_EXCEEDED` with correct path
- error: 501 nodes → 413 `TOO_MANY_NODES`
- error: array length 201 → 413 `ARRAY_TOO_LONG`
- error: cycle (id X appears as own ancestor) → 400 `CYCLE`
- error: string-id form → 400 `STRING_ID_DEPRECATED`
- error: unknown relationship field → 400 `UNKNOWN_FIELD`
- happy: junction extra columns (`is_optional`) captured on JunctionEdge

### `mutation-compiler.test.ts`

- POST: 1-level → expect Hasura nested insert with `on_conflict update_columns` matching `columns` keys
- POST: link-only → `update_columns:[]` (bug-087 regression)
- POST: 3-level recursion → assert nested structure shape
- POST: childFk relationship → nested array insert with FK column set on each child
- PUT: scalar update only (no relationships in body) → simple `update_*_by_pk`
- PUT: junction relationship → del+ins pair with correct constraint name
- PUT: childFk relationship → clear+upsert pair
- PUT: bug-087 FK fix → assert correct `<target>_id` column (not naive `${junctionRelName}_id`)
- PUT: 2-level recursion under junction → child carries its own del+ins
- PUT: variable hoisting → assert objects in `variables`, not interpolated into mutation string

### Integration (`src/__tests__/integration/nested-writes.test.ts`)

Run against a local Hasura+Postgres (existing test harness):

- POST ModelConfiguration with nested DatasetSpecification + nested VariablePresentation → query back, assert all rows persist with correct FKs
- PUT ModelConfiguration replacing `hasInput` → assert old junction rows gone, new ones present
- POST Model with full Software > Version > Config > Setup tree → assert all 4 levels persist with correct parent FKs
- PUT Software with replaced version subtree → assert old version's children cascaded out per replace semantics
- POST link-only → assert no scalar clobber on existing target row (bug-087 regression)

## Rollout (breaking change)

1. Land code on feature branch `feat/bug-089-recursive-nested-writes`.
2. Pre-deploy comms: Slack/email to UI team, mint-ensemble-manager team, dynamo team, notebook authors. Subject: `"MINT API breaking change: string-id arrays deprecated, send [{id:'...'}]"`. Include grep recipe per repo: `rg "has[A-Z]\w+:\s*\[['\"]"`.
3. Audit known callers in monorepo: `ui/`, `mint-ensemble-manager/`, `dynamo-experiment-may/`, `model-catalog-fastapi/` clients (if any exist). Open migration PRs into each.
4. `CHANGELOG.md` entry under v2.1.0. `openapi.yaml` updated to remove string-array shape from request schemas.
5. Bump `model-catalog-api` package.json version to v2.1.0 (breaking).
6. Deploy after caller PRs merged.
7. Post-deploy: monitor 400 `STRING_ID_DEPRECATED` rate for 48h. Hotfix path = restore silent-conversion fallback if an uncaught caller surfaces.

## Open questions

None — all design decisions locked through brainstorming.

## References

- `.wolf/buglog.json` — bug-087 (junction on_conflict label clobber, PUT FK target mismatch)
- `model-catalog-api/src/service.ts` — current create/update implementation
- `model-catalog-api/src/mappers/request.ts` — current `buildJunctionInserts`
- `model-catalog-api/src/mappers/resource-registry.ts` — relationship metadata, source of truth for tree-walking
- `dynamo-experiment-may/tests/test_modelconfiguration_writepaths.py` — H1-H5 hypothesis tests covering current write-path failures
- `dynamo-experiment-may/tests/modelconfig_writepaths_results.json` — recorded evidence used to diagnose bug-087
