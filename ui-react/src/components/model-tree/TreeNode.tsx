import React from 'react';
import { ChevronDown, ChevronRight, Cpu, FileSliders, GitBranch, Package } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { EntityType, NodeId, TreeNodeData } from '@/hooks/useModelTree';

// ─── Icon map ────────────────────────────────────────────────────────────────

const ENTITY_ICONS: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  software: Cpu,
  version: GitBranch,
  config: Package,
  setup: FileSliders,
};

const ENTITY_LABELS: Record<EntityType, string> = {
  software: 'Model',
  version: 'Version',
  config: 'Configuration',
  setup: 'Setup',
};

// ─── Props ───────────────────────────────────────────────────────────────────

export interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
  isExpanded: (nodeId: NodeId) => boolean;
  onToggle: (nodeId: NodeId) => void;
  selectedEntityId: string | null;
  onSelect: (node: TreeNodeData) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Recursive tree node.
 * Renders itself and recursively renders child nodes when expanded.
 */
export function TreeNode({
  node,
  depth,
  isExpanded,
  onToggle,
  selectedEntityId,
  onSelect,
}: TreeNodeProps) {
  const Icon = ENTITY_ICONS[node.entityType];
  const hasChildren = node.children.length > 0;
  const expanded = isExpanded(node.nodeId);
  const selected = node.entityId === selectedEntityId;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(node);
    }
    if (e.key === 'ArrowRight' && hasChildren && !expanded) {
      e.preventDefault();
      onToggle(node.nodeId);
    }
    if (e.key === 'ArrowLeft' && expanded) {
      e.preventDefault();
      onToggle(node.nodeId);
    }
  };

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={selected}>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          'group flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm',
          'transition-colors hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected && 'bg-accent font-medium text-accent-foreground',
          !selected && 'text-foreground',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(node)}
        onKeyDown={handleKeyDown}
        aria-label={`${ENTITY_LABELS[node.entityType]}: ${node.label}`}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            tabIndex={-1}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.nodeId);
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          // Placeholder to align leaf nodes with expandable nodes
          <span className="w-3.5 shrink-0" />
        )}

        {/* Entity type icon */}
        <Icon
          className={cn(
            'h-4 w-4 shrink-0',
            selected ? 'text-accent-foreground' : 'text-muted-foreground',
          )}
        />

        {/* Label */}
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <ul role="group" className="list-none p-0">
          {node.children.map((child) => (
            <TreeNode
              key={child.nodeId}
              node={child}
              depth={depth + 1}
              isExpanded={isExpanded}
              onToggle={onToggle}
              selectedEntityId={selectedEntityId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
