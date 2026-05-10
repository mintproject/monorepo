# Recursive Nested POST/PUT (bug-089) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `POST` and `PUT` on every resource in `model-catalog-api` accept arbitrarily nested payloads driven by a single atomic Hasura mutation, with replace-subtree PUT semantics, dynamic `update_columns` (bug-087 safe), hard caps + cycle detection, and bug-087 PUT FK fold-in. Reject the deprecated string-id array form (`hasInput:["id1"]`) with HTTP 400.

**Architecture:** Two-pass pipeline. Pass 1: `buildTree(body, cfg)` walks the request body via `resource-registry`, normalizes payload, validates depth/nodes/array/cycle/string-id, assigns ids, captures per-node `columns` keys, returns a `WriteTree` of `WriteNode { table, id, columns, junctions[], childFks[] }`. Pass 2: `compilePost(tree)` / `compilePut(tree)` walk the tree and emit a single Hasura mutation document plus variables. `service.ts` `create`/`update` slim down to `compile(buildTree(...))` + `writeClient.mutate(...)`.

**Tech Stack:** TypeScript (Node 20+), Fastify 5, Apollo Client 4 against Hasura, Vitest 4, openapi-glue. Spec at `docs/superpowers/specs/2026-05-09-recursive-nested-writes-bug-089-design.md`.

---

## File Structure

| Path | Disposition | Responsibility |
|------|-------------|----------------|
| `model-catalog-api/src/mappers/nested-tree.ts` | **Create** | `buildTree` + `WriteNode`/`JunctionEdge`/`ChildFkEdge` types + `ValidationError` class + caps constants. Pass-1 only. |
| `model-catalog-api/src/mappers/mutation-compiler.ts` | **Create** | `compilePost(tree)` and `compilePut(tree)` returning `{ mutation: string, variables: Record<string, unknown> }`. Pass-2 only. Pure string assembly + variable hoisting. |
| `model-catalog-api/src/mappers/__tests__/nested-tree.test.ts` | **Create** | Vitest suite covering happy paths, all 8 validation rules, cycle detection, auto-id, junction extras. |
| `model-catalog-api/src/mappers/__tests__/mutation-compiler.test.ts` | **Create** | Vitest suite covering POST/PUT mutation shapes, dynamic `update_columns`, FK column resolution, variable hoisting. |
| `model-catalog-api/src/mappers/__tests__/nested-writes-integration.test.ts` | **Create** | Integration tests against running Hasura: nested POST/PUT round-trip, replace-subtree, bug-087 link-only regression, bug-087 PUT FK error. Follows existing `integration.test.ts` / `junction-integration.test.ts` convention. |
| `model-catalog-api/src/mappers/resource-registry.ts` | **Modify** | Add optional `targetFkColumn?: string` to `RelationshipConfig`. Backfill any non-conventional cases (audit; likely none today). |
| `model-catalog-api/src/mappers/request.ts` | **Modify** | Delete `buildJunctionInserts` (replaced by tree pipeline). Keep `toHasuraInput`, `camelToSnake`, `getScalarColumns`, `unwrapValue`. |
| `model-catalog-api/src/mappers/__tests__/request.test.ts` | **Modify** | Remove `buildJunctionInserts` tests (now covered by `nested-tree.test.ts` + `mutation-compiler.test.ts`). Keep `toHasuraInput` and `camelToSnake` tests. |
| `model-catalog-api/src/service.ts` | **Modify** | Replace inline junction/childFk builders in `create()` (`:200-296`) and `update()` (`:300-470`) with `compilePost(buildTree(...))` and `compilePut(buildTree(...))`. Map `ValidationError` → 400/413/501 with `{ error, code, path }`. Map Hasura FK-violation to 400 with `hint: "id may target wrong resource type"`. |
| `model-catalog-api/openapi.yaml` | **Modify** | Update request schemas for relationship arrays to require object form `[{id, ...}]`; remove string-id form. Bump `info.version` to `2.1.0`. |
| `model-catalog-api/package.json` | **Modify** | Bump `version` to `2.1.0`. |
| `model-catalog-api/CHANGELOG.md` | **Create or modify** | Add v2.1.0 entry: breaking string-id rejection, recursive nested POST/PUT, bug-087/089 fixes. |
| `.wolf/buglog.json` | **Modify** | Append `bug-089` entry on completion. |

---

## Branch Setup

- [ ] **Step 0.1: Confirm clean working tree on submodule, create branch**

Run from `/Users/mosorio/repos/mint/model-catalog-api`:

```bash
git status --short
# Expect: empty or only the in-flight bug-087 followup if not yet merged
git fetch origin
git checkout -b feat/bug-089-recursive-nested-writes
```

Expected: branch created and checked out.

- [ ] **Step 0.2: Baseline test run**

Run from `/Users/mosorio/repos/mint/model-catalog-api`:

```bash
npm install
npm test -- --run
```

Expected: all current tests pass (pre-bug-089 baseline). Record passing test count for later comparison. If failing, halt and fix baseline before proceeding.

---

## Task 1: WriteTree types and constants

**Files:**
- Create: `model-catalog-api/src/mappers/nested-tree.ts`
- Test: `model-catalog-api/src/mappers/__tests__/nested-tree.test.ts`

- [ ] **Step 1.1: Write the failing test for type exports**

Create `model-catalog-api/src/mappers/__tests__/nested-tree.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  MAX_DEPTH,
  MAX_NODES,
  MAX_ARRAY_LENGTH,
  ValidationError,
  type WriteNode,
  type JunctionEdge,
  type ChildFkEdge,
} from '../nested-tree.js';

describe('nested-tree types and constants', () => {
  it('exposes hard caps as numeric constants', () => {
    expect(MAX_DEPTH).toBe(8);
    expect(MAX_NODES).toBe(500);
    expect(MAX_ARRAY_LENGTH).toBe(200);
  });

  it('ValidationError carries code, path, message, http status', () => {
    const err = new ValidationError('DEPTH_EXCEEDED', '/hasVersion/0', 'too deep', 400);
    expect(err.code).toBe('DEPTH_EXCEEDED');
    expect(err.path).toBe('/hasVersion/0');
    expect(err.message).toBe('too deep');
    expect(err.httpStatus).toBe(400);
    expect(err).toBeInstanceOf(Error);
  });

  it('WriteNode/JunctionEdge/ChildFkEdge can be constructed', () => {
    const node: WriteNode = {
      table: 'modelcatalog_software',
      id: 'https://w3id.org/okn/i/mint/x',
      columns: { label: 'foo' },
      junctions: [],
      childFks: [],
    };
    const junc: JunctionEdge = {
      apiFieldName: 'hasInput',
      junctionTable: 'modelcatalog_configuration_input',
      junctionRelName: 'input',
      parentFkColumn: 'configuration_id',
      targetFkColumn: 'input_id',
      junctionColumns: [],
      children: [],
    };
    const child: ChildFkEdge = {
      apiFieldName: 'hasConfiguration',
      childTable: 'modelcatalog_model_configuration',
      childFkColumn: 'model_version_id',
      children: [],
    };
    expect(node.id).toBe('https://w3id.org/okn/i/mint/x');
    expect(junc.targetFkColumn).toBe('input_id');
    expect(child.childFkColumn).toBe('model_version_id');
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run from `/Users/mosorio/repos/mint/model-catalog-api`:

```bash
npm test -- --run src/mappers/__tests__/nested-tree.test.ts
```

Expected: FAIL — `Cannot find module '../nested-tree.js'`.

- [ ] **Step 1.3: Create `nested-tree.ts` with types + constants only**

Create `model-catalog-api/src/mappers/nested-tree.ts`:

```typescript
/**
 * Two-pass nested write pipeline — Pass 1.
 *
 * buildTree() (added in Task 2) walks the request body via resource-registry,
 * normalizes payload, validates caps/cycles/string-ids, assigns ids, and
 * returns a WriteTree consumed by mutation-compiler.ts.
 */

export const MAX_DEPTH = 8;
export const MAX_NODES = 500;
export const MAX_ARRAY_LENGTH = 200;

export type ValidationCode =
  | 'DEPTH_EXCEEDED'
  | 'TOO_MANY_NODES'
  | 'ARRAY_TOO_LONG'
  | 'CYCLE'
  | 'STRING_ID_DEPRECATED'
  | 'UNKNOWN_FIELD'
  | 'TARGET_NOT_IMPLEMENTED';

