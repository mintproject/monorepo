/**
 * MintThread — Step workflow container for a modeling sub-task.
 *
 * 1:1 port of the legacy LitElement MintThread component.
 * Provides a breadcrumb navigation bar (Configure → Variables → Models →
 * Datasets → Parameters → Runs → Results → Summary) and renders the
 * appropriate step panel based on the active section.
 *
 * This component loads thread data via Apollo and handles step transitions.
 */
import { Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Thread,
  getUserPermission,
  useGetThreadQuery,
} from '@/graphql/generated/modeling';
import {
  ExecutionSummaryMap,
  ModelEnsembleMap,
  ModelExecutionsMap,
  ThreadExecutionData,
} from '@/graphql/generated/execution';
import { useAuth } from '@/lib/auth/useAuth';
import { cn } from '@/lib/utils';

import { MintConfigure } from './thread/MintConfigure';
import { MintVariables } from './thread/MintVariables';
import { MintSummary } from './thread/MintSummary';
import { MintParameters } from './thread/MintParameters';
import { MintRuns } from './thread/MintRuns';
import { MintResults } from './thread/MintResults';

// ─── Step definitions ──────────────────────────────────────────────────────────

export type ThreadSection =
  | 'configure'
  | 'variables'
  | 'models'
  | 'datasets'
  | 'parameters'
  | 'runs'
  | 'results'
  | 'summary';

interface StepDef {
  id: ThreadSection;
  label: string;
  /** Whether the step is fully implemented (vs placeholder) */
  implemented: boolean;
}

const STEPS: StepDef[] = [
  { id: 'configure', label: 'Configure', implemented: true },
  { id: 'variables', label: 'Variables', implemented: true },
  { id: 'models', label: 'Models', implemented: false },
  { id: 'datasets', label: 'Datasets', implemented: false },
  { id: 'parameters', label: 'Parameters', implemented: true },
  { id: 'runs', label: 'Runs', implemented: true },
  { id: 'results', label: 'Results', implemented: true },
  { id: 'summary', label: 'Summary', implemented: true },
];

// ─── Status helpers ────────────────────────────────────────────────────────────

type StepStatus = 'not_started' | 'in_progress' | 'done';

function getConfigureStatus(thread: Thread): StepStatus {
  if (thread.name && thread.region_id) return 'done';
  return 'not_started';
}

function getVariablesStatus(thread: Thread): StepStatus {
  if (thread.response_variable_id) return 'done';
  return 'not_started';
}

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
      s.submitted_runs > 0 &&
      s.successful_runs + s.failed_runs >= s.total_runs &&
      s.total_runs > 0
    );
  });
  return allDone ? 'done' : 'not_started';
}

// ─── Breadcrumb ────────────────────────────────────────────────────────────────

interface BreadcrumbProps {
  steps: StepDef[];
  currentSection: ThreadSection;
  sectionStatus: Record<ThreadSection, StepStatus>;
  onSelect: (section: ThreadSection) => void;
}

