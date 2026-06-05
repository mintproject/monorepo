import React from 'react';

import { ModelTree } from '@/components/model-tree';
import { ModelSelectionProvider, useModelSelection } from '@/contexts/ModelSelectionContext';

// ─── Detail panel ─────────────────────────────────────────────────────────────

/**
 * Displays a placeholder detail view for the currently selected entity.
 * Will be replaced by ConfigurationForm / ConfigurationDetail in a later card.
 */
function SelectionDetail() {
  const { selection } = useModelSelection();

  if (!selection.softwareId && !selection.versionId && !selection.configurationId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a model, version, or configuration on the left.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 text-sm">
      {selection.softwareId && (
        <div>
          <span className="font-medium text-muted-foreground">Model: </span>
          <span className="font-mono text-xs">{selection.softwareId}</span>
        </div>
      )}
      {selection.versionId && (
        <div>
          <span className="font-medium text-muted-foreground">Version: </span>
          <span className="font-mono text-xs">{selection.versionId}</span>
        </div>
      )}
      {selection.configurationId && (
        <div>
          <span className="font-medium text-muted-foreground">Configuration: </span>
          <span className="font-mono text-xs">{selection.configurationId}</span>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * ModelsPage: a two-panel layout.
 *
 * Left:  ModelTree for navigating Software → Version → Configuration → Setup.
 * Right: Detail/form panel (placeholder; filled by a later card).
 *
 * ModelSelectionProvider lives here so both panels share the same selection
 * context without needing global Redux state.
 */
export function ModelsPage() {
  return (
    <ModelSelectionProvider>
      <div className="flex h-full gap-0 overflow-hidden">
        {/* Left panel: model tree */}
        <aside className="flex w-72 flex-col gap-3 border-r p-4">
          <h2 className="text-base font-semibold">Models</h2>
          <ModelTree className="flex-1" />
        </aside>

        {/* Right panel: detail / form */}
        <main className="flex flex-1 flex-col overflow-auto">
          <SelectionDetail />
        </main>
      </div>
    </ModelSelectionProvider>
  );
}
