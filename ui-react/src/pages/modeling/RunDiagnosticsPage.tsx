import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchRunHistoryDetail, type RunHistoryDetail } from '@/lib/ensemble-manager';
import { RunProvenanceDetail } from './PreviousRunsPage';

function json(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function RunDiagnosticsPage() {
  const { threadId, runKey } = useParams<{ threadId: string; runKey: string }>();
  const api = window.__MINT_CONFIG__?.ENSEMBLE_MANAGER_API ?? '';
  const [detail, setDetail] = useState<RunHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!threadId || !runKey) {
      setError('A thread and run key are required.');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchRunHistoryDetail(api, threadId, runKey, controller.signal)
      .then(setDetail)
      .catch((reason: unknown) => {
        if ((reason as Error).name !== 'AbortError') {
          setError(reason instanceof Error ? reason.message : 'Unable to load run diagnostics');
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [api, runKey, threadId]);

  if (loading)
    return <div className="p-6 text-sm text-gray-600">Loading technical diagnostics…</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6" data-testid="run-diagnostics-page">
      <div>
        <Link
          to={`/modeling/thread/${encodeURIComponent(threadId ?? '')}/runs`}
          className="text-sm text-blue-700"
        >
          ← Back to run history
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Technical diagnostics</h1>
        <p className="text-sm text-gray-600">
          Provider identifiers, workflow evidence, raw provenance, and artifact availability for
          this authorized run.
        </p>
      </div>
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {detail && (
        <>
          <RunProvenanceDetail detail={detail} api={api} technical />
          <section className="space-y-3" aria-label="Raw diagnostic payloads">
            <details open className="rounded border bg-white">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                Raw workflow payload
              </summary>
              <pre className="max-h-[32rem] overflow-auto border-t p-3 text-xs">
                {json(detail.workflow)}
              </pre>
            </details>
            <details className="rounded border bg-white">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                Raw run summary
              </summary>
              <pre className="max-h-[32rem] overflow-auto border-t p-3 text-xs">
                {json({
                  run_key: detail.run_key,
                  source: detail.source,
                  run_kind: detail.run_kind,
                  status: detail.status,
                  provenance_completeness: detail.provenance_completeness,
                  warnings: detail.warnings,
                  tapis_workflow: detail.tapis_workflow,
                  identity: detail.identity,
                })}
              </pre>
            </details>
          </section>
        </>
      )}
    </div>
  );
}
