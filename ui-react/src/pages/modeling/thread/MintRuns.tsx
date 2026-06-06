/**
 * MintRuns — Execution lifecycle: submit, monitor, cancel.
 *
 * 1:1 port of the legacy LitElement MintRuns component.
 * Shows per-model run counts, progress bars, and allows submitting runs to the
 * mint-ensemble-manager REST API. Supports log viewing via a modal dialog.
 *
 * Legacy: ui/src/screens/modeling/thread/mint-runs.ts
 */
import { ExternalLink, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Execution,
  ExecutionSummaryMap,
  ModelExecutionsMap,
  ThreadExecutionData,
} from '@/graphql/generated/execution';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateTimeString(ts: string | null | undefined): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function getResourceUrl(res: { url?: string | null; location?: string | null; name?: string | null }): string {
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
  const pct = status === 'FAILURE' ? 100 : (progress ?? 0);
  const color = STATUS_BAR_CLASSES[status] ?? 'bg-gray-300';
  return (
    <div
      className="h-4 w-24 rounded bg-gray-200 overflow-hidden"
      title={status}
      aria-label={`Run status: ${status}`}
    >
      <div
        className={`h-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Run log</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100"
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
            <pre className="text-xs whitespace-pre-wrap font-mono">{log}</pre>
          )}
        </div>
        <div className="px-4 py-3 border-t flex justify-end">
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface MintRunsProps {
  threadData: ThreadExecutionData;
  executions: ModelExecutionsMap;
  canWrite: boolean;
  canExecute: boolean;
  ensembleManagerApi: string;
  executionEngine: string;
  onContinue: () => void;
  onFetchRuns: (modelId: string, page: number, pageSize: number) => void;
  onSubmitRuns: (modelId: string) => Promise<void>;
  onExecutionSummaryChanged?: (summary: ExecutionSummaryMap) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

export function MintRuns({
  threadData,
  executions,
  canWrite,
  canExecute,
  ensembleManagerApi,
  executionEngine: _executionEngine,
  onContinue,
  onFetchRuns,
  onSubmitRuns,
}: MintRunsProps) {
  const modelIds = Object.keys(threadData.execution_summary ?? {});

  // Determine if params are done: every model has at least one ensemble binding
  const paramsDone =
    modelIds.length > 0 &&
    modelIds.every((mid) => {
      const model = threadData.models[mid];
      if (!model) return true;
      const bindings = threadData.model_ensembles[mid]?.bindings ?? {};
      return model.input_parameters
        .filter((p) => !p.value)
        .every((p) => (bindings[p.id ?? ''] ?? []).length > 0);
    });

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
        const token = localStorage.getItem('access-token');
        const resp = await fetch(
          `${ensembleManagerApi}/executions/${executionId}/logs`,
          {
            signal: ctrl.signal,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        let text = await resp.text();
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

  // ─ Guard: params not configured ─────────────────────────────────────────
  if (!paramsDone) {
    return (
      <div data-testid="mint-runs">
        <p className="text-sm text-gray-600 mb-2">This step is for monitoring model runs.</p>
        <p className="text-sm text-gray-500">Please setup some models first.</p>
      </div>
    );
  }

  return (
    <div data-testid="mint-runs">
      <p className="text-sm text-gray-600 mb-4">This step is for monitoring model runs.</p>
      <h3 className="text-sm font-semibold mb-3">Runs</h3>

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
            .map((p) => ((threadData.model_ensembles[mid]?.bindings[p.id ?? ''] ?? [0]).length))
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
            <li key={mid} className="border rounded-md overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b font-medium text-sm">
                {model.name}
              </div>

              {!summary.total_runs ? (
                <div className="px-4 py-3 text-sm text-orange-600">
                  🚨 No runs configured. Please go back to the Data and Parameters steps.
                </div>
              ) : !submitted ? (
                <div className="px-4 py-3 space-y-2">
                  <p className="text-sm text-gray-600">
                    The parameter settings require {summary.total_runs} runs ({nInputs} input
                    resources × {nParameters} parameters).{' '}
                    {model.output_files.length * summary.total_runs} output files will be
                    generated.
                  </p>
                  {canExecute && canWrite ? (
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
                <div className="px-4 py-3 space-y-2">
                  <p className="text-sm text-gray-600">
                    Below is the status of all runs. A green bar means completed; grey/partial
                    means in progress; red means failed.
                  </p>
                  <p className="text-sm text-gray-600">
                    {summary.total_runs} runs required ({nInputs} inputs × {nParameters}{' '}
                    parameters).{' '}
                    {!finished ? 'So far, ' : ''}
                    {submittedRuns} submitted, {successfulRuns} succeeded,{' '}
                    <span className={failedRuns > 0 ? 'text-red-600' : ''}>
                      {failedRuns} failed
                    </span>
                    .{' '}
                    {runningRuns > 0 && `${runningRuns} running`}
                    {runningRuns > 0 && pendingRuns > 0 && ', '}
                    {pendingRuns > 0 && `${pendingRuns} waiting`}
                  </p>

                  {/* Pagination + Reload bar */}
                  <div className="flex items-center gap-2 border border-gray-200 px-2 py-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleNextPage(mid, -1)}
                      disabled={currentPage <= 1}
                      className="px-2 py-0.5 border rounded hover:bg-gray-50 disabled:opacity-40"
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
                      className="px-2 py-0.5 border rounded hover:bg-gray-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onFetchRuns(mid, currentPage, PAGE_SIZE)}
                        className="flex items-center gap-1 px-2 py-0.5 border rounded hover:bg-gray-50"
                        title="Reload"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reload
                      </button>
                    </div>
                  </div>

                  {/* Runs table */}
                  <div className="overflow-auto max-h-96 border border-gray-200">
                    {grouped.loading ? (
                      <div className="flex items-center justify-center py-8">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      </div>
                    ) : (
                      <table
                        className="w-full text-xs border-collapse"
                        data-testid={`runs-table-${mid}`}
                      >
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th colSpan={4} className="text-left px-2 py-1 font-semibold">
                              Run
                            </th>
                            {adjustableInputs.length > 0 && (
                              <th
                                colSpan={adjustableInputs.length}
                                className="text-left px-2 py-1 font-semibold"
                              >
                                Inputs
                              </th>
                            )}
                            {adjustableParams.length > 0 && (
                              <th
                                colSpan={adjustableParams.length}
                                className="text-left px-2 py-1 font-semibold"
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
                                colSpan={
                                  4 + adjustableInputs.length + adjustableParams.length || 5
                                }
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
                                      className="flex items-center gap-1 px-1.5 py-0.5 border rounded text-xs hover:bg-gray-50"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      View Log
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
                                    let pval = execution.bindings[param.id ?? ''] as string | null | undefined;
                                    if (pval == null) pval = paramDefaults[param.id ?? ''];
                                    if (typeof pval === 'string' && pval.startsWith('__region_geojson')) {
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
    </div>
  );
}
