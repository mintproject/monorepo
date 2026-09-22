/**
 * Two-pass nested write pipeline — Pass 2.
 *
 * compilePost() takes a WriteNode tree (from buildTree / Pass 1) and compiles
 * it into a Hasura insert mutation string + variables object ready for Apollo.
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
    obj[j.hasuraRelName] = buildJunctionInsert(j);
  }
  for (const c of node.childFks) {
    const insert = buildChildFkInsert(c);
    if (insert !== null) obj[c.hasuraRelName] = insert;
  }
  return obj;
}

function isLinkOnly(child: WriteNode): boolean {
  return (
    Object.keys(child.columns).length === 0 &&
    child.junctions.length === 0 &&
    child.childFks.length === 0
  );
}

function partitionChildFkChildren(c: ChildFkEdge): { inline: WriteNode[]; linkIds: string[] } {
  const inline: WriteNode[] = [];
  const linkIds: string[] = [];
  for (const ch of c.children) {
    if (isLinkOnly(ch)) linkIds.push(ch.id);
    else inline.push(ch);
  }
  return { inline, linkIds };
}

interface LinkOp {
  childTable: string;
  childFkColumn: string;
  parentId: string;
  ids: string[];
}

function collectLinkOps(node: WriteNode, ops: LinkOp[]): void {
  for (const c of node.childFks) {
    const { inline, linkIds } = partitionChildFkChildren(c);
    if (linkIds.length > 0) {
      ops.push({
        childTable: c.childTable,
        childFkColumn: c.childFkColumn,
        parentId: node.id,
        ids: linkIds,
      });
    }
    for (const ch of inline) collectLinkOps(ch, ops);
  }
  for (const j of node.junctions) {
    for (const ch of j.children) {
      if (!isLinkOnly(ch)) collectLinkOps(ch, ops);
    }
  }
}

function buildJunctionInsert(j: JunctionEdge): Record<string, unknown> {
  const data = j.children.map((child, idx) => buildJunctionRow(j, child, idx));
  return {
    data,
    on_conflict: {
      constraint: `${j.junctionTable}_pkey`,
      update_columns: [],
    },
  };
}

function buildJunctionRow(
  j: JunctionEdge,
  child: WriteNode,
  idx: number,
): Record<string, unknown> {
  if (isLinkOnly(child)) {
    return {
      ...j.junctionColumns[idx],
      [j.targetFkColumn]: child.id,
    };
  }
  return {
    ...j.junctionColumns[idx],
    [j.junctionRelName]: {
      data: buildInsertObject(child),
      on_conflict: {
        constraint: `${child.table}_pkey`,
        update_columns: Object.keys(child.columns),
      },
    },
  };
}

function buildChildFkInsert(c: ChildFkEdge): Record<string, unknown> | null {
  // Link-only children (id-only refs to existing rows) MUST NOT enter the
  // nested-array data — Hasura would emit a bare INSERT and Postgres NOT-NULL
  // constraints (e.g. label) would fire before ON CONFLICT can resolve.
  // They are handled out-of-band as aliased FK updates by compilePost/compilePut.
  const { inline } = partitionChildFkChildren(c);
  if (inline.length === 0) return null;
  const data = inline.map((child) => buildInsertObject(child));
  return {
    data,
    on_conflict: {
      constraint: `${c.childTable}_pkey`,
      update_columns: [...new Set(inline.flatMap((ch) => Object.keys(ch.columns)))],
    },
  };
}

function buildPutJunctionRow(j: JunctionEdge, idx: number): Record<string, unknown> {
  return buildJunctionRow(j, j.children[idx], idx);
}

function appendLinkOps(
  ops: LinkOp[],
  parts: string[],
  varDecls: string[],
  variables: Record<string, unknown>,
): void {
  ops.forEach((op, i) => {
    const childSuffix = tableSuffix(op.childTable);
    const idsVar = `link_ids_${i}`;
    const parentVar = `link_parent_${i}`;
    variables[idsVar] = op.ids;
    variables[parentVar] = op.parentId;
    varDecls.push(`$${idsVar}: [String!]!`);
    varDecls.push(`$${parentVar}: String!`);
    parts.push(
      `link_${i}: update_modelcatalog_${childSuffix}(where: { id: { _in: $${idsVar} } }, _set: { ${op.childFkColumn}: $${parentVar} }) { affected_rows }`,
    );
  });
}

export function compilePut(tree: WriteNode): CompiledMutation {
  const suffix = tableSuffix(tree.table);
  const variables: Record<string, unknown> = { id: tree.id, set: tree.columns };
  const parts: string[] = [
    `update_modelcatalog_${suffix}_by_pk(pk_columns: { id: $id }, _set: $set) { id }`,
  ];
  const varDecls: string[] = [`$id: String!`, `$set: modelcatalog_${suffix}_set_input!`];

  for (const j of tree.junctions) {
    const juncSuffix = tableSuffix(j.junctionTable);
    parts.push(
      `del_${j.junctionRelName}s: delete_modelcatalog_${juncSuffix}(where: { ${j.parentFkColumn}: { _eq: $id } }) { affected_rows }`,
    );
    if (j.children.length > 0) {
      const varName = `junc_${j.junctionRelName}s`;
      const objects = j.children.map((_, i) => ({
        ...buildPutJunctionRow(j, i),
        [j.parentFkColumn]: tree.id,
      }));
      variables[varName] = objects;
      varDecls.push(`$${varName}: [modelcatalog_${juncSuffix}_insert_input!]!`);
      parts.push(
        `ins_${j.junctionRelName}s: insert_modelcatalog_${juncSuffix}(objects: $${varName}, on_conflict: { constraint: modelcatalog_${juncSuffix}_pkey, update_columns: [] }) { affected_rows }`,
      );
    }
  }

  for (const c of tree.childFks) {
    const childSuffix = tableSuffix(c.childTable);
    const childSuffixPlural = `${childSuffix}s`;
    const idsVar = `child_ids_${childSuffixPlural}`;
    const objsVar = `child_${childSuffixPlural}`;
    // Clear keeps ALL incoming ids attached (link-only and inline-new alike) —
    // anything currently under parent and not in incoming gets FK nulled.
    const ids = c.children.map((ch) => ch.id);
    variables[idsVar] = ids;
    varDecls.push(`$${idsVar}: [String!]!`);
    parts.push(
      `clear_${childSuffixPlural}: update_modelcatalog_${childSuffix}(where: { ${c.childFkColumn}: { _eq: $id }, id: { _nin: $${idsVar} } }, _set: { ${c.childFkColumn}: null }) { affected_rows }`,
    );
    // Upsert array contains ONLY inline-new (link-only goes to link op below).
    const { inline } = partitionChildFkChildren(c);
    if (inline.length > 0) {
      const objects = inline.map((ch) => ({ ...buildInsertObject(ch), [c.childFkColumn]: tree.id }));
      variables[objsVar] = objects;
      varDecls.push(`$${objsVar}: [modelcatalog_${childSuffix}_insert_input!]!`);
      const updateCols = [...new Set(inline.flatMap((ch) => Object.keys(ch.columns)))];
      const updateColsStr = updateCols.length > 0 ? updateCols.join(', ') : '';
      parts.push(
        `upsert_${childSuffixPlural}: insert_modelcatalog_${childSuffix}(objects: $${objsVar}, on_conflict: { constraint: modelcatalog_${childSuffix}_pkey, update_columns: [${updateColsStr}] }) { affected_rows }`,
      );
    }
  }

  const linkOps: LinkOp[] = [];
  collectLinkOps(tree, linkOps);
  appendLinkOps(linkOps, parts, varDecls, variables);

  const mutation = `
    mutation UpdateMutation(${varDecls.join(', ')}) {
      ${parts.join('\n      ')}
    }
  `;
  return { mutation, variables };
}

export function compilePost(tree: WriteNode): CompiledMutation {
  const object = buildInsertObject(tree);

  // Hasura's nested-object insert auto-derives childFk columns from parent context.
  // Setting the FK explicitly raises 'cannot insert ... values are already being
  // determined by parent insert' (validation-failed). Leave them off.

  const suffix = tableSuffix(tree.table);
  const variables: Record<string, unknown> = { object };
  const varDecls: string[] = [`$object: modelcatalog_${suffix}_insert_input!`];
  const parts: string[] = [
    `insert_modelcatalog_${suffix}_one(object: $object) { id }`,
  ];

  // Link-only childFk refs cannot ride the nested-array insert (NOT-NULL on
  // child columns fires before ON CONFLICT). Emit aliased FK updates after the
  // root insert. Hasura runs top-level mutation fields sequentially.
  const linkOps: LinkOp[] = [];
  collectLinkOps(tree, linkOps);
  appendLinkOps(linkOps, parts, varDecls, variables);

  const mutation = `
    mutation CreateMutation(${varDecls.join(', ')}) {
      ${parts.join('\n      ')}
    }
  `;
  return { mutation, variables };
}