function ThreadBreadcrumb({ steps, currentSection, sectionStatus, onSelect }: BreadcrumbProps) {
  return (
    <nav aria-label="Thread steps" className="flex flex-wrap gap-0 overflow-x-auto">
      {steps.map((step) => {
        const status = sectionStatus[step.id];
        const isActive = step.id === currentSection;
        const isDone = status === 'done';

        return (
          <button
            key={step.id}
            type="button"
            data-testid={`breadcrumb-${step.id}`}
            aria-current={isActive ? 'step' : undefined}
            onClick={() => onSelect(step.id)}
            className={cn(
              'relative flex items-center px-3 py-2 text-xs font-medium transition-colors',
              'border-t border-b border-r first:border-l first:rounded-l last:rounded-r',
              // Chevron arrow effect via right padding
              'after:absolute after:right-0 after:top-0 after:h-full',
              isActive && isDone && 'bg-blue-700 text-white border-blue-700',
              isActive && !isDone && 'bg-blue-600 text-white border-blue-600',
              !isActive && isDone && 'bg-teal-700 text-white border-teal-700 hover:bg-teal-600',
              !isActive && !isDone && 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
            )}
          >
            {isDone && !isActive && (
              <span className="mr-1 text-green-300 font-bold">✓</span>
            )}
            {step.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Step placeholder ──────────────────────────────────────────────────────────

function StepPlaceholder({ name }: { name: string }) {
  return (
    <div className="py-8 text-center text-sm text-gray-400" data-testid={`placeholder-${name}`}>
      <p className="font-medium text-gray-500">{name} step</p>
      <p className="mt-1">This step will be implemented in a subsequent card.</p>
    </div>
  );
}

// ─── MintThread ────────────────────────────────────────────────────────────────

export function MintThread() {
  const { id: threadId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [maximized, setMaximized] = useState(false);
  const [currentSection, setCurrentSection] = useState<ThreadSection>('configure');

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

  const handleThreadUpdated = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Sync threadExecutionData when thread loads (minimal bootstrap)
  // In a full port this would come from a Hasura subscription query that joins
  // thread_model, thread_model_parameter, thread_model_io, thread_model_execution_summary
  useCallback(() => {
    if (thread && !threadExecutionData) {
      setThreadExecutionData({
        id: thread.id,
        models: {},
        model_ensembles: {},
        execution_summary: {},
        data: {},
        response_variables: thread.response_variable_id ? [thread.response_variable_id] : [],
      });
    }
  }, [thread, threadExecutionData]);

  function buildSectionStatus(t: Thread): Record<ThreadSection, StepStatus> {
    return {
      configure: getConfigureStatus(t),
      variables: getVariablesStatus(t),
      models: 'not_started',
      datasets: 'not_started',
      parameters: getParametersStatus(threadExecutionData),
      runs: getRunsStatus(threadExecutionData),
      results: 'not_started',
      summary: 'not_started',
    };
  }

  // ── Execution handlers ──────────────────────────────────────────────────

  const handleSaveParameters = useCallback(
    async (ensembles: ModelEnsembleMap, summary: ExecutionSummaryMap, _notes: string) => {
      setThreadExecutionData((prev) =>
        prev
          ? { ...prev, model_ensembles: ensembles, execution_summary: summary }
          : prev,
      );
      // In production, also persist to Hasura via mutation
    },
    [],
  );

  const handleFetchRuns = useCallback(
    (modelId: string, page: number, pageSize: number) => {
      // In a full port this dispatches a Hasura query / Apollo query with pagination.
      // Placeholder: mark as loading
      void modelId; void page; void pageSize;
      setModelExecutions((prev) => ({
        ...prev,
        [modelId]: prev[modelId] ?? { executions: [], loading: false },
      }));
    },
    [],
  );

  const handleSubmitRuns = useCallback(
    async (modelId: string) => {
      // POST to the ensemble manager REST API
      const ensembleManagerApi =
        (window.__MINT_CONFIG__ as { ENSEMBLE_MANAGER_API?: string } | undefined)
          ?.ENSEMBLE_MANAGER_API ?? '';
      const executionEngine = 'localex';
      const token = localStorage.getItem('access-token');
      const resp = await fetch(
        `${ensembleManagerApi}/executionEngines/${executionEngine}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            thread_id: threadId,
            model_id: modelId,
          }),
        },
      );
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
                    total_runs: 0, submitted_runs: 0, failed_runs: 0, successful_runs: 0,
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
      <p className="text-sm text-destructive p-4" role="alert">
        Failed to load thread: {error.message}
      </p>
    );
  }

  if (!thread) {
    return (
      <p className="text-sm text-muted-foreground p-4">
        No sub-task selected or thread not found.
      </p>
    );
  }

  const sectionStatus = buildSectionStatus(thread);
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

  function renderStep() {
    switch (currentSection) {
      case 'configure':
        return (
          <MintConfigure
            thread={thread!}
            onContinue={() => setCurrentSection('variables')}
            onThreadUpdated={handleThreadUpdated}
          />
        );
      case 'variables':
        return (
          <MintVariables
            thread={thread!}
            onContinue={() => setCurrentSection('models')}
            onThreadUpdated={handleThreadUpdated}
          />
        );
      case 'parameters':
        return (
          <MintParameters
            threadData={execData}
            canWrite={perm.write}
            canExecute={perm.write}
            onSave={handleSaveParameters}
            onContinue={() => setCurrentSection('runs')}
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
            onContinue={() => setCurrentSection('results')}
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
            onContinue={() => setCurrentSection('summary')}
            onFetchRuns={handleFetchRuns}
          />
        );
      case 'summary':
        return (
          <MintSummary
            thread={thread!}
          />
        );
      default:
        return <StepPlaceholder name={currentSection} />;
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
      {/* Header: breadcrumb + maximize toggle */}
      <div className="flex items-center gap-2 border-b pb-2 mb-0">
        <ThreadBreadcrumb
          steps={STEPS}
          currentSection={currentSection}
          sectionStatus={sectionStatus}
          onSelect={setCurrentSection}
        />
        <button
          type="button"
          aria-label={maximized ? 'Restore size' : 'Maximize'}
          onClick={() => setMaximized((m) => !m)}
          className="ml-auto shrink-0 rounded p-1.5 hover:bg-gray-100 text-gray-500"
        >
          {maximized ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderStep()}
      </div>
    </div>
  );
}
