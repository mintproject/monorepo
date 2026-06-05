import React from 'react';
import { Search } from 'lucide-react';

import { useGetModelTreeQuery } from '@/graphql/generated/graphql';
import { useModelTree } from '@/hooks/useModelTree';
import type { TreeNodeData } from '@/hooks/useModelTree';
import { useModelSelection } from '@/contexts/ModelSelectionContext';
import { cn } from '@/lib/utils';

import { TreeNode } from './TreeNode';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ModelTreeProps {
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ModelTree renders the full Software → Version → Configuration → Setup
 * hierarchy.  It replaces the three legacy tree components
 * (models-tree.ts, model-version-tree.ts, compare-tree.ts).
 *
 * Selection is forwarded to ModelSelectionContext so any sibling component
 * (e.g. ConfigurationForm) can react to the current selection.
 */
export function ModelTree({ className }: ModelTreeProps) {
  const { data, loading, error } = useGetModelTreeQuery();
  const { nodes, searchTerm, setSearchTerm, isExpanded, toggleExpanded } = useModelTree(data);
  const { selection, dispatch } = useModelSelection();

  // Derive the currently highlighted entity id from the deepest selection.
  const selectedEntityId =
    selection.configurationId ?? selection.versionId ?? selection.softwareId;

  const handleSelect = (node: TreeNodeData) => {
    switch (node.entityType) {
      case 'software':
        dispatch({ type: 'SELECT_SOFTWARE', id: node.entityId });
        break;
      case 'version':
        dispatch({ type: 'SELECT_VERSION', id: node.entityId });
        break;
      case 'config':
      case 'setup':
        dispatch({ type: 'SELECT_CONFIGURATION', id: node.entityId });
        break;
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Filter models..."
          aria-label="Filter models"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={cn(
            'w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        />
      </div>

      {/* Tree */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground" role="status">
            Loading models...
          </p>
        )}

        {error && (
          <p className="px-2 py-4 text-center text-sm text-destructive" role="alert">
            Failed to load models. Please try again.
          </p>
        )}

        {!loading && !error && nodes.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            {searchTerm ? 'No models match your filter.' : 'No models found.'}
          </p>
        )}

        {!loading && !error && nodes.length > 0 && (
          <ul role="tree" aria-label="Model hierarchy" className="list-none p-0">
            {nodes.map((node) => (
              <TreeNode
                key={node.nodeId}
                node={node}
                depth={0}
                isExpanded={isExpanded}
                onToggle={toggleExpanded}
                selectedEntityId={selectedEntityId}
                onSelect={handleSelect}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
