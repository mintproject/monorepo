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
  | 'TARGET_NOT_IMPLEMENTED'
  | 'OBJECT_RELATIONSHIP_INVALID'
  | 'OBJECT_RELATIONSHIP_NESTED_WRITE_UNSUPPORTED';

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
  objectFks?: ObjectFkEdge[];
  apiType?: string;
}

export interface ObjectFkEdge {
  apiFieldName: string;
  objectFkColumn: string;
  targetId: string | null;
}

export interface JunctionEdge {
  apiFieldName: string;
  junctionTable: string;
  hasuraRelName: string;
  junctionRelName: string;
  parentFkColumn: string;
  targetFkColumn: string;
  junctionColumns: Record<string, unknown>[];
  children: WriteNode[];
}

export interface ChildFkEdge {
  apiFieldName: string;
  hasuraRelName: string;
  childTable: string;
  childFkColumn: string;
  children: WriteNode[];
}

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
  maxDepth: number;
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
      maxDepth: ctx.maxDepth,
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
    hasuraRelName: rel.hasuraRelName,
    junctionRelName: rel.junctionRelName!,
    parentFkColumn: rel.parentFkColumn!,
    targetFkColumn: resolveTargetFkColumn(rel),
    junctionColumns,
    children,
  };
}

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
      ctx.path + '/' + apiFieldName,
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
      maxDepth: ctx.maxDepth,
    };
    children.push(buildNode(item as Record<string, unknown>, targetCfg, childCtx));
  });
  return {
    apiFieldName,
    hasuraRelName: rel.hasuraRelName,
    childTable: targetCfg.hasuraTable,
    childFkColumn: rel.childFkColumn!,
    children,
  };
}

function buildObjectFkEdge(
  apiFieldName: string,
  rel: RelationshipConfig,
  rawValue: unknown,
  ctx: BuildContext,
): ObjectFkEdge {
  const path = `${ctx.path}/${apiFieldName}`;
  if (rawValue === null || (Array.isArray(rawValue) && rawValue.length === 0)) {
    return { apiFieldName, objectFkColumn: rel.objectFkColumn!, targetId: null };
  }
  if (!Array.isArray(rawValue) || rawValue.length > 1) {
    throw new ValidationError(
      'OBJECT_RELATIONSHIP_INVALID',
      path,
      `${apiFieldName} must contain zero or one object with an id`,
      400,
    );
  }

  const item = rawValue[0];
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    throw new ValidationError(
      'OBJECT_RELATIONSHIP_INVALID',
      `${path}/0`,
      `${apiFieldName} must contain an object with an id`,
      400,
    );
  }

  const rawId = (item as Record<string, unknown>).id;
  if (typeof rawId !== 'string' || rawId.length === 0) {
    throw new ValidationError(
      'OBJECT_RELATIONSHIP_INVALID',
      `${path}/0/id`,
      `${apiFieldName} object relationships require an id`,
      400,
    );
  }

  const extraKeys = Object.keys(item as Record<string, unknown>).filter((key) => key !== 'id');
  if (extraKeys.length > 0) {
    throw new ValidationError(
      'OBJECT_RELATIONSHIP_NESTED_WRITE_UNSUPPORTED',
      `${path}/0`,
      `${apiFieldName} supports link-only objects with an id; nested object writes are not supported`,
      400,
    );
  }

  return { apiFieldName, objectFkColumn: rel.objectFkColumn!, targetId: resolveId(rawId) };
}

function buildNode(
  body: Record<string, unknown>,
  cfg: ResourceConfig,
  ctx: BuildContext,
  excludeKeys: Set<string> = new Set(),
): WriteNode {
  if (ctx.depth > ctx.maxDepth) {
    throw new ValidationError('DEPTH_EXCEEDED', ctx.path, `nested payload exceeds max depth ${ctx.maxDepth} at ${ctx.path}`, 400);
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
  const objectFks: ObjectFkEdge[] = [];

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
      } else if (rel.childFkColumn) {
        const edge = buildChildFkEdge(key, rel, value, ctx);
        if (edge) childFks.push(edge);
      } else if (rel.type === 'object' && rel.objectFkColumn) {
        objectFks.push(buildObjectFkEdge(key, rel, value, ctx));
      }
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
    objectFks,
    apiType: cfg.typeName,
  };
}

export interface BuildTreeOptions {
  maxDepth?: number;
}

export function buildTree(body: Record<string, unknown>, rootCfg: ResourceConfig, opts: BuildTreeOptions = {}): WriteNode {
  const ctx: BuildContext = {
    visited: new Set<string>(),
    nodeCount: { n: 0 },
    depth: 1,
    path: '',
    maxDepth: opts.maxDepth ?? MAX_DEPTH,
  };
  return buildNode(body, rootCfg, ctx);
}
