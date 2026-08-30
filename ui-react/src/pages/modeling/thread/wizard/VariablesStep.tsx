import { useState } from 'react';

import {
  Thread,
  getUserPermission,
  useUpdateThreadMutation,
  useInsertThreadProvenanceMutation,
} from '@/graphql/generated/modeling';
import {
  StandardVariableCombobox,
  type StandardVariableOption,
} from '@/components/autocomplete/StandardVariableCombobox';
import { useAuth } from '@/lib/auth/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { StepShell } from './StepShell';

interface VariablesStepProps {
  thread: Thread;
  onUpdated: () => void;
  onContinue: () => void;
  onBack?: () => void;
}

/**
 * Build a minimal option from what the thread stores.
 *
 * The stored id is a standard variable URI (#106), which is unreadable in the
 * combobox trigger, so the label carried by the relationship is used when there
 * is one. Falling back to the id keeps an unlabelled variable visible rather
 * than blank.
 */
function optionFromId(id?: string | null, label?: string | null): StandardVariableOption | null {
  if (!id) return null;
  return { id, label: label || id, description: null };
}

export function VariablesStep({ thread, onUpdated, onContinue, onBack }: VariablesStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  const [indicator, setIndicator] = useState<StandardVariableOption | null>(
    optionFromId(thread.response_variable_id, thread.response_variable?.label),
  );
  const [adjustable, setAdjustable] = useState<StandardVariableOption | null>(
    optionFromId(thread.driving_variable_id, thread.driving_variable?.label),
  );
  const [saving, setSaving] = useState(false);

  const [updateThread] = useUpdateThreadMutation();
  const [insertProvenance] = useInsertThreadProvenanceMutation();

  async function handleContinue() {
    setSaving(true);
    try {
      await updateThread({
        variables: {
          id: thread.id,
          name: thread.name,
          startDate: thread.start_date,
          endDate: thread.end_date,
          regionId: thread.region_id ?? null,
          responseVariableId: indicator?.id ?? null,
          drivingVariableId: adjustable?.id ?? null,
        },
      });
      if (user?.username) {
        await insertProvenance({
          variables: { threadId: thread.id, event: 'UPDATE', userid: user.username, notes: null },
        });
      }
      onUpdated();
      onContinue();
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const readOnly = !perm.write;

  return (
    <StepShell
      title="Variables"
      description="Optionally focus this sub-task by indicator and adjustable variable. You can skip this step."
      canContinue={!saving}
      continueLabel={saving ? 'Saving…' : 'Continue'}
      onContinue={handleContinue}
      onBack={onBack}
    >
      <div className="max-w-xl space-y-5 text-sm">
        <div className="space-y-1">
          <label className="font-semibold">Indicator</label>
          <StandardVariableCombobox
            value={indicator}
            onChange={setIndicator}
            disabled={readOnly}
            placeholder="Search standard variables…"
          />
          {indicator ? (
            <p className="text-xs text-green-700">
              Models will be filtered to those that produce <strong>{indicator.label}</strong>.
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              No indicator set — all models will be available next.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="font-semibold">Adjustable variable</label>
          <StandardVariableCombobox
            value={adjustable}
            onChange={setAdjustable}
            disabled={readOnly}
            placeholder="Search standard variables…"
          />
          <p className="text-xs text-gray-500">Marks an input you intend to vary across runs.</p>
        </div>
      </div>
    </StepShell>
  );
}
