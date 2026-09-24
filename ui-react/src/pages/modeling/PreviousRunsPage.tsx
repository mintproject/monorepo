import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchRunHistory,
  fetchRunHistoryDetail,
  type RunHistoryDetail,
  type RunHistorySummary,
} from '@/lib/ensemble-manager';

function dateValue(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function badge(status: string): string {
  const value = status.toLowerCase();
  if (value.includes('fail')) return 'bg-red-100 text-red-800';
  if (value.includes('success') || value.includes('complete')) return 'bg-green-100 text-green-800';
  if (value.includes('run') || value.includes('submit')) return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-700';
}

function json(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function Detail({ detail, api }: { detail: RunHistoryDetail; api: string }) {
  const section = (title: string, content: React.ReactNode) => (
    <details open className="rounded border bg-white">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">{title}</summary>
      <div className="border-t px-3 py-3 text-sm">{content}</div>
    </details>
  );
  return (
    <div className="space-y-3" data-testid="run-provenance-detail">
      <div className="rounded border bg-gray-50 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{detail.model.name || detail.model.id}</h2>
          <span className={'rounded px-2 py-0.5 text-xs ' + badge(detail.status)}>
            {detail.status}
          </span>
          <span className="text-xs text-gray-500">{detail.run_kind}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Started {dateValue(detail.started_at)} · source {detail.identity.source_id}
        </p>
        {detail.tapis_workflow?.workflow_id && (
          <p className="mt-1 text-xs text-blue-700">
            Tapis pipeline <code>{detail.tapis_workflow.workflow_id}</code> · run{' '}
            <code>{detail.tapis_workflow.run_id ?? 'not started'}</code>
          </p>
        )}
        {detail.warnings.map((warning) => (
          <p key={warning} className="mt-2 text-xs text-amber-700">
            {warning}
          </p>
        ))}
      </div>
      {section(
        'Inputs',
        detail.inputs.length ? (
          <ul className="space-y-1">
            {detail.inputs.map((item) => (
              <li key={item.model_io_id + ':' + item.resource_id}>
                <b>{item.model_io_id}</b> — {item.name || item.resource_id || 'Unknown resource'}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-gray-500">No input snapshot was recorded.</span>
        ),
      )}
      {section(
        'Parameters',
        detail.parameters.length ? (
          <ul className="space-y-1">
            {detail.parameters.map((item) => (
              <li key={item.parameter_id}>
                <b>{item.parameter_id}</b> — requested: {item.requested_value ?? '—'}; executed:{' '}
                {json(item.executed_value)}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-gray-500">No parameter snapshot was recorded.</span>
        ),
      )}
      {section(
        'Workflow pipeline',
        detail.workflow ? (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs">
            {json(detail.workflow)}
          </pre>
        ) : (
          <span className="text-gray-500">
            This legacy model job has no recorded workflow stages.
          </span>
        ),
      )}
      {section(
        'Outputs',
        detail.outputs.length ? (
          <ul className="space-y-1">
            {detail.outputs.map((item) => (
              <li key={item.model_io_id + ':' + item.resource_id}>
                <b>{item.model_io_id}</b> — {item.name || item.resource_id || 'Unknown resource'}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-gray-500">No output snapshot was recorded.</span>
        ),
      )}
      {section(
        'Logs and files',
        <>
          <ul className="space-y-2">
            {detail.artifacts.map((artifact) => (
              <li key={artifact.kind + ':' + artifact.source_id}>
                {artifact.endpoint ? (
                  <a
                    href={api + artifact.endpoint}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 underline"
                  >
                    {artifact.kind}
                  </a>
                ) : (
                  <span>{artifact.kind}</span>
                )}{' '}
                <span className="text-xs text-gray-500">({artifact.availability})</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            Application logs and workflow provenance remain separate records.
          </p>
        </>,
      )}
      {section(
        'Errors and status observations',
        <>
          {detail.errors.length ? (
            <ul className="space-y-1 text-red-700">
              {detail.errors.map((item) => (
                <li key={item.source + ':' + item.message}>
                  {item.code ? item.code + ': ' : ''}
                  {item.message}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-gray-500">No error was recorded.</span>
          )}
          <ul className="mt-2 space-y-1 text-xs text-gray-500">
            {detail.status_history.map((item) => (
              <li key={item.source + ':' + item.status + ':' + item.observed_at}>
                {item.status} observed {dateValue(item.observed_at)} ({item.source})
              </li>
            ))}
          </ul>
        </>,
      )}
    </div>
  );
}

export function PreviousRunsPage() {
  const { id: threadId } = useParams<{ id: string }>();
  const api = window.__MINT_CONFIG__?.ENSEMBLE_MANAGER_API ?? '';
  const [runs, setRuns] = useState<RunHistorySummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunHistoryDetail | null>(null);
  const [source, setSource] = useState('all');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!threadId) return;
    const controller = new AbortController();
    setLoading(true);
    void fetchRunHistory(api, threadId, { limit: 25 }, controller.signal)
      .then((response) => {
        setRuns(response.runs);
        setNextCursor(response.next_cursor);
        setSelected(response.runs[0]?.run_key ?? null);
      })
      .catch((reason: unknown) => {
        if ((reason as Error).name !== 'AbortError')
          setError(reason instanceof Error ? reason.message : 'Unable to load previous runs');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [api, threadId]);

  useEffect(() => {
    if (!threadId || !selected) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    void fetchRunHistoryDetail(api, threadId, selected, controller.signal)
      .then(setDetail)
      .catch((reason: unknown) => {
        if ((reason as Error).name !== 'AbortError')
          setError(reason instanceof Error ? reason.message : 'Unable to load provenance');
      })
      .finally(() => setDetailLoading(false));
    return () => controller.abort();
  }, [api, selected, threadId]);

  const visible = useMemo(
    () =>
      runs.filter(
        (run) =>
          (source === 'all' || run.source === source) &&
          (!status || run.status.toLowerCase().includes(status.toLowerCase())),
      ),
    [runs, source, status],
  );

  async function loadMore() {
    if (!threadId || !nextCursor) return;
    try {
      const response = await fetchRunHistory(api, threadId, { limit: 25, cursor: nextCursor });
      setRuns((current) => current.concat(response.runs));
      setNextCursor(response.next_cursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load more runs');
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading previous runs…</div>;
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6" data-testid="previous-runs-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to={'/modeling/thread/' + encodeURIComponent(threadId ?? '')}
            className="text-sm text-blue-700"
          >
            ← Back to run monitor
          </Link>
          <h1 className="mt-2 text-xl font-semibold">Previous runs &amp; provenance</h1>
          <p className="text-sm text-gray-600">
            Server-recorded inputs, parameters, workflow stages, outputs, logs, and errors.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="rounded border px-2 py-1 text-sm"
            aria-label="Filter run source"
          >
            <option value="all">All sources</option>
            <option value="workflow">Workflow</option>
            <option value="legacy_execution">Legacy jobs</option>
          </select>
          <input
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="Filter status"
            className="w-32 rounded border px-2 py-1 text-sm"
            aria-label="Filter run status"
          />
        </div>
      </div>
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {runs.length === 0 ? (
        <div className="rounded border border-dashed px-4 py-10 text-center text-sm text-gray-500">
          No recorded runs are available for this subtask.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(18rem,24rem)_1fr]">
          <section className="space-y-2" aria-label="Previous runs">
            {visible.length === 0 ? (
              <div className="rounded border px-3 py-5 text-sm text-gray-500">
                No runs match the current filters.
              </div>
            ) : (
              visible.map((run) => (
                <button
                  type="button"
                  key={run.run_key}
                  onClick={() => setSelected(run.run_key)}
                  className={
                    'w-full rounded border px-3 py-3 text-left ' +
                    (selected === run.run_key ? 'border-blue-500 bg-blue-50' : 'bg-white')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{run.model_name || run.model_id}</span>
                    <span className={'rounded px-2 py-0.5 text-xs ' + badge(run.status)}>
                      {run.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {run.source === 'workflow' ? 'Workflow pipeline' : 'Legacy model job'} ·{' '}
                    {dateValue(run.effective_started_at)}
                  </div>
                  {run.provenance_completeness !== 'complete' && (
                    <div className="mt-1 text-xs text-amber-700">
                      Provenance {run.provenance_completeness}
                    </div>
                  )}
                </button>
              ))
            )}
            {nextCursor && (
              <button
                type="button"
                onClick={() => void loadMore()}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                Load more
              </button>
            )}
          </section>
          <section>
            {detailLoading ? (
              <div className="rounded border px-4 py-8 text-sm text-gray-500">
                Loading provenance…
              </div>
            ) : detail ? (
              <Detail detail={detail} api={api} />
            ) : (
              <div className="rounded border px-4 py-8 text-sm text-gray-500">
                Select a run to inspect its provenance.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
