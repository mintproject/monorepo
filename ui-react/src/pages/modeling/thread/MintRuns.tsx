/**
 * MintRuns — Execution lifecycle: submit, monitor, cancel.
 *
 * 1:1 port of the legacy LitElement MintRuns component.
 * Shows per-model run counts, progress bars, and allows submitting runs to the
 * mint-ensemble-manager REST API. Supports log viewing via a modal dialog.
 *
 * Legacy: ui/src/screens/modeling/thread/mint-runs.ts
 */
import { ExternalLink, FolderOpen, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Execution,
  ExecutionSummaryMap,
  ModelExecutionsMap,
  ThreadExecutionData,
} from '@/graphql/generated/execution';
import { fetchExecutionLog, type UnifiedRunSnapshot } from '@/lib/ensemble-manager';
import { adapterParametersComplete } from '@/lib/adapter-execution';
import { ExecutionFilesDialog } from './ExecutionFilesDialog';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateTimeString(ts: string | null | undefined): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function getResourceUrl(res: {
  url?: string | null;
  location?: string | null;
  name?: string | null;
}): string {
  return res.url ?? res.location ?? res.name ?? '';
}

// ─── Status progress bar ─────────────────────────────────────────────────────

const STATUS_BAR_CLASSES: Record<string, string> = {
  SUCCESS: 'bg-green-500',
  FAILURE: 'bg-red-500',
  RUNNING: 'bg-blue-400',
  WAITING: 'bg-gray-300',
};

interface StatusBarProps {
  status: string;
  progress?: number | null;
}