export class ValidationError extends Error {
  constructor(
    public readonly code: ValidationCode,
    public readonly path: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface WriteNode {
  table: string;
  id: string;
  columns: Record<string, unknown>;
  junctions: JunctionEdge[];
  childFks: ChildFkEdge[];
  apiType?: string;
}

export interface JunctionEdge {
  apiFieldName: string;
  junctionTable: string;
  junctionRelName: string;
  parentFkColumn: string;
  targetFkColumn: string;
  junctionColumns: Record<string, unknown>[];
  children: WriteNode[];
}

export interface ChildFkEdge {
  apiFieldName: string;
  childTable: string;
  childFkColumn: string;
  children: WriteNode[];
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run:

```bash
npm test -- --run src/mappers/__tests__/nested-tree.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 1.5: Commit**

```bash
git add src/mappers/nested-tree.ts src/mappers/__tests__/nested-tree.test.ts
git commit -m "feat(nested-tree): add WriteTree types and validation caps"
```

---

## Task 2: buildTree happy path — single-level junction

**Files:**
- Modify: `model-catalog-api/src/mappers/nested-tree.ts`
- Test: `model-catalog-api/src/mappers/__tests__/nested-tree.test.ts`

- [ ] **Step 2.1: Write failing test for single-level junction tree**

Append to `model-catalog-api/src/mappers/__tests__/nested-tree.test.ts`:

```typescript
import { buildTree } from '../nested-tree.js';
import { getResourceConfig } from '../resource-registry.js';

describe('buildTree — single-level junction', () => {
  it('builds tree for ModelConfiguration with hasInput id-only payload', () => {
    const cfg = getResourceConfig('modelconfigurations')!;
    const body = {
      id: 'cfg-1',
      label: 'my config',
      hasInput: [{ id: 'ds-existing-1' }],
    };

    const tree = buildTree(body, cfg);

    expect(tree.table).toBe('modelcatalog_configuration');
    expect(tree.id).toBe('https://w3id.org/okn/i/mint/cfg-1');
    expect(tree.columns).toEqual({ label: 'my config' });
    expect(tree.junctions).toHaveLength(1);

    const j = tree.junctions[0];
    expect(j.apiFieldName).toBe('hasInput');
    expect(j.junctionTable).toBe('modelcatalog_configuration_input');
    expect(j.junctionRelName).toBe('input');
    expect(j.parentFkColumn).toBe('configuration_id');
    expect(j.targetFkColumn).toBe('input_id');
    expect(j.children).toHaveLength(1);
    expect(j.children[0].id).toBe('https://w3id.org/okn/i/mint/ds-existing-1');
    expect(j.children[0].columns).toEqual({}); // link-only, bug-087 safe
    expect(j.children[0].table).toBe('modelcatalog_dataset_specification');
  });

  it('captures scalar fields on nested target entity (upsert path)', () => {
    const cfg = getResourceConfig('modelconfigurations')!;
    const body = {
      id: 'cfg-2',
      hasInput: [{ id: 'ds-2', label: 'updated label' }],
    };
    const tree = buildTree(body, cfg);
    expect(tree.junctions[0].children[0].columns).toEqual({ label: 'updated label' });
  });

  it('captures junction extra columns (is_optional)', () => {
    const cfg = getResourceConfig('modelconfigurations')!;
    const body = {
      id: 'cfg-3',
      hasInput: [{ id: 'ds-3', isOptional: true }],
    };
    const tree = buildTree(body, cfg);
    expect(tree.junctions[0].junctionColumns).toEqual([{ is_optional: true }]);
    expect(tree.junctions[0].children[0].columns).toEqual({});
  });

  it('auto-generates id when nested entity lacks one', () => {
    const cfg = getResourceConfig('modelconfigurations')!;
    const body = {
      id: 'cfg-4',
      hasInput: [{ label: 'brand new ds' }],
    };
    const tree = buildTree(body, cfg);
    expect(tree.junctions[0].children[0].id).toMatch(/^https:\/\/w3id\.org\/okn\/i\/mint\/[0-9a-f-]{36}$/);
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
npm test -- --run src/mappers/__tests__/nested-tree.test.ts
```

Expected: FAIL — `buildTree` not exported.

- [ ] **Step 2.3: Implement minimal `buildTree` for single-level junctions**

Append to `model-catalog-api/src/mappers/nested-tree.ts`:

```typescript
import { randomUUID } from 'crypto';
import { FIELD_SELECTIONS } from '../hasura/field-maps.js';
import { getResourceConfig, type ResourceConfig, type RelationshipConfig } from './resource-registry.js';
import { camelToSnake } from './request.js';

const ID_PREFIX = 'https://w3id.org/okn/i/mint/';

interface BuildContext {
  visited: Set<string>;
  nodeCount: { n: number };
  depth: number;
  path: string;
}

function getScalarColumns(tableName: string): Set<string> {
  const selection = FIELD_SELECTIONS[tableName];
  if (!selection) return new Set();
  const cols = new Set<string>();
  for (const raw of selection.split('\n')) {
    const line = raw.trim();
    if (!line || line.includes('{') || line.includes('}')) continue;
    if (/^\w+$/.test(line)) cols.add(line);
  }
  return cols;
}

function unwrapScalar(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.length === 1) {
      const item = value[0];
      if (item !== null && typeof item === 'object') return null;
      return item;
    }
    return value.filter((i) => i === null || typeof i !== 'object');
  }
  if (value !== null && typeof value === 'object') return null;
  return value;
}

function resolveId(rawId: string | undefined): string {
  if (!rawId) return `${ID_PREFIX}${randomUUID()}`;
  return rawId.startsWith('https://') ? rawId : `${ID_PREFIX}${rawId}`;
}

function resolveTargetFkColumn(rel: RelationshipConfig): string {
  return (rel as { targetFkColumn?: string }).targetFkColumn ?? `${rel.junctionRelName!}_id`;
}

function buildJunctionEdge(
  apiFieldName: string,
  rel: RelationshipConfig,
  rawValue: unknown,
  ctx: BuildContext,
): JunctionEdge | null {
  if (!Array.isArray(rawValue)) return null;
  const targetCfg = getResourceConfig(rel.targetResource);
  if (!targetCfg?.hasuraTable) {
    throw new ValidationError(
      'TARGET_NOT_IMPLEMENTED',
      ctx.path + '/' + apiFieldName,
      `target type ${rel.targetResource} not implemented`,
      501,
    );
  }
  const junctionExtraCamel = new Set(rel.junctionColumns ? Object.values(rel.junctionColumns) : []);
  const children: WriteNode[] = [];
  const junctionColumns: Record<string, unknown>[] = [];

  rawValue.forEach((item, idx) => {
    const itemPath = `${ctx.path}/${apiFieldName}/${idx}`;
    if (typeof item === 'string') {
      throw new ValidationError(
        'STRING_ID_DEPRECATED',
        itemPath,
        `string-id form deprecated; send [{id:'${item}'}] (field ${apiFieldName})`,
        400,
      );
    }
    if (item === null || typeof item !== 'object') {
      throw new ValidationError(
        'UNKNOWN_FIELD',
        itemPath,
        `relationship items must be objects with id`,
        400,
      );
    }
    const childCtx: BuildContext = {
      visited: new Set(ctx.visited),
      nodeCount: ctx.nodeCount,
      depth: ctx.depth + 1,
      path: itemPath,
    };
    const childNode = buildNode(item as Record<string, unknown>, targetCfg, childCtx, junctionExtraCamel);
    children.push(childNode);

    const extras: Record<string, unknown> = {};
    if (rel.junctionColumns) {
      for (const [colName, camelKey] of Object.entries(rel.junctionColumns)) {
        if ((item as Record<string, unknown>)[camelKey] !== undefined) {
          extras[colName] = (item as Record<string, unknown>)[camelKey];
        }
      }
    }
    junctionColumns.push(extras);
  });

  return {
    apiFieldName,
    junctionTable: rel.junctionTable!,
    junctionRelName: rel.junctionRelName!,
    parentFkColumn: rel.parentFkColumn!,
    targetFkColumn: resolveTargetFkColumn(rel),
    junctionColumns,
    children,
  };
}

function buildNode(
  body: Record<string, unknown>,
  cfg: ResourceConfig,
  ctx: BuildContext,
  excludeKeys: Set<string> = new Set(),
): WriteNode {
  if (ctx.depth > MAX_DEPTH) {
    throw new ValidationError('DEPTH_EXCEEDED', ctx.path, `nested payload exceeds max depth ${MAX_DEPTH} at ${ctx.path}`, 400);
  }
  ctx.nodeCount.n += 1;
  if (ctx.nodeCount.n > MAX_NODES) {
    throw new ValidationError('TOO_MANY_NODES', ctx.path, `nested payload exceeds max nodes ${MAX_NODES} (got ${ctx.nodeCount.n})`, 413);
  }

  const id = resolveId(body['id'] as string | undefined);

  if (ctx.visited.has(id)) {
    throw new ValidationError('CYCLE', ctx.path, `cycle detected: id ${id} appears on its own ancestor path at ${ctx.path}`, 400);
  }
  ctx.visited.add(id);

  if (!cfg.hasuraTable) {
    throw new ValidationError('TARGET_NOT_IMPLEMENTED', ctx.path, `target type has no Hasura table`, 501);
  }

  const scalarCols = getScalarColumns(cfg.hasuraTable);
  const relApiNames = new Set(Object.keys(cfg.relationships));
  const columns: Record<string, unknown> = {};
  const junctions: JunctionEdge[] = [];
  const childFks: ChildFkEdge[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (key === 'id' || key === 'type') continue;
    if (excludeKeys.has(key)) continue;

    if (relApiNames.has(key)) {
      if (Array.isArray(value) && value.length > MAX_ARRAY_LENGTH) {
        throw new ValidationError(
          'ARRAY_TOO_LONG',
          `${ctx.path}/${key}`,
          `${key} array exceeds max length ${MAX_ARRAY_LENGTH} at ${ctx.path}`,
          413,
        );
      }
      const rel = cfg.relationships[key];
      if (rel.junctionTable && rel.junctionRelName && rel.parentFkColumn) {
        const edge = buildJunctionEdge(key, rel, value, ctx);
        if (edge) junctions.push(edge);
      }
      // childFk handled in Task 4
      continue;
    }

    const snake = camelToSnake(key);
    if (!scalarCols.has(snake)) continue;
    const unwrapped = unwrapScalar(value);
    if (unwrapped === null || unwrapped === undefined) continue;
    columns[snake] = unwrapped;
  }

  return {
    table: cfg.hasuraTable,
    id,
    columns,
    junctions,
    childFks,
    apiType: cfg.typeName,
  };
}

export function buildTree(body: Record<string, unknown>, rootCfg: ResourceConfig): WriteNode {
  const ctx: BuildContext = {
    visited: new Set<string>(),
    nodeCount: { n: 0 },
    depth: 1,
    path: '',
  };
  return buildNode(body, rootCfg, ctx);
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
npm test -- --run src/mappers/__tests__/nested-tree.test.ts
```

Expected: PASS (7 tests total — 3 from Task 1 + 4 here).

- [ ] **Step 2.5: Commit**

```bash
git add src/mappers/nested-tree.ts src/mappers/__tests__/nested-tree.test.ts
git commit -m "feat(nested-tree): buildTree for single-level junction relationships"
```

---

## Task 3: buildTree recursion + multi-level

**Files:**
- Modify: `model-catalog-api/src/mappers/__tests__/nested-tree.test.ts`

The `buildNode` function in Task 2 already recurses (it calls itself for nested target entities). This task adds tests asserting multi-level behavior works as designed.

- [ ] **Step 3.1: Write failing test for 4-level Software>Version>Config>Setup recursion**

Append to `model-catalog-api/src/mappers/__tests__/nested-tree.test.ts`:

```typescript
describe('buildTree — recursion (multi-level)', () => {
  it('walks 2 levels: ModelConfiguration > hasInput > hasPresentation', () => {
    const cfg = getResourceConfig('modelconfigurations')!;
    const body = {
      id: 'cfg-deep',
      hasInput: [
        {
          id: 'ds-deep',
          label: 'deep ds',
          hasPresentation: [{ id: 'vp-1', label: 'pres' }],
        },
      ],
    };
    const tree = buildTree(body, cfg);
    const ds = tree.junctions[0].children[0];
    expect(ds.id).toBe('https://w3id.org/okn/i/mint/ds-deep');
    expect(ds.columns).toEqual({ label: 'deep ds' });
    // hasPresentation is itself a junction on dataset_specification
    expect(ds.junctions.length).toBeGreaterThanOrEqual(1);
    const pres = ds.junctions.find((j) => j.apiFieldName === 'hasPresentation');
    expect(pres).toBeDefined();
    expect(pres!.children[0].id).toBe('https://w3id.org/okn/i/mint/vp-1');
    expect(pres!.children[0].columns).toEqual({ label: 'pres' });
  });
});
```

- [ ] **Step 3.2: Run test to verify it passes (recursion already works)**

```bash
npm test -- --run src/mappers/__tests__/nested-tree.test.ts
```

Expected: PASS — recursion was implemented in Task 2 via `buildNode` self-call.

- [ ] **Step 3.3: Commit**

```bash
git add src/mappers/__tests__/nested-tree.test.ts
git commit -m "test(nested-tree): assert multi-level recursion through junction edges"
```

---

## Task 4: childFk relationships in tree

**Files:**
- Modify: `model-catalog-api/src/mappers/nested-tree.ts`
- Modify: `model-catalog-api/src/mappers/__tests__/nested-tree.test.ts`

- [ ] **Step 4.1: Write failing test for childFk edge**

Append to `model-catalog-api/src/mappers/__tests__/nested-tree.test.ts`:

```typescript
describe('buildTree — childFk relationships', () => {
  it('builds childFk edge for SoftwareVersion.hasConfiguration', () => {
    const cfg = getResourceConfig('softwareversions')!;
    const body = {
      id: 'sv-1',
      label: 'v1',
      hasConfiguration: [{ id: 'cfg-a', label: 'A' }, { id: 'cfg-b' }],
    };
    const tree = buildTree(body, cfg);
    expect(tree.junctions).toHaveLength(0);
    expect(tree.childFks).toHaveLength(1);
    const c = tree.childFks[0];
    expect(c.apiFieldName).toBe('hasConfiguration');
    expect(c.childTable).toBe('modelcatalog_model_configuration');
    expect(c.childFkColumn).toBe('software_version_id');
    expect(c.children).toHaveLength(2);
    expect(c.children[0].id).toBe('https://w3id.org/okn/i/mint/cfg-a');
    expect(c.children[0].columns).toEqual({ label: 'A' });
    expect(c.children[1].columns).toEqual({});
  });

  it('recurses childFk children to grand-children', () => {
    const cfg = getResourceConfig('softwareversions')!;
    const body = {
      id: 'sv-2',
      hasConfiguration: [
        { id: 'cfg-x', hasInput: [{ id: 'ds-x' }] },
      ],
    };
    const tree = buildTree(body, cfg);
    const cfgNode = tree.childFks[0].children[0];
    expect(cfgNode.junctions).toHaveLength(1);
    expect(cfgNode.junctions[0].children[0].id).toBe('https://w3id.org/okn/i/mint/ds-x');
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
npm test -- --run src/mappers/__tests__/nested-tree.test.ts
```

Expected: FAIL — `tree.childFks` is empty (Task 2 noted "childFk handled in Task 4").

- [ ] **Step 4.3: Implement childFk branch in `buildNode`**

Edit `model-catalog-api/src/mappers/nested-tree.ts`. Inside `buildNode`, replace the `// childFk handled in Task 4` comment block with childFk handling. Locate the `if (relApiNames.has(key)) { ... }` block and append a `childFk` branch before `continue`:

```typescript
      const rel = cfg.relationships[key];
      if (rel.junctionTable && rel.junctionRelName && rel.parentFkColumn) {
        const edge = buildJunctionEdge(key, rel, value, ctx);
        if (edge) junctions.push(edge);
      } else if (rel.childFkColumn) {
        const edge = buildChildFkEdge(key, rel, value, ctx);
        if (edge) childFks.push(edge);
      }
      continue;
```

Then add `buildChildFkEdge` helper after `buildJunctionEdge`:

```typescript
function buildChildFkEdge(
  apiFieldName: string,
  rel: RelationshipConfig,
  rawValue: unknown,
  ctx: BuildContext,
): ChildFkEdge | null {
  if (!Array.isArray(rawValue)) return null;
  const targetCfg = getResourceConfig(rel.targetResource);
  if (!targetCfg?.hasuraTable) {
    throw new ValidationError(
      'TARGET_NOT_IMPLEMENTED',
      `${ctx.path}/${apiFieldName}`,
      `target type ${rel.targetResource} not implemented`,
      501,
    );
  }
  const children: WriteNode[] = [];
  rawValue.forEach((item, idx) => {
    const itemPath = `${ctx.path}/${apiFieldName}/${idx}`;
    if (typeof item === 'string') {
      throw new ValidationError(
        'STRING_ID_DEPRECATED',
        itemPath,
        `string-id form deprecated; send [{id:'${item}'}] (field ${apiFieldName})`,
        400,
      );
    }
    if (item === null || typeof item !== 'object') {
      throw new ValidationError(
        'UNKNOWN_FIELD',
        itemPath,
        `relationship items must be objects with id`,
        400,
      );
    }
    const childCtx: BuildContext = {
      visited: new Set(ctx.visited),
      nodeCount: ctx.nodeCount,
      depth: ctx.depth + 1,
      path: itemPath,
    };
    children.push(buildNode(item as Record<string, unknown>, targetCfg, childCtx));
  });
  return {
    apiFieldName,
    childTable: targetCfg.hasuraTable,
    childFkColumn: rel.childFkColumn!,
    children,
  };
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
npm test -- --run src/mappers/__tests__/nested-tree.test.ts
```

Expected: PASS (10 tests total).

- [ ] **Step 4.5: Commit**

```bash
git add src/mappers/nested-tree.ts src/mappers/__tests__/nested-tree.test.ts
git commit -m "feat(nested-tree): add childFk edge branch with recursion"
```

---

## Task 5: Validation errors — depth, nodes, array, cycle, string-id, unknown field

**Files:**
- Modify: `model-catalog-api/src/mappers/__tests__/nested-tree.test.ts`

All validation rules already implemented in Tasks 2 and 4. This task verifies each one fires correctly with the right code, path, and HTTP status.

- [ ] **Step 5.1: Write failing tests for each validation rule**

Append to `model-catalog-api/src/mappers/__tests__/nested-tree.test.ts`:

```typescript
describe('buildTree — validation rules', () => {
  it('rejects string-id array form with STRING_ID_DEPRECATED', () => {
    const cfg = getResourceConfig('modelconfigurations')!;
    expect(() => buildTree({ id: 'c1', hasInput: ['ds-1'] }, cfg)).toThrow(
      expect.objectContaining({
        code: 'STRING_ID_DEPRECATED',
        httpStatus: 400,
        path: '/hasInput/0',
      }),
    );
  });

  it('rejects array length over MAX_ARRAY_LENGTH with ARRAY_TOO_LONG', () => {
    const cfg = getResourceConfig('modelconfigurations')!;
    const big = Array.from({ length: 201 }, (_, i) => ({ id: `ds-${i}` }));
    expect(() => buildTree({ id: 'c1', hasInput: big }, cfg)).toThrow(
      expect.objectContaining({ code: 'ARRAY_TOO_LONG', httpStatus: 413 }),
    );
  });

  it('rejects depth over MAX_DEPTH with DEPTH_EXCEEDED', () => {
    // Build artificially deep: ModelConfiguration > hasInput > hasPresentation > ...
    // Easier: stub a chain by repeating hasInput on dataset_specification's hasPresentation back into a chain that re-uses junctions.
    // Simpler test: directly call buildNode with a synthesized depth context — exposed via test helper.
    // Use a real recursion through deeply nested hasPresentation > hasStandardVariable.
    const cfg = getResourceConfig('softwares')!;
    // Build a payload nested 10 levels via hasVersion->hasConfiguration->hasInput->hasPresentation chain.
    // To force the exception simply, send an obviously over-limit chain by repeating allowed edges.
    let nested: any = { id: 'leaf' };
    for (let i = 0; i < 10; i++) {
      nested = { id: `n${i}`, hasInput: [nested] };
    }
    const cfg2 = getResourceConfig('modelconfigurations')!;
    expect(() => buildTree(nested, cfg2)).toThrow(
      expect.objectContaining({ code: 'DEPTH_EXCEEDED', httpStatus: 400 }),
    );
  });

  it('rejects too many total nodes with TOO_MANY_NODES', () => {
    const cfg = getResourceConfig('modelconfigurations')!;
    // 600 inputs > MAX_NODES=500 (parent + 600 children = 601 nodes). But array cap (200) fires first.
    // To force TOO_MANY_NODES without tripping ARRAY_TOO_LONG, spread children across multiple
    // relationships: hasInput=200, hasOutput=200, hasParameter=150 = 1 + 550 = 551 nodes.
    const make = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}` }));
    const body = {
      id: 'c-big',
      hasInput: make(200, 'in'),
      hasOutput: make(200, 'out'),
      hasParameter: make(150, 'p'),
    };
    expect(() => buildTree(body, cfg)).toThrow(
      expect.objectContaining({ code: 'TOO_MANY_NODES', httpStatus: 413 }),
    );
  });

  it('detects cycles in ancestor path with CYCLE', () => {
    const cfg = getResourceConfig('modelconfigurations')!;
    const body = {
      id: 'c-1',
      hasInput: [
        {
          id: 'ds-1',
          hasPresentation: [{ id: 'c-1' }], // cycle: c-1 already on path
        },
      ],
    };
    expect(() => buildTree(body, cfg)).toThrow(
      expect.objectContaining({ code: 'CYCLE', httpStatus: 400 }),
    );
  });

  it('allows sibling repeats (same id linked twice from same parent is legal)', () => {
    const cfg = getResourceConfig('modelconfigurations')!;
    const body = {
      id: 'c-2',
      hasInput: [{ id: 'ds-shared' }],
      hasOutput: [{ id: 'ds-shared' }],
    };
    expect(() => buildTree(body, cfg)).not.toThrow();
  });
});
```

- [ ] **Step 5.2: Run tests**

```bash
npm test -- --run src/mappers/__tests__/nested-tree.test.ts
```

Expected: All PASS (Tasks 2/4 already implemented the rules; sibling-repeat test confirms cloned-visited-set behavior).

If any fail, fix the implementation in `nested-tree.ts` until green.

- [ ] **Step 5.3: Commit**

```bash
git add src/mappers/__tests__/nested-tree.test.ts
git commit -m "test(nested-tree): cover all 6 validation rules + sibling-repeat allowance"
```

---

## Task 6: mutation-compiler — compilePost (single level)

**Files:**
- Create: `model-catalog-api/src/mappers/mutation-compiler.ts`
- Test: `model-catalog-api/src/mappers/__tests__/mutation-compiler.test.ts`

- [ ] **Step 6.1: Write failing test for single-level POST compilation**

Create `model-catalog-api/src/mappers/__tests__/mutation-compiler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { compilePost } from '../mutation-compiler.js';
import type { WriteNode } from '../nested-tree.js';

describe('compilePost', () => {
  it('emits scalar-only insert when no relationships', () => {
    const tree: WriteNode = {
      table: 'modelcatalog_software',
      id: 'https://w3id.org/okn/i/mint/sw-1',
      columns: { label: 'foo' },
      junctions: [],
      childFks: [],
    };
    const { mutation, variables } = compilePost(tree);
    expect(mutation).toMatch(/insert_modelcatalog_software_one/);
    expect(mutation).toMatch(/object: \$object/);
    expect(variables).toEqual({
      object: { id: 'https://w3id.org/okn/i/mint/sw-1', label: 'foo' },
    });
  });

  it('emits nested junction insert with dynamic update_columns from columns keys', () => {
    const tree: WriteNode = {
      table: 'modelcatalog_configuration',
      id: 'cfg-1',
      columns: { label: 'cfg' },
      junctions: [
        {
          apiFieldName: 'hasInput',
          junctionTable: 'modelcatalog_configuration_input',
          junctionRelName: 'input',
          parentFkColumn: 'configuration_id',
          targetFkColumn: 'input_id',
          junctionColumns: [{}],
          children: [
            {
              table: 'modelcatalog_dataset_specification',
              id: 'ds-1',
              columns: { label: 'ds-label' },
              junctions: [],
              childFks: [],
            },
          ],
        },
      ],
      childFks: [],
    };
    const { variables } = compilePost(tree);
    const obj = (variables.object as Record<string, unknown>);
    expect(obj.id).toBe('cfg-1');
    expect(obj.label).toBe('cfg');
    const inputs = (obj.input as { data: unknown[]; on_conflict: { update_columns: string[] } });
    expect(inputs.on_conflict.update_columns).toEqual([]); // junction PK never updated
    const inputRow = inputs.data[0] as Record<string, any>;
    const nested = inputRow.input as { data: any; on_conflict: { update_columns: string[] } };
    expect(nested.data.id).toBe('ds-1');
    expect(nested.data.label).toBe('ds-label');
    expect(nested.on_conflict.update_columns).toEqual(['label']); // dynamic, from columns keys
    expect(nested.on_conflict.constraint).toBe('modelcatalog_dataset_specification_pkey');
  });

  it('emits link-only nested entity (empty columns) with update_columns:[]', () => {
    const tree: WriteNode = {
      table: 'modelcatalog_configuration',
      id: 'cfg-2',
      columns: {},
      junctions: [
        {
          apiFieldName: 'hasInput',
          junctionTable: 'modelcatalog_configuration_input',
          junctionRelName: 'input',
          parentFkColumn: 'configuration_id',
          targetFkColumn: 'input_id',
          junctionColumns: [{}],
          children: [
            {
              table: 'modelcatalog_dataset_specification',
              id: 'ds-existing',
              columns: {},
              junctions: [],
              childFks: [],
            },
          ],
        },
      ],
      childFks: [],
    };
    const { variables } = compilePost(tree);
    const obj = variables.object as Record<string, any>;
    const nested = (obj.input.data[0].input) as { on_conflict: { update_columns: string[] } };
    expect(nested.on_conflict.update_columns).toEqual([]); // bug-087 safe
  });

  it('applies junction extra columns to junction row', () => {
    const tree: WriteNode = {
      table: 'modelcatalog_configuration',
      id: 'cfg-3',
      columns: {},
      junctions: [
        {
          apiFieldName: 'hasInput',
          junctionTable: 'modelcatalog_configuration_input',
          junctionRelName: 'input',
          parentFkColumn: 'configuration_id',
          targetFkColumn: 'input_id',
          junctionColumns: [{ is_optional: true }],
          children: [
            { table: 'modelcatalog_dataset_specification', id: 'ds', columns: {}, junctions: [], childFks: [] },
          ],
        },
      ],
      childFks: [],
    };
    const { variables } = compilePost(tree);
    const row = (variables.object as any).input.data[0];
    expect(row.is_optional).toBe(true);
  });

  it('emits childFk nested-array insert with FK column set on each child', () => {
    const tree: WriteNode = {
      table: 'modelcatalog_software_version',
      id: 'sv-1',
      columns: { label: 'v' },
      junctions: [],
      childFks: [
        {
          apiFieldName: 'hasConfiguration',
          childTable: 'modelcatalog_model_configuration',
          childFkColumn: 'software_version_id',
          children: [
            { table: 'modelcatalog_model_configuration', id: 'cfg-a', columns: { label: 'A' }, junctions: [], childFks: [] },
            { table: 'modelcatalog_model_configuration', id: 'cfg-b', columns: {}, junctions: [], childFks: [] },
          ],
        },
      ],
    };
    const { variables } = compilePost(tree);
    const obj = variables.object as any;
    expect(obj.model_configurations).toBeDefined(); // hasura nested rel name auto-derived from child table suffix (plural-ish convention)
    // We cannot easily predict Hasura nested rel name without metadata; fall back to expecting array shape:
    const childKey = Object.keys(obj).find((k) => k !== 'id' && k !== 'label')!;
    const arr = obj[childKey].data as any[];
    expect(arr.length).toBe(2);
    expect(arr[0].software_version_id).toBe('sv-1');
    expect(arr[0].id).toBe('cfg-a');
    expect(arr[0].label).toBe('A');
    expect(arr[1].software_version_id).toBe('sv-1');
  });
});
```

> **Note for implementer:** the childFk Hasura nested-rel name is implementation-dependent. Prefer reading it from `resource-registry` (add a `hasuraChildRelName` if needed). For this test we accept any single non-scalar key on `obj`.

- [ ] **Step 6.2: Run test to verify it fails**

```bash
npm test -- --run src/mappers/__tests__/mutation-compiler.test.ts
```

Expected: FAIL — `compilePost` not exported.

- [ ] **Step 6.3: Implement `compilePost`**

Create `model-catalog-api/src/mappers/mutation-compiler.ts`:

```typescript
/**
 * Two-pass nested write pipeline — Pass 2.
 *
 * compilePost(tree) and compilePut(tree) walk a WriteTree and emit a single
 * Hasura mutation document plus variables. Per-node update_columns is derived
 * from the captured columns keys (bug-087 safe upsert).
 */

import type { WriteNode, JunctionEdge, ChildFkEdge } from './nested-tree.js';

export interface CompiledMutation {
  mutation: string;
  variables: Record<string, unknown>;
}

function tableSuffix(table: string): string {
  return table.replace('modelcatalog_', '');
}

function buildInsertObject(node: WriteNode): Record<string, unknown> {
  const obj: Record<string, unknown> = { id: node.id, ...node.columns };

  for (const j of node.junctions) {
    obj[j.junctionRelName] = buildJunctionInsert(j);
  }
  for (const c of node.childFks) {
    obj[childFkRelKey(c)] = buildChildFkInsert(c);
  }
  return obj;
}

function buildJunctionInsert(j: JunctionEdge): Record<string, unknown> {
  const data = j.children.map((child, idx) => {
    const row: Record<string, unknown> = {
      ...j.junctionColumns[idx],
      [j.junctionRelName]: {
        data: buildInsertObject(child),
        on_conflict: {
          constraint: { _name: `${child.table}_pkey` },
          update_columns: Object.keys(child.columns),
        },
      },
    };
    return row;
  });
  return {
    data,
    on_conflict: {
      constraint: { _name: `${j.junctionTable}_pkey` },
      update_columns: [],
    },
  };
}

function buildChildFkInsert(c: ChildFkEdge): Record<string, unknown> {
  // For the parent-side nested array, Hasura needs the child rows to carry
  // their FK column populated. We rely on Hasura's nested array relationship,
  // but to keep the compiler decoupled from metadata we set the FK explicitly
  // on each child object.
  const data = c.children.map((child) => {
    const obj = buildInsertObject(child);
    return obj;
  });
  return {
    data,
    on_conflict: {
      constraint: { _name: `${c.childTable}_pkey` },
      update_columns: c.children.flatMap((ch) => Object.keys(ch.columns)),
    },
  };
}

function childFkRelKey(c: ChildFkEdge): string {
  // Derive Hasura array relationship name from child table suffix.
  // Convention used elsewhere in this codebase: pluralized snake_case suffix.
  // For simplicity, use raw suffix; service.ts callers reading the response
  // do not depend on this name (response is `{ id }` only).
  return tableSuffix(c.childTable);
}

export function compilePost(tree: WriteNode): CompiledMutation {
  const object = buildInsertObject(tree);
  // Set explicit FK on childFk children since Hasura array rel needs FK populated
  // OR: rely on Hasura inferring the FK; safer to set explicitly:
  for (const c of tree.childFks) {
    const arr = (object[childFkRelKey(c)] as { data: Record<string, unknown>[] }).data;
    arr.forEach((row, idx) => {
      row[c.childFkColumn] = tree.id;
      // Recurse into grand-children to set their FK too if any.
      const childNode = c.children[idx];
      for (const subC of childNode.childFks) {
        const subArr = (row[childFkRelKey(subC)] as { data: Record<string, unknown>[] }).data;
        subArr.forEach((subRow) => {
          subRow[subC.childFkColumn] = childNode.id;
        });
      }
    });
  }

  const suffix = tableSuffix(tree.table);
  const mutation = `
    mutation CreateMutation($object: modelcatalog_${suffix}_insert_input!) {
      insert_modelcatalog_${suffix}_one(object: $object) { id }
    }
  `;
  return { mutation, variables: { object } };
}
```

> **Implementation note:** Hasura `on_conflict.constraint` accepts the constraint name as an enum value, not a string-wrapped object. Many Apollo client variable shapes accept it as a string. The test asserts on the value being present — adjust the constraint shape to match what `gql` parses. If tests fail, switch from `{ _name: 'x' }` to a bare string `'x'` (Apollo will pass it as a GraphQL enum literal when interpolated; when in variables the constraint must be the enum literal in the mutation string, not a variable). The cleanest fix: build the mutation string with the constraint inlined and pass only `data` and the `update_columns` array via variables. If your tests force the rewrite, do it now and re-assert.

- [ ] **Step 6.4: Run tests, iterate until green**

```bash
npm test -- --run src/mappers/__tests__/mutation-compiler.test.ts
```

Expected: PASS for all 5 tests. If a test on `on_conflict.constraint` shape fails, restructure the variables emission so the constraint is inlined in the mutation string, and re-run.

- [ ] **Step 6.5: Commit**

```bash
git add src/mappers/mutation-compiler.ts src/mappers/__tests__/mutation-compiler.test.ts
git commit -m "feat(mutation-compiler): compilePost with dynamic update_columns and childFk handling"
```

---

## Task 7: mutation-compiler — compilePut

**Files:**
- Modify: `model-catalog-api/src/mappers/mutation-compiler.ts`
- Modify: `model-catalog-api/src/mappers/__tests__/mutation-compiler.test.ts`

- [ ] **Step 7.1: Write failing tests for PUT compilation**

Append to `model-catalog-api/src/mappers/__tests__/mutation-compiler.test.ts`:

```typescript
import { compilePut } from '../mutation-compiler.js';

describe('compilePut', () => {
  it('emits simple update_*_by_pk when tree has only scalars', () => {
    const tree: WriteNode = {
      table: 'modelcatalog_software',
      id: 'sw-1',
      columns: { label: 'updated' },
      junctions: [],
      childFks: [],
    };
    const { mutation, variables } = compilePut(tree);
    expect(mutation).toMatch(/update_modelcatalog_software_by_pk/);
    expect(mutation).toMatch(/_set: \$set/);
    expect(variables).toEqual({ id: 'sw-1', set: { label: 'updated' } });
  });

  it('emits delete + insert pair per junction edge with replace semantics', () => {
    const tree: WriteNode = {
      table: 'modelcatalog_configuration',
      id: 'cfg-1',
      columns: { label: 'c' },
      junctions: [
        {
          apiFieldName: 'hasInput',
          junctionTable: 'modelcatalog_configuration_input',
          junctionRelName: 'input',
          parentFkColumn: 'configuration_id',
          targetFkColumn: 'input_id',
          junctionColumns: [{}],
          children: [
            { table: 'modelcatalog_dataset_specification', id: 'ds-new', columns: { label: 'new' }, junctions: [], childFks: [] },
          ],
        },
      ],
      childFks: [],
    };
    const { mutation, variables } = compilePut(tree);
    expect(mutation).toMatch(/del_inputs:\s*delete_modelcatalog_configuration_input/);
    expect(mutation).toMatch(/where:\s*\{\s*configuration_id:\s*\{\s*_eq:\s*\$id\s*\}/);
    expect(mutation).toMatch(/ins_inputs:\s*insert_modelcatalog_configuration_input/);
    const juncVar = variables.junc_inputs as Record<string, unknown>[];
    expect(juncVar).toHaveLength(1);
    const row = juncVar[0] as any;
    // Child entity nested under the junctionRelName key
    expect(row.input.data.id).toBe('ds-new');
    expect(row.input.data.label).toBe('new');
    expect(row.input.on_conflict.update_columns).toEqual(['label']); // dynamic
  });

  it('uses targetFkColumn from edge (bug-087 fold-in)', () => {
    const tree: WriteNode = {
      table: 'modelcatalog_configuration',
      id: 'cfg-2',
      columns: {},
      junctions: [
        {
          apiFieldName: 'hasInput',
          junctionTable: 'modelcatalog_configuration_input',
          junctionRelName: 'input',
          parentFkColumn: 'configuration_id',
          targetFkColumn: 'input_id',  // explicitly verified
          junctionColumns: [{}],
          children: [
            { table: 'modelcatalog_dataset_specification', id: 'ds-1', columns: {}, junctions: [], childFks: [] },
          ],
        },
      ],
      childFks: [],
    };
    const { variables } = compilePut(tree);
    const row = (variables.junc_inputs as any[])[0];
    // Either flat FK form or nested form must use the correct column
    if (row.input_id !== undefined) {
      expect(row.input_id).toBe('ds-1');
    } else {
      expect(row.input.data.id).toBe('ds-1');
    }
  });

  it('emits clear+upsert pair for childFk edges', () => {
    const tree: WriteNode = {
      table: 'modelcatalog_software_version',
      id: 'sv-1',
      columns: {},
      junctions: [],
      childFks: [
        {
          apiFieldName: 'hasConfiguration',
          childTable: 'modelcatalog_model_configuration',
          childFkColumn: 'software_version_id',
          children: [
            { table: 'modelcatalog_model_configuration', id: 'cfg-a', columns: { label: 'A' }, junctions: [], childFks: [] },
          ],
        },
      ],
    };
    const { mutation, variables } = compilePut(tree);
    expect(mutation).toMatch(/clear_model_configurations:\s*update_modelcatalog_model_configuration/);
    expect(mutation).toMatch(/_in:\s*\$child_ids_model_configurations/);
    expect(mutation).toMatch(/upsert_model_configurations:\s*insert_modelcatalog_model_configuration/);
    expect(variables.child_ids_model_configurations).toEqual(['cfg-a']);
    const upsertObjs = variables.child_model_configurations as any[];
    expect(upsertObjs[0].id).toBe('cfg-a');
    expect(upsertObjs[0].software_version_id).toBe('sv-1');
    expect(upsertObjs[0].label).toBe('A');
  });

  it('hoists complex objects into variables (no JSON in mutation string)', () => {
    const tree: WriteNode = {
      table: 'modelcatalog_configuration',
      id: 'cfg-3',
      columns: {},
      junctions: [
        {
          apiFieldName: 'hasInput',
          junctionTable: 'modelcatalog_configuration_input',
          junctionRelName: 'input',
          parentFkColumn: 'configuration_id',
          targetFkColumn: 'input_id',
          junctionColumns: [{}],
          children: [{ table: 'modelcatalog_dataset_specification', id: 'ds', columns: {}, junctions: [], childFks: [] }],
        },
      ],
      childFks: [],
    };
    const { mutation } = compilePut(tree);
    expect(mutation).not.toMatch(/"id":\s*"ds"/); // not interpolated as JSON
    expect(mutation).toMatch(/objects:\s*\$junc_inputs/);
  });
});
```

- [ ] **Step 7.2: Run tests to verify they fail**

```bash
npm test -- --run src/mappers/__tests__/mutation-compiler.test.ts
```

Expected: FAIL — `compilePut` not exported.

- [ ] **Step 7.3: Implement `compilePut`**

Append to `model-catalog-api/src/mappers/mutation-compiler.ts`:

```typescript
function buildPutJunctionRow(j: JunctionEdge, idx: number): Record<string, unknown> {
  const child = j.children[idx];
  const row: Record<string, unknown> = { ...j.junctionColumns[idx] };
  // For PUT we always emit the nested target form so child subtrees ride along.
  // The on_conflict update_columns is dynamic from child's columns keys.
  row[j.junctionRelName] = {
    data: buildInsertObject(child),
    on_conflict: {
      constraint: { _name: `${child.table}_pkey` },
      update_columns: Object.keys(child.columns),
    },
  };
  return row;
}

export function compilePut(tree: WriteNode): CompiledMutation {
  const suffix = tableSuffix(tree.table);
  const variables: Record<string, unknown> = { id: tree.id, set: tree.columns };
  const parts: string[] = [
    `update_modelcatalog_${suffix}_by_pk(pk_columns: { id: $id }, _set: $set) { id }`,
  ];
  const varDecls: string[] = [`$id: String!`, `$set: modelcatalog_${suffix}_set_input!`];

  // Junction edges: delete-then-insert with nested subtree
  for (const j of tree.junctions) {
    const juncSuffix = tableSuffix(j.junctionTable);
    parts.push(
      `del_${j.junctionRelName}s: delete_modelcatalog_${juncSuffix}(where: { ${j.parentFkColumn}: { _eq: $id } }) { affected_rows }`,
    );
    if (j.children.length > 0) {
      const varName = `junc_${j.junctionRelName}s`;
      const objects = j.children.map((_, i) => buildPutJunctionRow(j, i));
      variables[varName] = objects;
      varDecls.push(`$${varName}: [modelcatalog_${juncSuffix}_insert_input!]!`);
      parts.push(
        `ins_${j.junctionRelName}s: insert_modelcatalog_${juncSuffix}(objects: $${varName}, on_conflict: { constraint: modelcatalog_${juncSuffix}_pkey, update_columns: [] }) { affected_rows }`,
      );
    }
  }

  // ChildFk edges: clear + upsert
  for (const c of tree.childFks) {
    const childSuffix = tableSuffix(c.childTable);
    const idsVar = `child_ids_${childSuffix}`;
    const objsVar = `child_${childSuffix}`;
    const ids = c.children.map((ch) => ch.id);
    const objects = c.children.map((ch) => ({ ...buildInsertObject(ch), [c.childFkColumn]: tree.id }));
    variables[idsVar] = ids;
    variables[objsVar] = objects;
    varDecls.push(`$${idsVar}: [String!]!`);
    varDecls.push(`$${objsVar}: [modelcatalog_${childSuffix}_insert_input!]!`);
    parts.push(
      `clear_${childSuffix}: update_modelcatalog_${childSuffix}(where: { ${c.childFkColumn}: { _eq: $id }, id: { _nin: $${idsVar} } }, _set: { ${c.childFkColumn}: null }) { affected_rows }`,
    );
    parts.push(
      `upsert_${childSuffix}: insert_modelcatalog_${childSuffix}(objects: $${objsVar}, on_conflict: { constraint: modelcatalog_${childSuffix}_pkey, update_columns: [${c.children.flatMap((ch) => Object.keys(ch.columns)).map((k) => k).join(', ')}] }) { affected_rows }`,
    );
  }

  const mutation = `
    mutation UpdateMutation(${varDecls.join(', ')}) {
      ${parts.join('\n      ')}
    }
  `;
  return { mutation, variables };
}
```

- [ ] **Step 7.4: Run tests, iterate until green**

```bash
npm test -- --run src/mappers/__tests__/mutation-compiler.test.ts
```

Expected: PASS. Likely iteration: rename plural keys (`del_inputs` vs `del_input`), constraint shape (string vs `{_name}`), update_columns enum literal vs string. The contract is what the assertions check — restructure the implementation until the tests match. Do NOT loosen the tests.

- [ ] **Step 7.5: Commit**

```bash
git add src/mappers/mutation-compiler.ts src/mappers/__tests__/mutation-compiler.test.ts
git commit -m "feat(mutation-compiler): compilePut with replace-subtree semantics and dynamic update_columns"
```

---

## Task 8: Add `targetFkColumn` to `RelationshipConfig` (bug-087 fold-in registry support)

**Files:**
- Modify: `model-catalog-api/src/mappers/resource-registry.ts`

- [ ] **Step 8.1: Add field to interface**

Edit `model-catalog-api/src/mappers/resource-registry.ts:9-41` (`RelationshipConfig`). After the `parentFkColumn` field, add:

```typescript
  /**
   * Optional override for the target-entity FK column on the junction row.
   * Defaults to `${junctionRelName}_id` (current convention).
   * Set explicitly when the convention does not match the schema (bug-087 fold-in).
   */
  targetFkColumn?: string;
```

- [ ] **Step 8.2: Audit existing relationships and add explicit overrides where convention does not match**

Run from `/Users/mosorio/repos/mint/model-catalog-api`:

```bash
grep -nE "^\s*junctionRelName:" src/mappers/resource-registry.ts
```

For each relationship, mentally check whether `${junctionRelName}_id` matches the actual FK column on the junction table (cross-reference Hasura metadata in `graphql_engine/`). If a mismatch exists, add `targetFkColumn: '<actual_column>',` next to the `junctionRelName`.

Per the spec, current audit indicates all junctions follow the convention. If true, no overrides needed; this step is a documentation pass.

- [ ] **Step 8.3: Run all tests**

```bash
npm test -- --run
```

Expected: PASS — type addition is non-breaking.

- [ ] **Step 8.4: Commit**

```bash
git add src/mappers/resource-registry.ts
git commit -m "feat(resource-registry): add optional targetFkColumn override for junction FK"
```

---

## Task 9: Wire pipeline into `service.ts` `create()`

**Files:**
- Modify: `model-catalog-api/src/service.ts`

- [ ] **Step 9.1: Replace `create()` body junction/childFk inline builders with pipeline call**

Edit `model-catalog-api/src/service.ts:177-297`. Replace the body of `create()` with the version below. Keep the resource lookup, type column setting, and authHeader checks.

```typescript
  async create(resource: string, req: any, reply: any) {
    const resourceConfig = getResourceConfig(resource)
    if (!resourceConfig) {
      reply.code(404).send({ error: `Unknown resource type: ${resource}` })
      return
    }
    if (!resourceConfig.hasuraTable) {
      reply.code(501).send({ error: `Resource type '${resource}' not yet implemented` })
      return
    }

    const authHeader = req.headers?.authorization
    if (!authHeader) {
      reply.code(401).send({ error: 'Authorization header required' })
      return
    }

    const body = req.body || {}

    let tree
    try {
      tree = buildTree(body as Record<string, unknown>, resourceConfig)
    } catch (err: any) {
      if (err && err.name === 'ValidationError') {
        req.log.warn(
          { verb: 'POST', resource, error_code: err.code, path: err.path },
          'nested write validation failed',
        )
        reply.code(err.httpStatus).send({ error: err.message, code: err.code, path: err.path })
        return
      }
      throw err
    }

    // Inject type column for software resources only (existing behavior)
    if (resourceConfig.hasuraTable === 'modelcatalog_software') {
      tree.columns['type'] = resourceConfig.typeUri
    }

    const { mutation, variables } = compilePost(tree)

    try {
      const writeClient = getWriteClient(authHeader)
      const result = await writeClient.mutate({
        mutation: gql`${mutation}`,
        variables,
      })
      const data = result.data as Record<string, unknown> | null
      const tableSuffix = resourceConfig.hasuraTable.replace('modelcatalog_', '')
      const dataKey = `insert_modelcatalog_${tableSuffix}_one`
      const created = data?.[dataKey] as { id?: string } | undefined
      reply.code(201).send({ id: created?.id ?? tree.id })
    } catch (err: any) {
      req.log.error({ err }, 'GraphQL create mutation failed')
      const msg = err?.message || ''
      if (msg.includes('Foreign key violation')) {
        reply.code(400).send({
          error: 'FK violation — id may target wrong resource type',
          details: msg,
        })
        return
      }
      if (msg.includes('uniqueness violation') || msg.includes('constraint')) {
        reply.code(400).send({ error: 'Constraint violation', details: msg })
        return
      }
      reply.code(500).send({ error: 'Internal server error', details: err?.message })
    }
  }
```

Update imports at the top of the file:

```typescript
import { toHasuraInput } from './mappers/request.js' // remove buildJunctionInserts
import { buildTree } from './mappers/nested-tree.js'
import { compilePost, compilePut } from './mappers/mutation-compiler.js'
```

(`toHasuraInput` may now be unused; remove it from imports if so. `randomUUID` may also be unused; remove if nothing else in `service.ts` uses it.)

- [ ] **Step 9.2: Run all unit tests**

```bash
npm test -- --run
```

Expected: PASS — `nested-tree.test.ts`, `mutation-compiler.test.ts`, `request.test.ts` (excluding `buildJunctionInserts` cases — see Task 11), `response.test.ts`, `service-type-filter.test.ts`. Some legacy tests calling `buildJunctionInserts` may fail; defer fix to Task 11.

- [ ] **Step 9.3: Commit**

```bash
git add src/service.ts
git commit -m "refactor(service): create() uses buildTree + compilePost pipeline"
```

---

## Task 10: Wire pipeline into `service.ts` `update()`

**Files:**
- Modify: `model-catalog-api/src/service.ts`

- [ ] **Step 10.1: Replace `update()` body with pipeline call**

Edit `model-catalog-api/src/service.ts:300-470`. Replace the body of `update()` with:

```typescript
  async update(resource: string, req: any, reply: any) {
    const resourceConfig = getResourceConfig(resource)
    if (!resourceConfig) {
      reply.code(404).send({ error: `Unknown resource type: ${resource}` })
      return
    }
    if (!resourceConfig.hasuraTable) {
      reply.code(501).send({ error: `Resource type '${resource}' not yet implemented` })
      return
    }

    const authHeader = req.headers?.authorization
    if (!authHeader) {
      reply.code(401).send({ error: 'Authorization header required' })
      return
    }

    const id = decodeURIComponent(req.params.id)
    const fullId = id.startsWith('https://') ? id : `${resourceConfig.idPrefix}${id}`
    const body = { ...(req.body || {}), id: fullId }

    let tree
    try {
      tree = buildTree(body as Record<string, unknown>, resourceConfig)
    } catch (err: any) {
      if (err && err.name === 'ValidationError') {
        req.log.warn(
          { verb: 'PUT', resource, root_id: fullId, error_code: err.code, path: err.path },
          'nested write validation failed',
        )
        reply.code(err.httpStatus).send({ error: err.message, code: err.code, path: err.path })
        return
      }
      throw err
    }

    const { mutation, variables } = compilePut(tree)

    try {
      const writeClient = getWriteClient(authHeader)
      await writeClient.mutate({
        mutation: gql`${mutation}`,
        variables,
      })
      reply.code(200).send({ id: fullId })
    } catch (err: any) {
      req.log.error({ err }, 'GraphQL update mutation failed')
      const msg = err?.message || ''
      if (msg.includes('Foreign key violation')) {
        reply.code(400).send({
          error: 'FK violation — id may target wrong resource type',
          details: msg,
        })
        return
      }
      if (msg.includes('uniqueness violation') || msg.includes('constraint')) {
        reply.code(400).send({ error: 'Constraint violation', details: msg })
        return
      }
      reply.code(500).send({ error: 'Internal server error', details: err?.message })
    }
  }
```

- [ ] **Step 10.2: Run all unit tests**

```bash
npm test -- --run
```

Expected: PASS for non-legacy tests. Legacy `buildJunctionInserts` tests still failing — fixed in Task 11.

- [ ] **Step 10.3: Commit**

```bash
git add src/service.ts
git commit -m "refactor(service): update() uses buildTree + compilePut pipeline"
```

---

## Task 11: Remove dead code: `buildJunctionInserts`

**Files:**
- Modify: `model-catalog-api/src/mappers/request.ts`
- Modify: `model-catalog-api/src/mappers/__tests__/request.test.ts`

- [ ] **Step 11.1: Delete `buildJunctionInserts` from `request.ts`**

Edit `model-catalog-api/src/mappers/request.ts`. Delete the entire function `buildJunctionInserts` (lines 156-261). Keep `toHasuraInput`, `camelToSnake`, `unwrapValue`, `getScalarColumns`. Remove the unused `randomUUID` import if `buildJunctionInserts` was the only consumer.

- [ ] **Step 11.2: Remove `buildJunctionInserts` test cases from `request.test.ts`**

Edit `model-catalog-api/src/mappers/__tests__/request.test.ts`. Remove all `describe('buildJunctionInserts', ...)` blocks and the `buildJunctionInserts` import. Keep tests for `toHasuraInput` and `camelToSnake`.

- [ ] **Step 11.3: Run all tests**

```bash
npm test -- --run
```

Expected: PASS for the entire suite, including `nested-tree.test.ts`, `mutation-compiler.test.ts`, `request.test.ts`, `response.test.ts`, `service-type-filter.test.ts`, `request-mapper.test.ts`, `integration.test.ts`, `junction-integration.test.ts`. Note: `junction-integration.test.ts` may exercise the pipeline through `service.ts` — if any cases fail because they assume the old payload shape (string-id arrays), update them to the object form (which is also what callers must do). Each updated test deserves a quick comment justifying the shape change.

- [ ] **Step 11.4: Commit**

```bash
git add src/mappers/request.ts src/mappers/__tests__/request.test.ts
git commit -m "refactor(request): remove buildJunctionInserts (replaced by nested-tree pipeline)"
```

---

## Task 12: Integration tests against running Hasura

**Files:**
- Create: `model-catalog-api/src/mappers/__tests__/nested-writes-integration.test.ts`

- [ ] **Step 12.1: Confirm integration harness pattern**

```bash
ls src/mappers/__tests__/
head -60 src/mappers/__tests__/junction-integration.test.ts
```

Expected: existing `integration.test.ts` and `junction-integration.test.ts` show the test harness (auth, HASURA endpoint, fetch client). Reuse the same imports and skip-when-env-absent pattern in the new file.

- [ ] **Step 12.2: Write integration tests**

Create `model-catalog-api/src/mappers/__tests__/nested-writes-integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'crypto';

const API = process.env.MODEL_CATALOG_API_URL ?? 'http://localhost:3000/v2.0.0';
const TOKEN = process.env.TEST_BEARER_TOKEN;

const skipIfNoToken = TOKEN ? describe : describe.skip;

skipIfNoToken('integration: recursive nested writes', () => {
  const authHeader = { authorization: `Bearer ${TOKEN}` };
  const newId = (prefix: string) => `${prefix}-${randomUUID()}`;

  it('POST ModelConfiguration with nested DatasetSpecification + nested VariablePresentation persists all rows', async () => {
    const cfgId = newId('cfg');
    const dsId = newId('ds');
    const vpId = newId('vp');
    const res = await fetch(`${API}/modelconfigurations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({
        id: cfgId,
        label: 'nested test cfg',
        hasInput: [
          {
            id: dsId,
            label: 'nested ds',
            hasPresentation: [{ id: vpId, label: 'nested vp' }],
          },
        ],
      }),
    });
    expect(res.status).toBe(201);

    const got = await fetch(`${API}/modelconfigurations/${encodeURIComponent(cfgId)}`, { headers: authHeader });
    const cfg = await got.json();
    expect(cfg.label).toEqual(['nested test cfg']);
    expect((cfg.hasInput ?? [])[0]?.id).toBe(dsId);
    // The persisted hasPresentation is on the nested ds; fetch the ds:
    const dsRes = await fetch(`${API}/datasetspecifications/${encodeURIComponent(dsId)}`, { headers: authHeader });
    const ds = await dsRes.json();
    expect((ds.hasPresentation ?? [])[0]?.id).toBe(vpId);
  });

  it('PUT ModelConfiguration replacing hasInput drops old junction rows and inserts new', async () => {
    const cfgId = newId('cfg');
    const dsOld = newId('ds-old');
    const dsNew = newId('ds-new');

    // Create with one input
    let res = await fetch(`${API}/modelconfigurations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ id: cfgId, hasInput: [{ id: dsOld, label: 'old' }] }),
    });
    expect(res.status).toBe(201);

    // PUT with a different input
    res = await fetch(`${API}/modelconfigurations/${encodeURIComponent(cfgId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ hasInput: [{ id: dsNew, label: 'new' }] }),
    });
    expect(res.status).toBe(200);

    const got = await fetch(`${API}/modelconfigurations/${encodeURIComponent(cfgId)}`, { headers: authHeader });
    const cfg = await got.json();
    const inputIds = (cfg.hasInput ?? []).map((x: any) => x.id);
    expect(inputIds).toContain(dsNew);
    expect(inputIds).not.toContain(dsOld);
  });

  it('POST link-only payload does not clobber existing target scalars (bug-087 regression)', async () => {
    // Pre-create a DatasetSpecification with a known label
    const dsId = newId('ds-precreate');
    let res = await fetch(`${API}/datasetspecifications`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ id: dsId, label: 'preserved label' }),
    });
    expect(res.status).toBe(201);

    // Create a ModelConfiguration that LINKS to it (id-only payload)
    const cfgId = newId('cfg');
    res = await fetch(`${API}/modelconfigurations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ id: cfgId, hasInput: [{ id: dsId }] }),
    });
    expect(res.status).toBe(201);

    // Verify ds label preserved
    const got = await fetch(`${API}/datasetspecifications/${encodeURIComponent(dsId)}`, { headers: authHeader });
    const ds = await got.json();
    expect(ds.label).toEqual(['preserved label']);
  });

  it('PUT FK violation on wrong-type id returns 400 with hint', async () => {
    const cfgId = newId('cfg-fkfail');
    const vpId = newId('vp-wrongtype');

    // Pre-create a VariablePresentation
    let res = await fetch(`${API}/variablepresentations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ id: vpId, label: 'vp' }),
    });
    expect(res.status).toBe(201);

    // Create a ModelConfiguration first
    res = await fetch(`${API}/modelconfigurations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ id: cfgId, label: 'fk fail test' }),
    });
    expect(res.status).toBe(201);

    // Attempt to PUT VP id where DatasetSpecification expected
    res = await fetch(`${API}/modelconfigurations/${encodeURIComponent(cfgId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ hasInput: [{ id: vpId }] }),
    });
    expect(res.status).toBe(400);
    const errBody = await res.json();
    expect(errBody.error).toMatch(/wrong resource type/);
  });

  it('rejects string-id form with 400 STRING_ID_DEPRECATED', async () => {
    const res = await fetch(`${API}/modelconfigurations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ label: 'test', hasInput: ['some-ds-id'] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('STRING_ID_DEPRECATED');
  });
});
```

- [ ] **Step 12.3: Run integration tests**

If a local Hasura+Postgres + bearer token are available:

```bash
MODEL_CATALOG_API_URL=http://localhost:3000/v2.0.0 TEST_BEARER_TOKEN=<token> npm test -- --run src/mappers/__tests__/nested-writes-integration.test.ts
```

Expected: PASS for all 5 cases. Otherwise, the suite skips automatically and the task is parked until staging is available — note in the commit message and `.wolf/buglog.json` followup.

- [ ] **Step 12.4: Commit**

```bash
git add src/mappers/__tests__/nested-writes-integration.test.ts
git commit -m "test(integration): nested write round-trip, replace-subtree, bug-087 link-only, FK error"
```

---

## Task 13: Update OpenAPI spec + version bump

**Files:**
- Modify: `model-catalog-api/openapi.yaml`
- Modify: `model-catalog-api/package.json`
- Create or modify: `model-catalog-api/CHANGELOG.md`

- [ ] **Step 13.1: Bump `info.version` in OpenAPI spec**

Open `model-catalog-api/openapi.yaml`. Find the top `info:` block. Change `version:` to `2.1.0`.

- [ ] **Step 13.2: Update relationship array request schemas**

Search the OpenAPI for relationship array shapes. For every property on a request schema where the items can be string IDs:

```bash
grep -nE "type: string" openapi.yaml | head
```

Audit any property modeling `hasInput`, `hasOutput`, `hasParameter`, `hasVersion`, `hasConfiguration`, `hasSetup`, `hasPresentation`, etc. Where the items schema currently allows `oneOf: [string, object]` or pure `string`, change it to require object form: `items: { type: object, required: [id], properties: { id: { type: string } } }` (preserve other accepted properties).

This is bulk editing in a 519KB file — open in an editor with multi-cursor support or scripted replacement. Prefer narrow, targeted replacements over a global regex to avoid clobbering unrelated `string` properties.

- [ ] **Step 13.3: Bump package.json version**

Edit `model-catalog-api/package.json` line 3:

```json
  "version": "2.1.0",
