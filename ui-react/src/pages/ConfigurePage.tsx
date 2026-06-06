/**
 * ConfigurePage — two-column layout: ModelTree left + form/detail right.
 *
 * Route: /models/configure/:id
 *
 * Selecting a configuration in the tree shows ConfigurationDetail.
 * Clicking "Edit" transitions to ConfigurationForm.
 * After saving, transitions back to ConfigurationDetail.
 */
import * as React from 'react';
import { useParams } from 'react-router-dom';

import { ModelTree } from '@/components/model-tree';
import { ModelSelectionProvider, useModelSelection } from '@/contexts/ModelSelectionContext';
import { ConfigurationDetail } from '@/components/configuration/ConfigurationDetail';
import { ConfigurationForm } from '@/components/configuration/ConfigurationForm';
import { EmptyState } from '@/components/common/EmptyState';

// ─── Right panel ─────────────────────────────────────────────────────────────

function ConfigurePanel() {
  const { id: routeConfigId } = useParams<{ id: string }>();
  const { selection } = useModelSelection();

  // Prefer the route parameter; fall back to tree selection
  const configId = routeConfigId ?? selection.configurationId;

  const [isEditing, setIsEditing] = React.useState(false);

  // When the selected configuration changes, reset to detail view
  React.useEffect(() => {
    setIsEditing(false);
  }, [configId]);

  if (!configId) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          title="No configuration selected"
          description="Select a configuration from the tree on the left to view or edit it."
        />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="p-6 overflow-auto">
        <ConfigurationForm
          configurationId={configId}
          onSaved={() => setIsEditing(false)}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 overflow-auto">
      <ConfigurationDetail
        configurationId={configId}
        onEdit={() => setIsEditing(true)}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * ConfigurePage: two-panel layout.
 * Left:  ModelTree for navigating Software → Version → Configuration.
 * Right: ConfigurationDetail or ConfigurationForm depending on edit state.
 */
export function ConfigurePage() {
  return (
    <ModelSelectionProvider>
      <div className="flex h-full gap-0 overflow-hidden">
        {/* Left panel: model tree */}
        <aside className="flex w-72 flex-col gap-3 border-r p-4 overflow-auto">
          <h2 className="text-base font-semibold shrink-0">Models</h2>
          <ModelTree className="flex-1 min-h-0" />
        </aside>

        {/* Right panel: detail / form */}
        <main className="flex flex-1 flex-col overflow-auto">
          <ConfigurePanel />
        </main>
      </div>
    </ModelSelectionProvider>
  );
}
