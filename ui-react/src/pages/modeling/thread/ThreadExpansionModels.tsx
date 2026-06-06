/**
 * ThreadExpansionModels — Model selection subpanel.
 *
 * 1:1 port of the legacy LitElement ThreadExpansionModels component.
 * This card is a placeholder for the full model selection UI which is
 * implemented in the downstream feat/modeling-models card.
 */
import { Thread, getUserPermission } from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';

import { ThreadExpansion, type ExpansionStatus } from './ThreadExpansion';

interface ThreadExpansionModelsProps {
  thread: Thread;
  onUpdated?: () => void;
}

export function ThreadExpansionModels({ thread, onUpdated }: ThreadExpansionModelsProps) {
  const { user } = useAuth();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  function getStatus(): ExpansionStatus {
    // Full model selection state lives in thread_model table; for now return warning
    return 'warning';
  }

  function getStatusInfo(): string {
    return 'Open to select models for this sub-task';
  }

  const viewContent = (
    <div data-testid="models-view" className="text-sm text-gray-500">
      <p>
        Model selection will be implemented in a subsequent step. Use the model catalog to find and
        select models appropriate for your region and time period.
      </p>
    </div>
  );

  const editContent = (
    <div data-testid="models-edit-form" className="text-sm text-gray-500">
      <p>
        Full model selection UI (search, filter by region, add/remove models) will be available in
        the models step.
      </p>
    </div>
  );

  return (
    <ThreadExpansion
      name="Select models"
      description="Search for a model to run."
      status={getStatus()}
      statusInfo={getStatusInfo()}
      canEdit={perm.write}
      viewContent={viewContent}
      editContent={editContent}
      onSave={async () => {
        onUpdated?.();
      }}
    />
  );
}