```

- [ ] **Step 13.4: Add CHANGELOG entry**

If `model-catalog-api/CHANGELOG.md` does not exist, create it. Add at top:

```markdown
# Changelog

## v2.1.0 — 2026-05-09

### Breaking changes

- Relationship arrays no longer accept string-id form. Send objects: `hasInput: [{id: "..."}]`. Old form `hasInput: ["..."]` returns HTTP 400 `STRING_ID_DEPRECATED`. Migration: replace every `[string, ...]` array on relationship fields with `[{id: string}, ...]`.

### New features

- `POST` and `PUT` on every resource accept arbitrarily nested payloads (depth ≤ 8, total nodes ≤ 500, per-array length ≤ 200). Single atomic Hasura mutation per request. Replace-subtree semantics on `PUT`: payload IS the new state of every relationship at every depth.
- Dynamic `update_columns` per nested target row from supplied payload keys: id-only links without clobbering, id+scalars updates only those columns.

### Fixes

- bug-087: nested target on_conflict no longer clobbers existing rows when client sends only the id.
- bug-087 (PUT): junction FK column resolution from `resource-registry` (with optional `targetFkColumn` override). Hasura FK violations on writes now surface as 400 with `"id may target wrong resource type"` hint.
- bug-089: no parity gap between POST and PUT for nested writes.
```

- [ ] **Step 13.5: Run unit tests after OpenAPI changes**

```bash
npm test -- --run
```

Expected: PASS. The OpenAPI spec is parsed at startup by `openapi-glue`; if your test suite includes a startup test, it will catch shape errors.

- [ ] **Step 13.6: Commit**

```bash
git add openapi.yaml package.json CHANGELOG.md
git commit -m "chore: bump to v2.1.0; openapi.yaml requires object form for relationships"
```

---

## Task 14: Caller migration audit

**Files:**
- Read-only audit across monorepo, plus follow-up PRs.

- [ ] **Step 14.1: Grep all known callers in monorepo**

Run from `/Users/mosorio/repos/mint`:

```bash
rg -n "has[A-Z]\w+:\s*\[['\"]" ui/ mint-ensemble-manager/ dynamo-experiment-may/ model-catalog-fastapi/ 2>/dev/null
```

Expected: a list of file:line hits where string-id arrays are sent. For each hit, open a follow-up issue or PR in the relevant subrepo to migrate to object form. Track in `.planning/todos/pending/bug-089-caller-migrations.md`:

```markdown
# Bug-089 caller migration TODOs

