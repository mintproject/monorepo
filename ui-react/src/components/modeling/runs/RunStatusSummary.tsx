import type { ReactNode } from 'react';

import {
  displayStatusLabel,
  formatDateValue,
  statusPillClasses,
  type RunDisplayStatus,
} from '@/lib/modeling/run-status';

interface RunStatusSummaryProps {
  modelName: string;
  status: RunDisplayStatus;
  totalRuns: number;
  submittedRuns: number;
  successfulRuns: number;
  failedRuns: number;
  runningRuns: number;
  pendingRuns: number;
  startedAt?: string | null;
  nextAction: string;
  actions?: ReactNode;
  context?: ReactNode;
}

export function RunStatusSummary({
  modelName,
  status,
  totalRuns,
  submittedRuns,
  successfulRuns,
  failedRuns,
  runningRuns,
  pendingRuns,
  startedAt,
  nextAction,
  actions,
  context,
}: RunStatusSummaryProps) {
  return (
    <section
      className="rounded border border-gray-200 bg-gray-50 p-3"
      aria-label={`${modelName} run status`}
      data-testid="run-status-summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-gray-900">{modelName}</h4>
            <span className={`rounded px-2 py-0.5 text-xs ${statusPillClasses(status)}`}>
              {displayStatusLabel(status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-700">{nextAction}</p>
          {startedAt && (
            <p className="mt-1 text-xs text-gray-500">Started {formatDateValue(startedAt)}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {context && <div className="mt-3">{context}</div>}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
        <div>
          <dt className="text-gray-500">Runs</dt>
          <dd className="font-semibold text-gray-900">{totalRuns}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Submitted</dt>
          <dd className="font-semibold text-gray-900">{submittedRuns}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Completed</dt>
          <dd className="font-semibold text-green-700">{successfulRuns}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Failed</dt>
          <dd className={`font-semibold ${failedRuns > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {failedRuns}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Waiting / running</dt>
          <dd className="font-semibold text-gray-900">
            {pendingRuns} / {runningRuns}
          </dd>
        </div>
      </dl>
    </section>
  );
}
