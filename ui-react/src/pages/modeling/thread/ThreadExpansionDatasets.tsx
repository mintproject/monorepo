/**
 * ThreadExpansionDatasets — Dataset selection subpanel.
 *
 * 1:1 port of the legacy LitElement ThreadExpansionDatasets component.
 * This card is a placeholder for the full dataset selection UI which is
 * implemented in the downstream feat/modeling-datasets card.
 */
import { Thread, getUserPermission } from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';

import { ThreadExpansion, type ExpansionStatus } from './ThreadExpansion';

interface ThreadExpansionDatasetsProps {
  thread: Thread;
  onUpdated?: () => void;
}

export function ThreadExpansionDatasets({ thread, onUpdated }: ThreadExpansionDatasetsProps) {
  const { user } = useAuth();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  function getStatus(): ExpansionStatus {
    // Full dataset binding state lives in thread_model_io table; for now return warning
    return 'warning';
  }

  function getStatusInfo(): string {
    return 'Open to select datasets for this sub-task';
  }

  const viewContent = (
    <div data-testid="datasets-view" className="text-sm text-gray-500">
      <p>
        Dataset selection will be implemented in a subsequent step. Datasets must be mapped to
        model inputs after models are selected.
      </p>
    </div>
  );

  const editContent = (
    <div data-testid="datasets-edit-form" className="text-sm text-gray-500">
      <p>
        Full dataset selection UI (bind datasets to model input ports) will be available in the
        datasets step.
      </p>
    </div>
  );

  return (
    <ThreadExpansion
      name="Select datasets"
      description="Bind datasets to model input ports."
      status={getStatus()}
      statusInfo={getStatusInfo()}
      canEdit={perm.write}
      viewContent={viewContent}
      editContent={editContent}
      onSave={async () => { onUpdated?.(); }}
    />
  );
}
