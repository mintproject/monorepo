/**
 * MintThread — Step workflow container for a modeling sub-task.
 *
 * Provides a left wizard rail (Framing → Variables → Models → Datasets →
 * Parameters → Runs → Results → Summary) and renders the appropriate atomic
 * step component based on the active section.
 *
 * Two queries feed it. GetThread holds the thread's metadata and permissions;
 * GetThreadExecution holds the execution pipeline — the selected models with
 * their catalog I/O, the data and parameter bindings, and the run summaries.
 * Everything downstream of the Models step reads the second one, so a step is
 * only ever as complete as what the database actually holds.
 */
import { Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { useParams } from 'react-router-dom';

import { Skeleton } from '@/components/ui/skeleton';
import { getUserPermission, useGetThreadQuery } from '@/graphql/generated/modeling';
import {
  ExecutionSummaryMap,
  ModelEnsembleMap,
  ModelExecutionsMap,
  ThreadExecutionData,
} from '@/graphql/generated/execution';
import {
  GetThreadModelExecutionsDocument,
  useGetThreadExecutionQuery,
  useUpdateThreadParametersMutation,
  type GetThreadModelExecutionsQuery,
  type GetThreadModelExecutionsQueryVariables,
  type ThreadModelParameterInsert,
  type ThreadModelSummaryInsert,
} from '@/graphql/generated/thread-execution';
import {
  datasetsComplete,
  executionFromGQL,
  hasUnfinishedRuns,
  parametersComplete,
  runsComplete,
  threadExecutionFromGQL,
} from '@/lib/thread-execution';
import { publishResults, submitRuns } from '@/lib/ensemble-manager';
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

// ─── Step order (module scope so nav helpers have a stable reference) ───────────

const stepOrder = WIZARD_STEPS.map((s) => s.id);

/** How often to re-read the execution summary while runs are still in flight. */
const RUN_POLL_MS = 10_000;

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
  const apollo = useApolloClient();
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

  const [modelExecutions, setModelExecutions] = useState<ModelExecutionsMap>({});

  const { data, loading, error, refetch } = useGetThreadQuery({
    variables: { id: threadId! },
    skip: !threadId,
    fetchPolicy: 'cache-and-network',
  });

  const thread = data?.thread_by_pk ?? null;

  const {
    data: execRaw,
    refetch: refetchExecution,
    startPolling,
    stopPolling,
  } = useGetThreadExecutionQuery({
    variables: { id: threadId! },
    skip: !threadId,
    fetchPolicy: 'cache-and-network',
  });

  const threadExecutionData = useMemo(
    () => threadExecutionFromGQL(execRaw?.thread_by_pk),
    [execRaw],
  );

  // The geometries the Datasets step narrows on. A thread with no region hands
  // down undefined, which means "no region filter" rather than an empty extent.
  const regionGeometry = useMemo(
    () => (thread?.region?.geometries ?? []).map((g) => g.geometry).filter(Boolean),
    [thread?.region],
  );

  // The execution engine writes the run counters; nothing pushes them back, so
  // poll while a submitted run is still unfinished and stop as soon as it is.
  const runsInFlight = hasUnfinishedRuns(threadExecutionData?.execution_summary ?? {});
  useEffect(() => {
    if (runsInFlight) startPolling(RUN_POLL_MS);
    else stopPolling();
    return () => stopPolling();
  }, [runsInFlight, startPolling, stopPolling]);

  const handleThreadUpdated = useCallback(async () => {
    await Promise.all([refetch(), refetchExecution()]);
  }, [refetch, refetchExecution]);

  const [updateThreadParameters] = useUpdateThreadParametersMutation();

  // ── Execution handlers ──────────────────────────────────────────────────

  const handleSaveParameters = useCallback(
    async (ensembles: ModelEnsembleMap, summary: ExecutionSummaryMap, notes: string) => {
      if (!threadId || !threadExecutionData) return;
      const modelParams: ThreadModelParameterInsert[] = [];
      const summaries: ThreadModelSummaryInsert[] = [];

      for (const [modelId, ensemble] of Object.entries(ensembles)) {
        const model = threadExecutionData.models[modelId];
        // `bindings` holds data and parameter bindings side by side; only the
        // adjustable parameters belong in thread_model_parameter.
        if (!model || !ensemble.id) continue;
        for (const param of model.input_parameters.filter((p) => !p.value)) {
          for (const value of ensemble.bindings[param.id] ?? []) {
            modelParams.push({
              thread_model_id: ensemble.id,
              model_parameter_id: param.id,
              parameter_value: value,
            });
          }
        }
        const counters = summary[modelId];
        summaries.push({
          thread_model_id: ensemble.id,
          total_runs: counters?.total_runs ?? 0,
          submitted_runs: 0,
          successful_runs: 0,
          failed_runs: 0,
        });
      }

      await updateThreadParameters({
        variables: {
          threadId,
          event: {
            thread_id: threadId,
            event: 'SELECT_PARAMETERS',
            userid: user?.username ?? 'anonymous',
            notes: notes || null,
          },
          summaries,
          modelParams,
        },
      });
      await handleThreadUpdated();
    },
    [threadId, threadExecutionData, updateThreadParameters, user, handleThreadUpdated],
  );

  const handleFetchRuns = useCallback(
    (modelId: string, page: number, pageSize: number) => {
      const threadModelId = threadExecutionData?.model_ensembles[modelId]?.id;
      if (!threadModelId) return;
      setModelExecutions((prev) => ({
        ...prev,
        [modelId]: { executions: prev[modelId]?.executions ?? [], loading: true },
      }));
      apollo
        .query<GetThreadModelExecutionsQuery, GetThreadModelExecutionsQueryVariables>({
          query: GetThreadModelExecutionsDocument,
          variables: { threadModelId, offset: (page - 1) * pageSize, limit: pageSize },
          fetchPolicy: 'network-only',
        })
        .then((res) => {
          setModelExecutions((prev) => ({
            ...prev,
            [modelId]: {
              executions: (res.data?.execution ?? []).map(executionFromGQL),
              loading: false,
            },
          }));
        })
        .catch(() => {
          setModelExecutions((prev) => ({
            ...prev,
            [modelId]: { executions: prev[modelId]?.executions ?? [], loading: false },
          }));
        });
    },
    [apollo, threadExecutionData],
  );

  const handleSubmitRuns = useCallback(
    async (modelId: string) => {
      // POST to the ensemble manager REST API
      const ensembleManagerApi = window.__MINT_CONFIG__?.ENSEMBLE_MANAGER_API ?? '';
      // Which backend this deployment's Ensemble Manager runs. Read at call
      // time, like the API base above. The fallback matches the one in
      // scripts/generate-env-config.mjs, and only fires against an env-config.js
      // generated before this key existed.
      const executionEngine = window.__MINT_CONFIG__?.EXECUTION_ENGINE ?? 'localex';
      await submitRuns(ensembleManagerApi, executionEngine, {
        thread_id: threadId,
        model_id: modelId,
      });
      // The engine writes the counters itself; read them back rather than
      // guessing at them locally.
      await refetchExecution();
    },
    [threadId, refetchExecution],
  );

  /**
   * Register this thread's run outputs, then read the counters back.
   *
   * `MintResults` treats the absence of this prop as "publishing is not
   * available" and returns before making any request, so leaving it unpassed
   * makes the Fetch results button silently dead — which is what #110 was.
   */
  const handlePublishResults = useCallback(async () => {
    const ensembleManagerApi = window.__MINT_CONFIG__?.ENSEMBLE_MANAGER_API ?? '';
    const problemStatementId = thread?.task?.problem_statement_id;
    const taskId = thread?.task_id;
    if (!ensembleManagerApi || !problemStatementId || !taskId || !threadId) return;
    await publishResults(ensembleManagerApi, { problemStatementId, taskId, threadId });
    // The server writes published_runs and the execution_result rows; read them
    // back rather than guessing at them locally.
    await refetchExecution();
  }, [thread, threadId, refetchExecution]);

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

  // Until the execution query resolves, the pipeline is empty rather than
  // wrong: the steps that read it show their "nothing selected yet" state.
  const execData: ThreadExecutionData = threadExecutionData ?? {
    id: thread.id,
    models: {},
    model_ensembles: {},
    execution_summary: {},
    data: {},
    response_variables: thread.response_variable_id ? [thread.response_variable_id] : [],
  };

  const stepStates = deriveStepStates(thread, {
    datasetsComplete: datasetsComplete(threadExecutionData),
    parametersComplete: parametersComplete(threadExecutionData),
    runsComplete: runsComplete(threadExecutionData),
  });

  function renderStep() {
    switch (currentSection) {
      case 'framing':
        return (
          <FramingStep
            thread={thread!}
            onUpdated={() => void handleThreadUpdated()}
            onContinue={goNext}
          />
        );
      case 'variables':
        return (
          <VariablesStep
            thread={thread!}
            onUpdated={() => void handleThreadUpdated()}
            onContinue={goNext}
            onBack={goBack}
          />
        );
      case 'models':
        return (
          <ModelsStep
            thread={thread!}
            onUpdated={() => void handleThreadUpdated()}
            onContinue={goNext}
            onBack={goBack}
            onEditIndicator={() => setCurrentSection('variables')}
          />
        );
      case 'datasets':
        return (
          <DatasetsStep
            thread={thread!}
            models={execData.models}
            ensembles={execData.model_ensembles}
            persistedData={execData.data}
            regionGeometry={regionGeometry}
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
            ensembleManagerApi={window.__MINT_CONFIG__?.ENSEMBLE_MANAGER_API ?? ''}
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
            onPublishResults={handlePublishResults}
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
