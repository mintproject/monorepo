import { useMemo, useState } from 'react';

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
  /** Input variables from the models currently selected for this thread. */
  modelDriverOptions?: StandardVariableOption[];
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

export function VariablesStep({
  thread,
  modelDriverOptions = [],
  onUpdated,
  onContinue,
  onBack,
}: VariablesStepProps) {
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

  const uniqueModelDriverOptions = useMemo(() => {
    const byId = new Map<string, StandardVariableOption>();
    for (const option of modelDriverOptions) {
      if (!byId.has(option.id)) byId.set(option.id, option);
    }
    return [...byId.values()];
  }, [modelDriverOptions]);

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
      title="Outcome & drivers"
      description="Start with what the model should produce. Driver candidates are inferred from models and registered ETL transformations that can produce that outcome."
      canContinue={!saving}
      continueLabel={saving ? 'Saving…' : 'Continue'}
      onContinue={handleContinue}
      onBack={onBack}
    >
      <div className="max-w-xl space-y-5 text-sm">
        <section className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <div>
            <h3 className="font-semibold">Desired outcome (response variable)</h3>
            <p className="mt-1 text-xs text-gray-600">
              What should the model produce or help you understand? This is the primary way to
              narrow the Models step.
            </p>
          </div>
          <StandardVariableCombobox
            id="response-variable"
            value={indicator}
            onChange={setIndicator}
            disabled={readOnly}
            placeholder="Choose the model outcome…"
            scope="indicator"
            scopeLabel="a model produces"
          />
          {indicator ? (
            <p className="text-xs text-green-700" role="status">
              Models will be filtered to those that produce <strong>{indicator.label}</strong>.
            </p>
          ) : (
            <p className="text-xs text-gray-500" role="status">
              No desired outcome selected — all models will be available next.
            </p>
          )}
        </section>

        <section className="space-y-2 rounded-lg border p-4">
          <div>
            <h3 className="font-semibold">Potential driver</h3>
            <p className="mt-1 text-xs text-gray-600">
              Which input might you vary or investigate? The list contains variables that models
              take or adjust, including upstream inputs from multi-step model and ETL chains.
            </p>
          </div>
          <StandardVariableCombobox
            id="driving-variable"
            value={adjustable}
            onChange={setAdjustable}
            disabled={readOnly}
            placeholder="Choose a possible driver to vary…"
            scope="driver"
            scopeLabel={indicator ? 'possible upstream drivers' : 'a model uses or adjusts'}
            driverOutcomeId={indicator?.id}
          />
          {uniqueModelDriverOptions.length > 0 && (
            <div className="space-y-1.5 rounded border border-blue-100 bg-blue-50/40 p-2">
              <p className="text-xs font-medium text-blue-900">Inputs from selected models</p>
              <div className="flex flex-wrap gap-1.5">
                {uniqueModelDriverOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`rounded-full border px-2 py-1 text-xs transition-colors ${
                      adjustable?.id === option.id
                        ? 'border-blue-500 bg-blue-100 text-blue-900'
                        : 'border-blue-200 bg-white text-blue-800 hover:bg-blue-100'
                    }`}
                    onClick={() => setAdjustable(adjustable?.id === option.id ? null : option)}
                    disabled={readOnly}
                    aria-pressed={adjustable?.id === option.id}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-blue-800">
                These are the most direct driver candidates for the selected models.
              </p>
            </div>
          )}
          <p className="text-xs text-gray-500">
            This does not narrow the model list by itself; it marks an input for later scenario or
            parameter exploration.
          </p>
        </section>
      </div>
    </StepShell>
  );
}
