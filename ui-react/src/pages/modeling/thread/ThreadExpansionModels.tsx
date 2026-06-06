/**
 * ThreadExpansionModels — Model selection subpanel in the thread expansion layout.
 *
 * 1:1 port of the legacy LitElement ThreadExpansionModels component.
 * Wraps MintModels inside the ThreadExpansion collapsible container and
 * wires up the expand/collapse lifecycle.
 */
import { Thread, getUserPermission, getLatestEventOfType } from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';

import { ThreadExpansion, type ExpansionStatus } from './ThreadExpansion';
import { MintModels } from './MintModels';

interface ThreadExpansionModelsProps {
  thread: Thread;
  onUpdated?: () => void;
  onContinue?: () => void;
}

export function ThreadExpansionModels({ thread, onUpdated, onContinue }: ThreadExpansionModelsProps) {
  const { user } = useAuth();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  const hasModels = (thread.thread_models?.length ?? 0) > 0;

  function getStatus(): ExpansionStatus {
    if (hasModels) return 'done';
    return 'warning';
  }

  function getStatusInfo(): string {
    if (hasModels) {
      const count = thread.thread_models!.length;
      return `${count} model${count !== 1 ? 's' : ''} selected`;
    }
    return 'Open to select models for this sub-task';
  }

  function getDescription(): string {
    if (hasModels) {
      const latestEvent = getLatestEventOfType(['SELECT_MODELS'], thread.events);
      if (latestEvent) {
        const date = new Date(latestEvent.timestamp).toLocaleDateString();
        return `Models selected on ${date} by ${latestEvent.userid}`;
      }
      return 'Models have been selected for this sub-task.';
    }
    return 'Search for a model to run.';
  }

  // View mode: selected models list, delegated to MintModels
  const viewContent = (
    <MintModels
      thread={thread}
      onThreadUpdated={onUpdated}
      onContinue={onContinue}
    />
  );

  // Edit content is null — MintModels handles its own edit/view toggle
  return (
    <ThreadExpansion
      name="Select models"
      description={getDescription()}
      status={getStatus()}
      statusInfo={getStatusInfo()}
      defaultOpen={!hasModels}
      canEdit={perm.write}
      viewContent={viewContent}
      onSave={async () => { onUpdated?.(); }}
    />
  );
}
