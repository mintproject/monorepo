import { useMemo, useState } from 'react';

import type { GetModelTreeQuery } from '@/graphql/generated/graphql';

/** Unique node id within the tree — entity type + db id to avoid collisions. */
export type NodeId =
  | `software:${string}`
  | `version:${string}`
  | `config:${string}`
  | `setup:${string}`;

export type EntityType = 'software' | 'version' | 'config' | 'setup';

export interface TreeNodeData {
  nodeId: NodeId;
  entityId: string;
  entityType: EntityType;
  label: string;
  children: TreeNodeData[];
}

/** Build the flat tree from raw GraphQL data. */
function buildTree(data: GetModelTreeQuery): TreeNodeData[] {
  return data.modelcatalog_software.map((sw) => ({
    nodeId: `software:${sw.id}` as const,
    entityId: sw.id,
    entityType: 'software' as const,
    label: sw.label ?? sw.id,
    children: (sw.versions ?? []).map((ver) => ({
      nodeId: `version:${ver.id}` as const,
      entityId: ver.id,
      entityType: 'version' as const,
      label: ver.label ? `${ver.label}${ver.version_id ? ` (${ver.version_id})` : ''}` : ver.id,
      children: (ver.configurations ?? []).map((cfg) => ({
        nodeId: `config:${cfg.id}` as const,
        entityId: cfg.id,
        entityType: 'config' as const,
        label: cfg.label ?? cfg.id,
        children: (cfg.child_configurations ?? []).map((setup) => ({
          nodeId: `setup:${setup.id}` as const,
          entityId: setup.id,
          entityType: 'setup' as const,
          label: setup.label ?? setup.id,
          children: [],
        })),
      })),
    })),
  }));
}

/** Return true when a node (or any of its descendants) matches the search term. */
function nodeMatchesSearch(node: TreeNodeData, term: string): boolean {
  if (node.label.toLowerCase().includes(term)) return true;
  return node.children.some((child) => nodeMatchesSearch(child, term));
}

/** Filter the tree: keep only nodes (and their ancestors) that match. */
function filterTree(nodes: TreeNodeData[], term: string): TreeNodeData[] {
  if (!term) return nodes;
  return nodes
    .filter((n) => nodeMatchesSearch(n, term))
    .map((n) => ({ ...n, children: filterTree(n.children, term) }));
}

export interface UseModelTreeResult {
  /** Processed and (optionally) filtered tree nodes. */
  nodes: TreeNodeData[];
  /** Set of expanded node ids. */
  expandedIds: Set<NodeId>;
  /** Current search term. */
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  toggleExpanded: (nodeId: NodeId) => void;
  /** Expand all nodes (useful after a search narrows results). */
  expandAll: (nodeIds: NodeId[]) => void;
  collapseAll: () => void;
  isExpanded: (nodeId: NodeId) => boolean;
}

/**
 * Manages the tree display state: search filtering, expand/collapse.
 * Selection is handled separately by ModelSelectionContext.
 */
export function useModelTree(data: GetModelTreeQuery | undefined): UseModelTreeResult {
  const [expandedIds, setExpandedIds] = useState<Set<NodeId>>(new Set());
  const [searchTerm, setSearchTermRaw] = useState('');

  const rawNodes = useMemo(() => (data ? buildTree(data) : []), [data]);

  // When the search term changes, auto-expand nodes that match.
  const handleSetSearchTerm = (term: string) => {
    const lower = term.toLowerCase().trim();
    setSearchTermRaw(lower);
    if (lower) {
      // Collect every nodeId for nodes that have matches in their subtree.
      const toExpand: NodeId[] = [];
      function collectParents(nodes: TreeNodeData[]) {
        for (const node of nodes) {
          if (nodeMatchesSearch(node, lower)) {
            toExpand.push(node.nodeId);
            collectParents(node.children);
          }
        }
      }
      collectParents(rawNodes);
      setExpandedIds(new Set(toExpand));
    } else {
      setExpandedIds(new Set());
    }
  };

  const nodes = useMemo(() => filterTree(rawNodes, searchTerm), [rawNodes, searchTerm]);

  const toggleExpanded = (nodeId: NodeId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = (nodeIds: NodeId[]) => {
    setExpandedIds(new Set(nodeIds));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const isExpanded = (nodeId: NodeId) => expandedIds.has(nodeId);

  return {
    nodes,
    expandedIds,
    searchTerm,
    setSearchTerm: handleSetSearchTerm,
    toggleExpanded,
    expandAll,
    collapseAll,
    isExpanded,
  };
}
