/**
 * MintConfigure — orchestrates the three configuration expansion panels.
 *
 * 1:1 port of the legacy LitElement MintConfigure component.
 * Shows three collapsible panels (Configure, Models, Datasets) and a
 * "Select & Continue" button to advance to the Parameters step.
 */
import { Thread, getUserPermission } from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';

import { ThreadExpansionConfigure } from './ThreadExpansionConfigure';
import { ThreadExpansionModels } from './ThreadExpansionModels';
import { ThreadExpansionDatasets } from './ThreadExpansionDatasets';

interface MintConfigureProps {
  thread: Thread;
  onContinue: () => void;
  onThreadUpdated?: () => void;
}

export function MintConfigure({ thread, onContinue, onThreadUpdated }: MintConfigureProps) {
  const { user } = useAuth();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  return (
    <div data-testid="mint-configure">
      <h3 className="mb-2 text-base font-semibold">Sub-task</h3>
      <p className="mb-4 text-sm text-gray-600">
        This page allows you to set a general configuration for this sub-task, choose one or more
        models and datasets to generate a set of executions to be run.
        {perm.write && (
          <span>
            {' '}
            Please click on the <span className="font-mono">✎</span> icon inside each section to
            make changes.
          </span>
        )}
      </p>

      <ThreadExpansionConfigure thread={thread} onUpdated={onThreadUpdated} />
      <ThreadExpansionModels thread={thread} onUpdated={onThreadUpdated} />
      <ThreadExpansionDatasets thread={thread} onUpdated={onThreadUpdated} />

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          data-testid="configure-continue"
          onClick={onContinue}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Select &amp; Continue
        </button>
      </div>
    </div>
  );
}
