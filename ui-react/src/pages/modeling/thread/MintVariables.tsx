/**
 * MintVariables — Variable selection step.
 *
 * 1:1 port of the legacy LitElement MintVariables component.
 * Allows the user to pick an indicator (response variable) and
 * adjustable variables for the thread. Persists via UpdateThread mutation.
 */
import React, { useEffect, useState } from 'react';

import {
  Thread,
  getUserPermission,
  useUpdateThreadMutation,
  useInsertThreadProvenanceMutation,
} from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';
import { useToast } from '@/components/ui/use-toast';

interface MintVariablesProps {
  thread: Thread;
  onContinue: () => void;
  onThreadUpdated?: () => void;
}

export function MintVariables({ thread, onContinue, onThreadUpdated }: MintVariablesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  const [editMode, setEditMode] = useState(!thread.response_variable_id);
  const [responseVarId, setResponseVarId] = useState(thread.response_variable_id ?? '');
  const [drivingVarId, setDrivingVarId] = useState(thread.driving_variable_id ?? '');
  const [saving, setSaving] = useState(false);

  // Sync when thread changes
  useEffect(() => {
    setResponseVarId(thread.response_variable_id ?? '');
    setDrivingVarId(thread.driving_variable_id ?? '');
    setEditMode(!thread.response_variable_id);
  }, [thread.id, thread.response_variable_id, thread.driving_variable_id]);

  const [updateThread] = useUpdateThreadMutation();
  const [insertProvenance] = useInsertThreadProvenanceMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!responseVarId.trim()) {
      toast({ title: 'An indicator (response variable) is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await updateThread({
        variables: {
          id: thread.id,
          name: thread.name,
          startDate: thread.start_date,
          endDate: thread.end_date,
          regionId: thread.region_id,
          responseVariableId: responseVarId.trim() || null,
          drivingVariableId: drivingVarId.trim() || null,
        },
      });
      if (user?.username) {
        await insertProvenance({
          variables: {
            threadId: thread.id,
            event: 'UPDATE',
            userid: user.username,
            notes: null,
          },
        });
      }
      toast({ title: 'Variables saved' });
      setEditMode(false);
      onThreadUpdated?.();
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setResponseVarId(thread.response_variable_id ?? '');
    setDrivingVarId(thread.driving_variable_id ?? '');
    setEditMode(false);
  }

  const hasVariables = !!thread.response_variable_id;

  return (
    <div data-testid="mint-variables">
      <p className="mb-4 text-sm text-gray-600">
        This step is for selecting indicators and adjustable variables for your analysis. An{' '}
        <strong>indicator</strong> is an index or a variable of interest that results from a model.
        An <strong>adjustable variable</strong> indicates the kind of inputs that you want to use to
        drive the results.
      </p>

      {hasVariables && !editMode ? (
        /* ── View mode ─────────────────────────────────────────────────────── */
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Variables</h4>
            {perm.write && (
              <button
                type="button"
                aria-label="Edit variables"
                onClick={() => setEditMode(true)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                ✎
              </button>
            )}{' '}
          </div>
          <div className="space-y-2 rounded border p-3 text-sm">
            <div>
              <span className="font-semibold">Indicators:</span>
              {thread.response_variable_id ? (
                <ul className="ml-2 list-inside list-disc">
                  <li>{thread.response_variable_id}</li>
                </ul>
              ) : (
                <span className="ml-2 text-gray-400">None selected</span>
              )}
            </div>
            <div>
              <span className="font-semibold">Adjustable Variables:</span>
              {thread.driving_variable_id ? (
                <ul className="ml-2 list-inside list-disc">
                  <li>{thread.driving_variable_id}</li>
                </ul>
              ) : (
                <span className="ml-2 text-gray-400">None selected</span>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              data-testid="variables-continue"
              onClick={onContinue}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        </div>
      ) : (
        /* ── Edit mode ─────────────────────────────────────────────────────── */
        <form data-testid="variables-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 rounded border p-3">
            <h4 className="text-sm font-semibold">Variables</h4>

            <div className="space-y-1">
              <label htmlFor="response-variable" className="text-sm font-medium">
                Indicator* (response variable):
              </label>
              <input
                id="response-variable"
                name="response_variable"
                type="text"
                required
                value={responseVarId}
                onChange={(e) => setResponseVarId(e.target.value)}
                placeholder="e.g. cycles__crop_production"
                className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400">
                The standard MINT variable name for the output of interest
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="driving-variable" className="text-sm font-medium">
                Adjustable Variable:
              </label>
              <input
                id="driving-variable"
                name="driving_variable"
                type="text"
                value={drivingVarId}
                onChange={(e) => setDrivingVarId(e.target.value)}
                placeholder="e.g. fertilizer_amount__average"
                className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400">
                The standard MINT variable name for the driver input
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {hasVariables && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              data-testid="variables-submit"
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Select & Continue'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
