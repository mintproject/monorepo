/**
 * MintThread — Step workflow container for a modeling sub-task.
 *
 * Provides a left wizard rail (Framing → Variables → Models → Datasets →
 * Parameters → Runs → Results → Summary) and renders the appropriate atomic
 * step component based on the active section.
 *
 * This component loads thread data via Apollo and handles step transitions.
 */
import { Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Skeleton } from '@/components/ui/skeleton';
import {
  getUserPermission,
  useGetThreadQuery,
  useGetModelTreeWithRegionsQuery,
} from '@/graphql/generated/modeling';
import {
  ExecutionSummaryMap,
  ModelEnsembleMap,
  ModelExecutionsMap,
  ThreadExecutionData,
} from '@/graphql/generated/execution';
import { useAuth } from '@/lib/auth/useAuth';
import { cn } from '@/lib/utils';

import { MintSummary } from './thread/MintSummary';
import { MintParameters } from './thread/MintParameters';
import { MintRuns } from './thread/MintRuns';
import { MintResults } from './thread/MintResults';
import { WizardRail } from './thread/wizard/WizardRail';
import { deriveStepStates } from './thread/wizard/deriveStepStates';
import { WIZARD_STEPS, type WizardStepId } from './thread/wizard/types';
import { FramingStep } from './thread/wizard/FramingStep';
import { VariablesStep } from './thread/wizard/VariablesStep';
import { ModelsStep } from './thread/wizard/ModelsStep';
import { DatasetsStep } from './thread/wizard/DatasetsStep';
import { buildThreadModels } from './thread/wizard/buildThreadModels';

// ─── Step order (module scope so nav helpers have a stable reference) ───────────

const stepOrder = WIZARD_STEPS.map((s) => s.id);

// ─── Status helpers ────────────────────────────────────────────────────────────

type StepStatus = 'not_started' | 'in_progress' | 'done';

function getParametersStatus(threadData: ThreadExecutionData | null): StepStatus {
  if (!threadData) return 'not_started';
  const modelIds = Object.keys(threadData.models ?? {});
  if (modelIds.length === 0) return 'not_started';
  const allBound = modelIds.every((mid) => {
    const model = threadData.models[mid]!;
    const bindings = threadData.model_ensembles[mid]?.bindings ?? {};
    return model.input_parameters
      .filter((p) => !p.value)
      .every((p) => (bindings[p.id ?? ''] ?? []).length > 0);
  });
  return allBound ? 'done' : 'not_started';
}

function getRunsStatus(threadData: ThreadExecutionData | null): StepStatus {
  if (!threadData) return 'not_started';
  const modelIds = Object.keys(threadData.execution_summary ?? {});
  if (modelIds.length === 0) return 'not_started';
  const allDone = modelIds.every((mid) => {
    const s = threadData.execution_summary[mid]!;
    return (
      s.submitted_runs > 0 && s.successful_runs + s.failed_runs >= s.total_runs && s.total_runs > 0
    );
  });
  return allDone ? 'done' : 'not_started';
}

// ─── MintThread ────────────────────────────────────────────────────────────────

interface MintThreadProps {
  /**
   * Thread to render. When provided, the component runs embedded (e.g. inside
   * the problem-statement detail panel) instead of reading the id from the
   * route. Falls back to the `:id` route param when omitted.
   */
  threadId?: string;
}