Generated: 2026-05-09

| Repo | File:line | Old | Migration |
|------|-----------|-----|-----------|
| (one row per grep hit; fill manually) | | | |
```

- [ ] **Step 14.2: Notify teams**

Send Slack/email to UI, ensemble-manager, dynamo, notebook authors. Subject: `MINT API breaking change: string-id arrays deprecated, send [{id:'...'}]`. Body: link to `docs/superpowers/specs/2026-05-09-recursive-nested-writes-bug-089-design.md`, link to `model-catalog-api/CHANGELOG.md` v2.1.0 entry, the grep recipe, target deploy date (TBD with team).

- [ ] **Step 14.3: Block deploy until caller PRs merged**

Add a checkbox to the v2.1.0 release ticket: "All known callers migrated to object-form payloads — verified via repo grep on YYYY-MM-DD". Do not deploy until checked.

This task does not produce a commit in `model-catalog-api`. Track completion in the parent repo's planning files.

---

## Task 15: Bug log entry + final verification

**Files:**
- Modify: `/Users/mosorio/repos/mint/.wolf/buglog.json`

- [ ] **Step 15.1: Run full test suite once more**

```bash
cd /Users/mosorio/repos/mint/model-catalog-api
npm test -- --run
```

Expected: all green.

- [ ] **Step 15.2: Append bug-089 entry to `.wolf/buglog.json`**

Edit `/Users/mosorio/repos/mint/.wolf/buglog.json`. Append (under `bugs`):

```json
{
  "id": "bug-089",
  "timestamp": "2026-05-09T00:00:00Z",
  "error_message": "POST/PUT on model-catalog-api lacked recursive nested writes; PUT had no nested target entity support; PUT junction FK column was hardcoded by naming convention with no override path; nested write parity gap forced clients into multiple sequential calls.",
  "file": "model-catalog-api/src/service.ts, src/mappers/request.ts",
  "root_cause": "Two-pass write pipeline missing. service.ts had inline junction/childFk emit logic on POST and PUT, with PUT only supporting flat FK link-by-id. buildJunctionInserts in request.ts supported one-level nested target inserts on POST only.",
  "fix": "Added src/mappers/nested-tree.ts (buildTree, validation, caps, cycle detection) and src/mappers/mutation-compiler.ts (compilePost, compilePut). service.ts create/update slimmed to compile(buildTree(...)) + writeClient.mutate. Dynamic update_columns from payload keys (bug-087 safe). Optional targetFkColumn override added to RelationshipConfig. Hasura FK violations mapped to 400 with hint. String-id array form rejected with 400 STRING_ID_DEPRECATED. v2.1.0 breaking release; caller migration tracked in .planning/todos/pending/bug-089-caller-migrations.md.",
  "tags": [
    "model-catalog-api",
    "nested-writes",
    "post",
    "put",
    "recursive",
    "hasura",
    "bug-087-followup",
    "v2.1.0",
    "fixed"
  ],
  "related_bugs": ["bug-087"],
  "occurrences": 1,
  "last_seen": "2026-05-09T00:00:00Z"
}
```

- [ ] **Step 15.3: Update anatomy.md and memory.md**

Edit `/Users/mosorio/repos/mint/.wolf/anatomy.md` to add entries for `model-catalog-api/src/mappers/nested-tree.ts` and `model-catalog-api/src/mappers/mutation-compiler.ts` with one-line descriptions. Append a one-line entry to `/Users/mosorio/repos/mint/.wolf/memory.md` summarizing the bug-089 implementation.

- [ ] **Step 15.4: Push branch + open PR**

```bash
cd /Users/mosorio/repos/mint/model-catalog-api
git push -u origin feat/bug-089-recursive-nested-writes
gh pr create --title "feat: recursive nested POST/PUT (bug-089) + bug-087 PUT FK fold-in" --body "$(cat <<'EOF'
## Summary

