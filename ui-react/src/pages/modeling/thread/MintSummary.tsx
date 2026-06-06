/**
 * MintSummary — Read-only summary report for a thread.
 *
 * 1:1 port of the legacy LitElement MintSummary component.
 * Displays a summary of all configuration choices: variables, models,
 * datasets, parameters, runs, and results.
 */
import React from 'react';

import { Thread, ThreadProvenance, getUserPermission } from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';

interface MintSummaryProps {
  thread: Thread;
  taskName?: string;
  problemStatementName?: string;
}

function getLatestEventOfType(
  types: string[],
  events: ThreadProvenance[],
): ThreadProvenance | null {
  const matching = events.filter((e) => types.includes(e.event));
  if (matching.length === 0) return null;
  return matching.reduce((latest, e) => (e.timestamp > latest.timestamp ? e : latest));
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 border-b border-gray-100 py-1 text-sm last:border-0">
      <span className="w-40 shrink-0 font-semibold text-gray-600">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

export function MintSummary({ thread, taskName, problemStatementName }: MintSummaryProps) {
  const { user } = useAuth();
  // perm is available for future use (e.g. edit controls)
  getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  const createEvent = getLatestEventOfType(['CREATE'], thread.events);
  const updateEvent = getLatestEventOfType(['UPDATE'], thread.events);
  const latestEvent = updateEvent ?? createEvent;

  const modelsEvent = getLatestEventOfType(['SELECT_MODELS'], thread.events);
  const datasetsEvent = getLatestEventOfType(['SELECT_DATA'], thread.events);
  const paramsEvent = getLatestEventOfType(['SELECT_PARAMETERS'], thread.events);
  const ingestEvent = getLatestEventOfType(['INGEST'], thread.events);

  return (
    <div data-testid="mint-summary" className="space-y-6">
      <div>
        <h3 className="mb-1 text-base font-semibold">Summary</h3>
        <p className="text-sm text-gray-500">
          Read-only overview of the sub-task configuration and run results.
        </p>
      </div>

      {/* Problem Statement / Task header */}
      {(problemStatementName || taskName) && (
        <div className="rounded border bg-gray-50 p-3">
          {problemStatementName && <p className="text-sm font-semibold">{problemStatementName}</p>}
          {taskName && <p className="text-sm text-gray-600">{taskName}</p>}
        </div>
      )}

      {/* Thread framing */}
      <section>
        <h4 className="mb-2 border-b pb-1 text-sm font-semibold text-gray-700">General Framing</h4>
        <div className="space-y-0.5">
          <SummaryRow label="Sub-task goal:" value={thread.name} />
          <SummaryRow
            label="Time period:"
            value={
              thread.start_date
                ? `${thread.start_date.split('T')[0]} – ${thread.end_date.split('T')[0]}`
                : undefined
            }
          />
          <SummaryRow label="Region:" value={thread.region_id} />
          {latestEvent?.notes && <SummaryRow label="Notes:" value={latestEvent.notes} />}
        </div>
      </section>

      {/* Variables */}
      <section>
        <h4 className="mb-2 border-b pb-1 text-sm font-semibold text-gray-700">Variables</h4>
        <div className="space-y-0.5">
          <SummaryRow label="Indicator:" value={thread.response_variable_id} />
          <SummaryRow label="Driving variable:" value={thread.driving_variable_id} />
        </div>
        {!thread.response_variable_id && (
          <p className="text-xs italic text-gray-400">No variables selected</p>
        )}
      </section>

      {/* Models — placeholder (detailed model data lives in thread_model table) */}
      <section>
        <h4 className="mb-2 border-b pb-1 text-sm font-semibold text-gray-700">Models</h4>
        <p className="text-sm italic text-gray-500">
          Model selection details will be shown here when models have been configured.
        </p>
        {modelsEvent?.notes && (
          <p className="mt-1 text-xs text-gray-400">Notes: {modelsEvent.notes}</p>
        )}
      </section>

      {/* Datasets — placeholder */}
      <section>
        <h4 className="mb-2 border-b pb-1 text-sm font-semibold text-gray-700">Datasets</h4>
        <p className="text-sm italic text-gray-500">
          Dataset binding details will be shown here when datasets have been selected.
        </p>
        {datasetsEvent?.notes && (
          <p className="mt-1 text-xs text-gray-400">Notes: {datasetsEvent.notes}</p>
        )}
      </section>

      {/* Setup / Parameters — placeholder */}
      <section>
        <h4 className="mb-2 border-b pb-1 text-sm font-semibold text-gray-700">Parameters</h4>
        <p className="text-sm italic text-gray-500">
          Parameter adjustments will be shown here after the parameters step.
        </p>
        {paramsEvent?.notes && (
          <p className="mt-1 text-xs text-gray-400">Notes: {paramsEvent.notes}</p>
        )}
      </section>

      {/* Runs / Results — placeholder */}
      <section>
        <h4 className="mb-2 border-b pb-1 text-sm font-semibold text-gray-700">
          Model Runs and Results
        </h4>
        <p className="text-sm italic text-gray-500">
          Run results will be shown here after execution completes.
        </p>
        {ingestEvent?.notes && (
          <p className="mt-1 text-xs text-gray-400">Notes: {ingestEvent.notes}</p>
        )}
      </section>
    </div>
  );
}
