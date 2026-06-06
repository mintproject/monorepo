/**
 * ThreadExpansionDatasets — Dataset selection subpanel.
 *
 * 1:1 port of the legacy LitElement ThreadExpansionDatasets component.
 * Wraps MintDatasets inside a collapsible ThreadExpansion panel.
 *
 * Thread model data (models, ensembles, threadData) is passed down
 * from the parent MintConfigure / MintThread component.
 */
import { Thread, getUserPermission } from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';

import {
  MintDatasets,
  type ThreadModel,
  type ThreadModelEnsemble,
  type PersistedDataslice,
} from './MintDatasets';
import { ThreadExpansion, type ExpansionStatus } from './ThreadExpansion';

interface ThreadExpansionDatasetsProps {
  thread: Thread;
  /** Models selected for this thread (from the models step) */
  models?: Record<string, ThreadModel>;
  /** Existing ensemble bindings (from Hasura) */
  modelEnsembles?: Record<string, ThreadModelEnsemble>;
  /** Existing dataslice map (from Hasura) */
  threadData?: Record<string, PersistedDataslice>;
  /** Region geometry for spatial filtering */
  regionGeometry?: unknown;
  onUpdated?: () => void;
  onContinue?: () => void;
}

export function ThreadExpansionDatasets({
  thread,
  models = {},
  modelEnsembles = {},
  threadData = {},
  regionGeometry,
  onUpdated,
  onContinue,
}: ThreadExpansionDatasetsProps) {
  const { user } = useAuth();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  function getStatus(): ExpansionStatus {
    const hasBinding = Object.values(modelEnsembles).some((ens) =>
      Object.values(ens.bindings).some((binds) => binds.length > 0),
    );
    return hasBinding ? 'done' : 'warning';
  }

  function getStatusInfo(): string {
    const hasBinding = Object.values(modelEnsembles).some((ens) =>
      Object.values(ens.bindings).some((binds) => binds.length > 0),
    );
    if (hasBinding) {
      const total = Object.values(modelEnsembles)
        .flatMap((ens) => Object.values(ens.bindings))
        .flat().length;
      return `${total} dataset${total !== 1 ? 's' : ''} selected`;
    }
    return 'Open to select datasets for this sub-task';
  }

  const datasetsContent = (
    <MintDatasets
      thread={thread}
      models={models}
      modelEnsembles={modelEnsembles}
      threadData={threadData}
      regionGeometry={regionGeometry}
      onContinue={() => {
        onContinue?.();
      }}
      onThreadUpdated={onUpdated}
    />
  );

  return (
    <ThreadExpansion
      name="Select datasets"
      description="Bind datasets to model input ports."
      status={getStatus()}
      statusInfo={getStatusInfo()}
      canEdit={perm.write}
      viewContent={datasetsContent}
      editContent={datasetsContent}
      onSave={async () => {
        onUpdated?.();
      }}
    />
  );
}