- Two-pass nested write pipeline: `nested-tree.ts` (buildTree, validation, caps) + `mutation-compiler.ts` (compilePost, compilePut)
- Replace-subtree semantics on `PUT` at every depth
- Dynamic `update_columns` from payload keys (bug-087 safe upsert)
- Bug-087 PUT FK fold-in: optional `targetFkColumn` override + Hasura FK error mapping with hint
- String-id array form rejected with HTTP 400 (breaking — see CHANGELOG v2.1.0)

Spec: `docs/superpowers/specs/2026-05-09-recursive-nested-writes-bug-089-design.md` (parent repo)
Plan: `docs/superpowers/plans/2026-05-09-recursive-nested-writes-bug-089.md` (parent repo)

## Test plan

- [ ] Unit: `npm test -- --run` green (nested-tree, mutation-compiler, request, response, integration, junction-integration)
- [ ] Integration: `MODEL_CATALOG_API_URL=... TEST_BEARER_TOKEN=... npm test -- --run src/__tests__/integration/nested-writes.test.ts`
- [ ] Caller migration: every hit from `rg "has[A-Z]\w+:\s*\[['\"]" ui/ mint-ensemble-manager/ dynamo-experiment-may/ model-catalog-fastapi/` migrated
- [ ] CHANGELOG.md v2.1.0 entry reviewed
- [ ] Stakeholder comms sent
EOF
)"
```

Expected: PR created. Track URL.

---

## Self-review checklist (run by author after writing this plan)

- [x] Spec coverage: every locked requirement (recursion both verbs, replace-subtree PUT, single atomic Hasura mutation, dynamic update_columns, all 46 resources, auto-id, string-id rejection, FK-on-child recursion, bug-087 PUT FK fold-in, hard caps + cycle detection) maps to a task. Confirmed.
- [x] Placeholder scan: no "TBD"/"TODO"/"add appropriate handling" without code. Step 13.2 OpenAPI bulk edit calls out manual judgment but specifies the exact transformation. Step 14 caller migration is intrinsically external and is described concretely.
- [x] Type consistency: `WriteNode`, `JunctionEdge`, `ChildFkEdge`, `ValidationError`, `compilePost`, `compilePut`, `buildTree` named identically across tasks.
- [x] Test code is complete in every test step.
- [x] Each task ends in a commit.
