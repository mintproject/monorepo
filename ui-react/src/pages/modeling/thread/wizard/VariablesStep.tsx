import { useEffect, useMemo, useState } from 'react';

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
import { recommendProblemStatement } from '@/lib/modeling/problemStatementRecommendations';
import { StepShell } from './StepShell';

interface VariablesStepProps {
  thread: Thread;
  taskName?: string | null;
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
  taskName,
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
  const [recommendedResponseVariableIds, setRecommendedResponseVariableIds] = useState<string[]>(
    [],
  );

  const [updateThread] = useUpdateThreadMutation();
  const [insertProvenance] = useInsertThreadProvenanceMutation();

  const taskContext = taskName?.trim() || '';
  const goalContext = thread.name?.trim() || '';
  const recommendationTitle = taskContext || goalContext;

  useEffect(() => {
    if (!recommendationTitle) {
      setRecommendedResponseVariableIds([]);
      return;
    }

    const controller = new AbortController();
    let active = true;
    void recommendProblemStatement(
      {
        title: recommendationTitle,
        description: goalContext || taskContext,
        goals: goalContext ? [goalContext] : [],
        // Do not hard-filter outcome ranking by region. Adapter-produced
        // outcomes such as spring flow may not have a direct region link even
        // though they are valid outputs for models available in that region.
        region_id: null,
        start_date: thread.start_date,
        end_date: thread.end_date,
        ...(thread.region_id
          ? {
              spatial_conditions: {
                spatial_scope_type: 'custom',
                spatial_scope_id: thread.region_id,
                spatial_resolution: 'region',
              },
            }
          : {}),
        limit: 10,
      },
      { signal: controller.signal },
    )
      .then((response) => {
        if (active) setRecommendedResponseVariableIds(response.results.svo.map((item) => item.id));
      })
      .catch(() => {
        // Recommendation is an ordering hint. The scoped catalog remains fully usable.
        if (active) setRecommendedResponseVariableIds([]);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    goalContext,
    recommendationTitle,
    taskContext,
    thread.end_date,
    thread.region_id,
    thread.start_date,
  ]);

  const selectedModelConfigurationIds = useMemo(
    () =>
      (thread.thread_models ?? [])
        .map((model) => model.modelcatalog_configuration_id)
        .filter((id): id is string => Boolean(id)),
    [thread.thread_models],
  );

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
            preferredIds={recommendedResponseVariableIds}
          />
          {indicator ? (
            <p className="text-xs text-green-700" role="status">
              Models will be filtered to those that produce or can be transformed into{' '}
              <strong>{indicator.label}</strong>.
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
            driverOutcomeLabel={indicator?.label}
            driverConfigurationIds={selectedModelConfigurationIds}
          />
          <p className="text-xs text-gray-500">
            This does not narrow the model list by itself; it marks an input for later scenario or
            parameter exploration.
          </p>
        </section>
      </div>
    </StepShell>
  );
}