function StatusBar({ status, progress }: StatusBarProps) {
  // `execution.run_progress` is a fraction, not a percentage — a finished run
  // stores 1. Read live from TACC, where every completed run reads 1. Treating
  // it as a percentage drew every running job as a 1%-wide sliver.
  const pct = status === 'FAILURE' ? 100 : Math.min(100, Math.max(0, (progress ?? 0) * 100));
  const color = STATUS_BAR_CLASSES[status] ?? 'bg-gray-300';
  return (
    <div
      className="h-4 w-24 overflow-hidden rounded bg-gray-200"
      title={status}
      aria-label={`Run status: ${status}`}
    >
      <div className={`h-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Log dialog ───────────────────────────────────────────────────────────────

interface LogDialogProps {
  open: boolean;
  log: string | null;
  onClose: () => void;
}

function LogDialog({ open, log, onClose }: LogDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Run log"
    >
      <div className="mx-4 flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Run log</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100"
            aria-label="Close log dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {log == null ? (
            <div className="flex items-center justify-center py-8">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-xs">{log}</pre>
          )}
        </div>
        <div className="flex justify-end border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function displayStatus(status?: string | null): string {
  if (!status) return 'pending';
  return status.replace(/_/g, ' ');
}

type WorkflowStageState = 'success' | 'failure' | 'running' | 'pending' | 'not-required';

function workflowStageClass(state: WorkflowStageState): string {
  if (state === 'success') return 'border-green-200 bg-green-50 text-green-800';
  if (state === 'failure') return 'border-red-200 bg-red-50 text-red-800';
  if (state === 'running') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (state === 'not-required') return 'border-gray-200 bg-gray-50 text-gray-500';
  return 'border-gray-200 bg-white text-gray-600';
}

function workflowStageLabel(state: WorkflowStageState): string {
  if (state === 'success') return 'Completed';
  if (state === 'failure') return 'Failed';
  if (state === 'running') return 'Running';
  if (state === 'not-required') return 'Not required';
  return 'Waiting';
}

function isWorkflowFailure(status?: string | null): boolean {
  const normalized = String(status ?? '').toLowerCase();
  return (
    normalized.includes('fail') ||
    normalized.includes('unknown') ||
    normalized.includes('cancel') ||
    normalized === 'error'
  );
}

function isWorkflowSuccess(status?: string | null): boolean {
  return ['completed', 'success', 'model_succeeded'].includes(String(status ?? '').toLowerCase());
}

function workflowStageState(status?: string | null): WorkflowStageState {
  const normalized = String(status ?? '').toLowerCase();
  if (isWorkflowFailure(normalized)) return 'failure';
  if (['succeeded', 'completed', 'success'].includes(normalized)) return 'success';
  if (['running', 'submitting'].includes(normalized)) return 'running';
  return 'pending';
}

interface UnifiedExecutionPanelProps {
  run: UnifiedRunSnapshot;
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
  refreshError?: string;
}

function UnifiedExecutionPanel({
  run,
  onRefresh,
  refreshing = false,
  refreshError,
}: UnifiedExecutionPanelProps) {
  const adapterRuns = run.adapter_runs ?? [];
  const isPostModelAdapter = run.adapter_stage === 'post_model';
  const isPipeline =
    run.execution_mode === 'workflow_pipeline' || isPostModelAdapter || adapterRuns.length > 0;
  const tapisWorkflow = run.tapis_workflow;
  const modelJobId = run.model_job_id ?? run.model_child_id;
  const status = String(run.status ?? '');
  const persistedModelStage = run.workflow_stages?.find((stage) => stage.type === 'model');
  const adapterStage: WorkflowStageState = !isPipeline
    ? 'not-required'
    : adapterRuns.some((child) => isWorkflowFailure(child.status))
      ? 'failure'
      : adapterRuns.length > 0 && adapterRuns.every((child) => isWorkflowSuccess(child.status))
        ? 'success'
        : isPostModelAdapter &&
            ['model_dispatching', 'model_submitted', 'model_running', 'model_succeeded'].includes(
              status,
            )
          ? 'pending'
          : 'running';
  const handoffStage: WorkflowStageState = !isPipeline
    ? 'not-required'
    : isWorkflowFailure(run.status) || run.error_message
      ? 'failure'
      : isPostModelAdapter
        ? ['adapter_running', 'completed'].includes(status)
          ? 'success'
          : ['output_registering', 'output_verifying', 'adapter_dispatching'].includes(status)
            ? 'running'
            : 'pending'
        : ['model_dispatching', 'model_submitted', 'model_running', 'model_succeeded'].includes(
              status,
            )
          ? 'success'
          : 'pending';
  const modelStage: WorkflowStageState = persistedModelStage
    ? workflowStageState(persistedModelStage.status)
    : !modelJobId
      ? isPipeline
        ? 'pending'
        : 'not-required'
      : isWorkflowFailure(run.status)
        ? 'failure'
        : run.status === 'model_running'
          ? 'running'
          : isWorkflowSuccess(run.status)
            ? 'success'
            : 'pending';

  const stageRows: Array<{ label: string; state: WorkflowStageState; detail: string }> = [
    {
      label: 'SVO adapter workflow',
      state: adapterStage,
      detail:
        adapterRuns.length > 0
          ? `${adapterRuns.length} workflow${adapterRuns.length === 1 ? '' : 's'}`
          : isPostModelAdapter
            ? 'Deferred until model output'
            : 'No adapter step',
    },
    {
      label: 'Output handoff',
      state: handoffStage,
      detail: isPostModelAdapter
        ? handoffStage === 'success'
          ? 'Output handed to adapter'
          : handoffStage === 'running'
            ? 'Registering model output'
            : 'Waiting for model output'
        : isPipeline
          ? displayStatus(run.status)
          : 'No adapter output handoff',
    },
    {
      label: 'Model application',
      state: modelStage,
      detail: modelJobId
        ? displayStatus(run.status)
        : isPipeline
          ? 'Waiting for adapter output'
          : 'Not submitted yet',
    },
  ];

  return (
    <div
      className="space-y-3 rounded border border-blue-200 bg-blue-50 px-3 py-3 text-xs"
      data-testid="unified-execution-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-blue-900">Workflow pipeline details</span>
          <span className="font-medium text-blue-900">
            {isPipeline
              ? 'Workflow pipeline'
              : run.execution_mode === 'workflow'
                ? 'SVO workflow'
                : 'Model job'}
          </span>
          <span className="text-blue-700">Overall: {displayStatus(run.status)}</span>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={refreshing}
            className="flex items-center gap-1 rounded border border-blue-300 bg-white px-2 py-1 text-blue-800 hover:bg-blue-100 disabled:opacity-50"
            data-testid="refresh-workflow"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh workflow'}
          </button>
        )}
      </div>
      {isPipeline ? (
        <div className="space-y-1 text-blue-800">
          <div>
            Tapis workflow run ID: <code>{tapisWorkflow?.run_id ?? 'not submitted yet'}</code>
          </div>
          {tapisWorkflow?.workflow_id && (
            <div>
              Tapis pipeline ID: <code>{tapisWorkflow.workflow_id}</code>
            </div>
          )}
        </div>
      ) : (
        run.run_id && (
          <div className="text-blue-800">
            Execution ID: <code>{run.run_id}</code>
          </div>
        )
      )}
      {isPipeline && (
        <div className="rounded border border-blue-200 bg-white px-2 py-2 text-blue-800">
          <span className="font-medium">Tapis Workflows tracking:</span>{' '}
          {tapisWorkflow?.workflow_id ? (
            <>
              pipeline <code>{tapisWorkflow.workflow_id}</code> · run{' '}
              <code>{tapisWorkflow.run_id ?? 'not started'}</code>
            </>
          ) : isPostModelAdapter ? (
            'not submitted yet — the post-model pipeline is created after model output is available'
          ) : (
            'not registered yet'
          )}
        </div>
      )}
      {isPipeline && (
        <p className="rounded border border-blue-200 bg-white px-2 py-2 text-blue-800">
          The model application is a stage in this parent workflow. Its provider ID is shown for
          troubleshooting and is not a separate pipeline.
        </p>
      )}
      {!isPipeline && (
        <p className="rounded border border-gray-200 bg-white px-2 py-2 text-blue-800">
          This run was submitted as a model job, so no SVO workflow stages were recorded. New
          workflow submissions will show the adapter, output handoff, and model application stages
          here.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-3" data-testid="workflow-stages">
        {stageRows.map((stage) => (
          <div
            key={stage.label}
            className={`rounded border px-2 py-2 ${workflowStageClass(stage.state)}`}
          >
            <div className="flex items-center justify-between gap-2 font-medium">
              <span>{stage.label}</span>
              <span>{workflowStageLabel(stage.state)}</span>
            </div>
            <div className="mt-1 text-[11px] opacity-80">{stage.detail}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1 text-blue-900">
        {modelJobId && (
          <div>
            <span className="font-medium">Tapis model job ID:</span> <code>{modelJobId}</code>
          </div>
        )}
        {adapterRuns.map((child, index) => (
          <div key={child.run_id ?? `${child.adapter_plan_id ?? 'workflow'}-${index}`}>
            <span className="font-medium">SVO workflow:</span>{' '}
            <code>{child.tapis_workflow_id ?? 'not registered yet'}</code>{' '}
            <span className="text-blue-700">
              run {child.tapis_run_id ?? 'not submitted'} · {displayStatus(child.status)}
            </span>
          </div>
        ))}
      </div>
      {(run.failure_code || run.error_message) && (
        <div className="rounded border border-red-200 bg-red-50 px-2 py-2 text-red-800">
          {run.failure_code && <div className="font-medium">Failure: {run.failure_code}</div>}
          {run.error_message && <div>{run.error_message}</div>}
        </div>
      )}
      {refreshError && (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-2 text-amber-800">
          Showing the last saved workflow state. Refresh failed: {refreshError}
        </div>
      )}
      <p className="text-[11px] text-blue-700">
        Application output logs are separate; use <span className="font-medium">View Log</span> in
        the run table for the model job log.
      </p>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MintRunsProps {
  threadId?: string;
  threadData: ThreadExecutionData;
  executions: ModelExecutionsMap;
  canWrite: boolean;
  canExecute: boolean;
  ensembleManagerApi: string;
  unifiedRuns?: Record<string, UnifiedRunSnapshot>;
  onRefreshWorkflow?: (modelId: string) => Promise<void>;
  workflowRefreshErrors?: Record<string, string>;
  workflowRefreshing?: Record<string, boolean>;
  onContinue: () => void;
  onFetchRuns: (modelId: string, page: number, pageSize: number) => void;
  onSubmitRuns: (modelId: string) => Promise<void>;
  onExecutionSummaryChanged?: (summary: ExecutionSummaryMap) => void;
  /**
   * Publish one execution. Absent means publishing is not available, and the
   * files dialog then only lists and promotes.
   */
  onPublishExecution?: (executionId: string) => Promise<void>;
  /** Called after the user promotes a file, so the caller re-reads the thread. */
  onOutputsChanged?: () => void | Promise<void>;
  /** Adapter plan discovery must finish before a run can be submitted. */
  adapterPlansLoading?: boolean;
  adapterPlanError?: string | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

export function MintRuns({
  threadId,
  threadData,
  executions,
  canWrite,
  canExecute,
  ensembleManagerApi,
  unifiedRuns,
  onRefreshWorkflow,
  workflowRefreshErrors,
  workflowRefreshing,
  onContinue,
  onFetchRuns,
  onSubmitRuns,
  onPublishExecution,
  onOutputsChanged,
  adapterPlansLoading = false,
  adapterPlanError,
}: MintRunsProps) {
  const modelIds = Object.keys(threadData.execution_summary ?? {});

  // Determine if params are done: every model has at least one ensemble binding
  const paramsDone =
    !adapterPlansLoading &&
    !adapterPlanError &&
    modelIds.length > 0 &&
    modelIds.every((mid) => {
      const model = threadData.models[mid];
      if (!model) return true;
      const bindings = threadData.model_ensembles[mid]?.bindings ?? {};
      return model.input_parameters
        .filter((p) => !p.value)
        .every((p) => (bindings[p.id ?? ''] ?? []).length > 0);
    }) &&
    modelIds.every((mid) => adapterParametersComplete(threadData.adapter_plans?.[mid] ?? []));

  // Are all runs finished?
  const allDone =
    modelIds.length > 0 &&
    modelIds.every((mid) => {
      const s = threadData.execution_summary[mid];
      if (!s) return false;
      return s.submitted_runs > 0 && s.successful_runs + s.failed_runs >= s.total_runs;
    });

  const [pages, setPages] = useState<Record<string, number>>({});
  const [waiting, setWaiting] = useState<Record<string, boolean>>({});
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logContent, setLogContent] = useState<string | null>(null);
  const logAbortRef = useRef<AbortController | null>(null);
  // Which run's archive the files dialog shows. The model id travels with it
  // because a promoted file is written onto that model's configuration.
  const [filesFor, setFilesFor] = useState<{ executionId: string; modelId: string } | null>(null);

  // Auto-fetch runs when page/model changes
  useEffect(() => {
    for (const mid of modelIds) {
      const page = pages[mid] ?? 1;
      onFetchRuns(mid, page, PAGE_SIZE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelIds.join(',')]);

  const handleSubmit = useCallback(
    async (mid: string) => {
      setWaiting((w) => ({ ...w, [mid]: true }));
      try {
        await onSubmitRuns(mid);
      } finally {
        setWaiting((w) => ({ ...w, [mid]: false }));
      }
    },
    [onSubmitRuns],
  );

  const handleNextPage = useCallback(
    (mid: string, delta: number) => {
      setPages((p) => {
        const next = Math.max(1, (p[mid] ?? 1) + delta);
        onFetchRuns(mid, next, PAGE_SIZE);
        return { ...p, [mid]: next };
      });
    },
    [onFetchRuns],
  );

  const handleViewLog = useCallback(
    async (executionId: string) => {
      setLogContent(null);
      setLogDialogOpen(true);
      if (logAbortRef.current) logAbortRef.current.abort();
      const ctrl = new AbortController();
      logAbortRef.current = ctrl;
      try {
        let text = await fetchExecutionLog(ensembleManagerApi, executionId, ctrl.signal);
        // Clean ANSI / escape sequences
        text = text.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, '\t');
        text = text.replace(/\\u001b.+?m/g, '').replace(/^"|"$/g, '');
        setLogContent(text);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setLogContent(`Error loading log: ${(err as Error).message}`);
        }
      }
    },
    [ensembleManagerApi],
  );

  const handleCloseLog = useCallback(() => {
    setLogDialogOpen(false);
    logAbortRef.current?.abort();
  }, []);

  const handleCloseFiles = useCallback(() => setFilesFor(null), []);

  // ─ Guard: params not configured ─────────────────────────────────────────
  if (!paramsDone) {
    return (
      <div data-testid="mint-runs">
        <p className="mb-2 text-sm text-gray-600">This step is for monitoring model runs.</p>
        <p className="text-sm text-gray-500">Please setup some models first.</p>
      </div>
    );
  }

  return (
    <div data-testid="mint-runs">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">This step is for monitoring model runs.</p>
        {threadId && (
          <Link
            to={`/modeling/thread/${encodeURIComponent(threadId)}/runs`}
            className="rounded border border-blue-200 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50"
          >
            Previous runs &amp; provenance
          </Link>
        )}
      </div>
      <h3 className="mb-3 text-sm font-semibold">Runs</h3>

      <ul className="space-y-4">
        {modelIds.map((mid) => {
          const summary = threadData.execution_summary[mid]!;
          const model = threadData.models[mid];
          if (!model) return null;

          const grouped = executions[mid] ?? { executions: [], loading: false };
          const currentPage = pages[mid] ?? 1;
          const totalPages = Math.ceil((summary.total_runs || 1) / PAGE_SIZE);

          const submittedRuns = summary.submitted_runs ?? 0;
          const failedRuns = summary.failed_runs ?? 0;
          const successfulRuns = summary.successful_runs ?? 0;
          const finishedRuns = successfulRuns + failedRuns;
          const runningRuns = submittedRuns - finishedRuns;
          const pendingRuns = summary.total_runs - submittedRuns;
          const submitted = summary.submitted_for_execution || summary.submission_time;
          const finished = finishedRuns >= summary.total_runs && summary.total_runs > 0;

          // ── count inputs × params for display ──────────────────────────
          const nParameters = model.input_parameters
            .map((p) => (threadData.model_ensembles[mid]?.bindings[p.id ?? ''] ?? [0]).length)
            .reduce((a, b) => a * b, 1);

          const nInputs = model.input_files
            .map((inf) => {
              if (inf.value) {
                return (inf.value.resources ?? []).filter((r) => r.selected !== false).length;
              }
              return (threadData.model_ensembles[mid]?.bindings[inf.id ?? ''] ?? []).length;
            })
            .reduce((a, b) => a * b, 1);

          // ── adjustable inputs / params for column headers ─────────────
          const adjustableInputs = model.input_files.filter((f) => !f.value);
          const adjustableParams = model.input_parameters.filter((p) => !p.value);

          return (
            <li key={mid} className="overflow-hidden rounded-md border">
              <div className="border-b bg-gray-50 px-4 py-2 text-sm font-medium">{model.name}</div>

              {!summary.total_runs ? (
                <div className="px-4 py-3 text-sm text-orange-600">
                  🚨 No runs configured. Please go back to the Data and Parameters steps.
                </div>
              ) : !submitted ? (
                <div className="space-y-2 px-4 py-3">
                  <p className="text-sm text-gray-600">
                    The parameter settings require {summary.total_runs} runs ({nInputs} input
                    resources × {nParameters} parameters).{' '}
                    {model.output_files.length * summary.total_runs} output files will be generated.
                  </p>
                  {!paramsDone ? (
                    <p className="text-xs text-orange-600">
                      {adapterPlanError
                        ? 'SVO adapter plan discovery failed; return to Parameters and retry.'
                        : adapterPlansLoading
                          ? 'Waiting for SVO adapter plan discovery to finish.'
                          : 'Complete the required model and SVO adapter parameters before sending runs.'}
                    </p>
                  ) : canExecute && canWrite ? (
                    <button
                      type="button"
                      data-testid={`submit-runs-${mid}`}
                      onClick={() => void handleSubmit(mid)}
                      disabled={waiting[mid]}
                      className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {waiting[mid] ? (
                        <>
                          Submitting…{' '}
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        </>
                      ) : (
                        'Send Runs'
                      )}
                    </button>
                  ) : (
                    <p className="text-xs text-gray-500">
                      You don&apos;t have permission to send runs on this sub-task.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 px-4 py-3">
                  <p className="text-sm text-gray-600">
                    Below is the status of all runs. A green bar means completed; grey/partial means
                    in progress; red means failed.
                  </p>
                  <p className="text-sm text-gray-600">
                    {summary.total_runs} runs required ({nInputs} inputs × {nParameters}{' '}
                    parameters). {!finished ? 'So far, ' : ''}
                    {submittedRuns} submitted, {successfulRuns} succeeded,{' '}
                    <span className={failedRuns > 0 ? 'text-red-600' : ''}>
                      {failedRuns} failed
                    </span>
                    . {runningRuns > 0 && `${runningRuns} running`}
                    {runningRuns > 0 && pendingRuns > 0 && ', '}
                    {pendingRuns > 0 && `${pendingRuns} waiting`}
                  </p>
                  {(() => {
                    const latestExecution = executions[mid]?.executions[0];
                    const persistedRunId = latestExecution?.run_id ?? undefined;
                    const workflowRun =
                      unifiedRuns?.[mid] ??
                      (latestExecution
                        ? {
                            run_id: persistedRunId,
                            execution_mode: persistedRunId?.startsWith('ue_')
                              ? 'workflow_pipeline'
                              : 'job',
                            status: latestExecution.status.toLowerCase(),
                          }
                        : undefined);

                    return workflowRun ? (
                      <UnifiedExecutionPanel
                        run={workflowRun}
                        onRefresh={
                          onRefreshWorkflow &&
                          (Boolean(unifiedRuns?.[mid]) || workflowRun.run_id?.startsWith('ue_'))
                            ? () => onRefreshWorkflow(mid)
                            : undefined
                        }
                        refreshing={workflowRefreshing?.[mid]}
                        refreshError={workflowRefreshErrors?.[mid]}
                      />
                    ) : null;
                  })()}

                  {/* Pagination + Reload bar */}
                  <div className="flex items-center gap-2 border border-gray-200 px-2 py-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleNextPage(mid, -1)}
                      disabled={currentPage <= 1}
                      className="rounded border px-2 py-0.5 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Back
                    </button>
                    <span>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleNextPage(mid, 1)}
                      disabled={currentPage >= totalPages}
                      className="rounded border px-2 py-0.5 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onFetchRuns(mid, currentPage, PAGE_SIZE)}
                        className="flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-gray-50"
                        title="Reload"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reload
                      </button>
                    </div>
                  </div>

                  {/* Runs table */}
                  <div className="max-h-96 overflow-auto border border-gray-200">
                    {grouped.loading ? (
                      <div className="flex items-center justify-center py-8">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      </div>
                    ) : (
                      <table
                        className="w-full border-collapse text-xs"
                        data-testid={`runs-table-${mid}`}
                      >
                        <thead className="sticky top-0 bg-gray-100">
                          <tr>
                            <th colSpan={5} className="px-2 py-1 text-left font-semibold">
                              Run
                            </th>
                            {adjustableInputs.length > 0 && (
                              <th
                                colSpan={adjustableInputs.length}
                                className="px-2 py-1 text-left font-semibold"
                              >
                                Inputs
                              </th>
                            )}
                            {adjustableParams.length > 0 && (
                              <th
                                colSpan={adjustableParams.length}
                                className="px-2 py-1 text-left font-semibold"
                              >
                                Parameters
                              </th>
                            )}
                          </tr>
                          <tr>
                            <th className="px-2 py-1 font-medium">Status</th>
                            <th className="px-2 py-1 font-medium">Start</th>
                            <th className="px-2 py-1 font-medium">End</th>
                            <th className="px-2 py-1 font-medium">Log</th>
                            <th className="px-2 py-1 font-medium">Files</th>
                            {adjustableInputs.length + adjustableParams.length === 0 && (
                              <th className="px-2 py-1" />
                            )}
                            {adjustableInputs.map((f) => (
                              <th key={f.id} className="px-2 py-1 font-medium">
                                {(f.name ?? '').replace(/[-_]/g, ' ')}
                              </th>
                            ))}
                            {adjustableParams.map((p) => (
                              <th key={p.id} className="px-2 py-1 font-medium">
                                {(p.name ?? '').replace(/[-_]/g, ' ')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {grouped.executions.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5 + adjustableInputs.length + adjustableParams.length}
                                className="px-2 py-4 text-center text-gray-400"
                              >
                                <div className="flex items-center justify-center gap-2">
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                                  Downloading software image and data…
                                </div>
                              </td>
                            </tr>
                          ) : (
                            grouped.executions.map((execution: Execution) => {
                              const paramDefaults: Record<string, string | null | undefined> = {};
                              model.input_parameters.forEach(
                                (p) => (paramDefaults[p.id ?? ''] = p.default ?? null),
                              );
                              return (
                                <tr key={execution.id} className="odd:bg-white even:bg-gray-50">
                                  <td className="px-2 py-1">
                                    <StatusBar
                                      status={execution.status}
                                      progress={execution.run_progress}
                                    />
                                  </td>
                                  <td className="px-2 py-1 text-gray-500">
                                    {toDateTimeString(execution.start_time)}
                                  </td>
                                  <td className="px-2 py-1 text-gray-500">
                                    {toDateTimeString(execution.end_time)}
                                  </td>
                                  <td className="px-2 py-1">
                                    <button
                                      type="button"
                                      onClick={() => void handleViewLog(execution.id)}
                                      className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs hover:bg-gray-50"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      View Log
                                    </button>
                                  </td>
                                  <td className="px-2 py-1">
                                    <button
                                      type="button"
                                      data-testid={`view-files-${execution.id}`}
                                      onClick={() =>
                                        setFilesFor({ executionId: execution.id, modelId: mid })
                                      }
                                      className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs hover:bg-gray-50"
                                    >
                                      <FolderOpen className="h-3 w-3" />
                                      Files
                                    </button>
                                  </td>
                                  {adjustableInputs.length + adjustableParams.length === 0 && (
                                    <td className="px-2 py-1 text-gray-400">
                                      No inputs or parameters
                                    </td>
                                  )}
                                  {adjustableInputs.map((input) => {
                                    const res = execution.bindings[input.id ?? ''] as {
                                      name?: string;
                                      url?: string;
                                      location?: string;
                                    } | null;
                                    const url = res ? getResourceUrl(res) : '';
                                    return (
                                      <td key={input.id} className="px-2 py-1">
                                        {res && url ? (
                                          <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline"
                                          >
                                            {res.name ?? url}
                                          </a>
                                        ) : (
                                          '—'
                                        )}
                                      </td>
                                    );
                                  })}
                                  {adjustableParams.map((param) => {
                                    let pval = execution.bindings[param.id ?? ''] as
                                      | string
                                      | null
                                      | undefined;
                                    if (pval == null) pval = paramDefaults[param.id ?? ''];
                                    if (
                                      typeof pval === 'string' &&
                                      pval.startsWith('__region_geojson')
                                    ) {
                                      pval = 'Region GeoJSON';
                                    }
                                    return (
                                      <td key={param.id} className="px-2 py-1">
                                        {pval ?? '—'}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Continue button */}
      {allDone && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            data-testid="runs-continue-btn"
            onClick={onContinue}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Continue
          </button>
        </div>
      )}

      {/* Log dialog */}
      <LogDialog open={logDialogOpen} log={logContent} onClose={handleCloseLog} />

      {/* Archived files of one run: promote a file, then publish it */}
      {filesFor && (
        <ExecutionFilesDialog
          open
          executionId={filesFor.executionId}
          configurationId={filesFor.modelId}
          declaredOutputLabels={(threadData.models[filesFor.modelId]?.output_files ?? []).map(
            (o) => o.name,
          )}
          ensembleManagerApi={ensembleManagerApi}
          canWrite={canWrite}
          onClose={handleCloseFiles}
          onPromoted={onOutputsChanged}
          onPublish={onPublishExecution}
        />
      )}
    </div>
  );
}