export function MintThread({ threadId: threadIdProp }: MintThreadProps = {}) {
  const { id: routeThreadId } = useParams<{ id: string }>();
  const threadId = threadIdProp ?? routeThreadId;
  const { user } = useAuth();
  const [maximized, setMaximized] = useState(false);
  const [currentSection, setCurrentSection] = useState<WizardStepId>('framing');

  const goNext = useCallback(() => {
    setCurrentSection(
      (cur) => stepOrder[Math.min(stepOrder.indexOf(cur) + 1, stepOrder.length - 1)]!,
    );
  }, []);
  const goBack = useCallback(() => {
    setCurrentSection((cur) => stepOrder[Math.max(stepOrder.indexOf(cur) - 1, 0)]!);
  }, []);

  // ── Execution state (local for this 1:1 port) ────────────────────────────
  // In the legacy app this state lives in Redux. Here we keep it local so the
  // component can function without a Hasura subscription for execution tables.
  const [threadExecutionData, setThreadExecutionData] = useState<ThreadExecutionData | null>(null);
  const [modelExecutions, setModelExecutions] = useState<ModelExecutionsMap>({});

  const { data, loading, error, refetch } = useGetThreadQuery({
    variables: { id: threadId! },
    skip: !threadId,
    fetchPolicy: 'cache-and-network',
  });

  const thread = data?.thread_by_pk ?? null;

  const { data: modelTree } = useGetModelTreeWithRegionsQuery();

  const handleThreadUpdated = useCallback(() => {
    void refetch();
  }, [refetch]);

  // ── Execution handlers ──────────────────────────────────────────────────

  const handleSaveParameters = useCallback(
    async (ensembles: ModelEnsembleMap, summary: ExecutionSummaryMap, _notes: string) => {
      setThreadExecutionData((prev) =>
        prev ? { ...prev, model_ensembles: ensembles, execution_summary: summary } : prev,
      );
      // In production, also persist to Hasura via mutation
    },
    [],
  );

  const handleFetchRuns = useCallback((modelId: string, page: number, pageSize: number) => {
    // In a full port this dispatches a Hasura query / Apollo query with pagination.
    // Placeholder: mark as loading
    void modelId;
    void page;
    void pageSize;
    setModelExecutions((prev) => ({
      ...prev,
      [modelId]: prev[modelId] ?? { executions: [], loading: false },
    }));
  }, []);

  const handleSubmitRuns = useCallback(
    async (modelId: string) => {
      // POST to the ensemble manager REST API
      const ensembleManagerApi =
        (window.__MINT_CONFIG__ as { ENSEMBLE_MANAGER_API?: string } | undefined)
          ?.ENSEMBLE_MANAGER_API ?? '';
      const executionEngine = 'localex';
      const token = localStorage.getItem('access-token');
      const resp = await fetch(`${ensembleManagerApi}/executionEngines/${executionEngine}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          thread_id: threadId,
          model_id: modelId,
        }),
      });
      if (!resp.ok) {
        throw new Error(`Ensemble manager returned ${resp.status}`);
      }
      // Mark submitted
      setThreadExecutionData((prev) =>
        prev
          ? {
              ...prev,
              execution_summary: {
                ...prev.execution_summary,
                [modelId]: {
                  ...(prev.execution_summary[modelId] ?? {
                    total_runs: 0,
                    submitted_runs: 0,
                    failed_runs: 0,
                    successful_runs: 0,
                  }),
                  submitted_for_execution: true,
                  submission_time: new Date().toISOString(),
                },
              },
            }
          : prev,
      );
    },
    [threadId],
  );

  // ── render ─────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="p-4 text-sm text-destructive" role="alert">
        Failed to load thread: {error.message}
      </p>
    );
  }

  if (!thread) {
    return (
      <p className="p-4 text-sm text-muted-foreground">No sub-task selected or thread not found.</p>
    );
  }

  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  // Derive a minimal threadExecutionData for parameter/run/result steps
  const execData: ThreadExecutionData = threadExecutionData ?? {
    id: thread.id,
    models: {},
    model_ensembles: {},
    execution_summary: {},
    data: {},
    response_variables: thread.response_variable_id ? [thread.response_variable_id] : [],
  };

  const datasetsComplete = Object.values(threadExecutionData?.model_ensembles ?? {}).some((ens) =>
    Object.values(ens.bindings ?? {}).some((b) => b.length > 0),
  );
  const stepStates = deriveStepStates(thread, {
    datasetsComplete,
    parametersComplete: getParametersStatus(threadExecutionData) === 'done',
    runsComplete: getRunsStatus(threadExecutionData) === 'done',
  });
  const builtModels = buildThreadModels(thread, modelTree);

  function renderStep() {
    switch (currentSection) {
      case 'framing':
        return <FramingStep thread={thread!} onUpdated={handleThreadUpdated} onContinue={goNext} />;
      case 'variables':
        return (
          <VariablesStep
            thread={thread!}
            onUpdated={handleThreadUpdated}
            onContinue={goNext}
            onBack={goBack}
          />
        );
      case 'models':
        return (
          <ModelsStep
            thread={thread!}
            onUpdated={handleThreadUpdated}
            onContinue={goNext}
            onBack={goBack}
            onEditIndicator={() => setCurrentSection('variables')}
          />
        );
      case 'datasets':
        return (
          <DatasetsStep
            thread={thread!}
            models={builtModels}
            onUpdated={handleThreadUpdated}
            onContinue={goNext}
            onBack={goBack}
          />
        );
      case 'parameters':
        return (
          <MintParameters
            threadData={execData}
            canWrite={perm.write}
            canExecute={perm.write}
            onSave={handleSaveParameters}
            onContinue={goNext}
          />
        );
      case 'runs':
        return (
          <MintRuns
            threadData={execData}
            executions={modelExecutions}
            canWrite={perm.write}
            canExecute={perm.write}
            ensembleManagerApi={
              (window.__MINT_CONFIG__ as { ENSEMBLE_MANAGER_API?: string } | undefined)
                ?.ENSEMBLE_MANAGER_API ?? ''
            }
            executionEngine="localex"
            onContinue={goNext}
            onFetchRuns={handleFetchRuns}
            onSubmitRuns={handleSubmitRuns}
          />
        );
      case 'results':
        return (
          <MintResults
            threadData={execData}
            executions={modelExecutions}
            canWrite={perm.write}
            ingestionApiAvailable={false}
            onContinue={goNext}
            onFetchRuns={handleFetchRuns}
          />
        );
      case 'summary':
        return <MintSummary thread={thread!} />;
    }
  }

  return (
    <div
      data-testid="mint-thread"
      className={cn(
        'flex flex-col overflow-hidden',
        maximized ? 'fixed inset-0 z-50 bg-white p-4' : 'h-full',
      )}
    >
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          aria-label={maximized ? 'Restore size' : 'Maximize'}
          onClick={() => setMaximized((m) => !m)}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
        >
          {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex flex-1 gap-4 overflow-hidden">
        <WizardRail states={stepStates} currentStep={currentSection} onSelect={setCurrentSection} />
        <div className="flex-1 overflow-y-auto pr-1">{renderStep()}</div>
      </div>
    </div>
  );
}
