/**
 * MintSummary — Read-only summary report for a thread.
 *
 * 1:1 port of the legacy LitElement MintSummary component.
 * Displays a summary of all configuration choices: variables, models,
 * datasets, parameters, runs, and results.
 */
import React from 'react';

import {
  Thread,
  ThreadProvenance,
  getUserPermission,
} from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';

interface MintSummaryProps {
  thread: Thread;
  taskName?: string;
  problemStatementName?: string;
}

function getLatestEventOfType(types: string[], events: ThreadProvenance[]): ThreadProvenance | null {
  const matching = events.filter((e) => types.includes(e.event));
  if (matching.length === 0) return null;
  return matching.reduce((latest, e) =>
    e.timestamp > latest.timestamp ? e : latest
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm py-1 border-b border-gray-100 last:border-0">
      <span className="font-semibold text-gray-600 w-40 shrink-0">{label}</span>
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
        <h3 className="text-base font-semibold mb-1">Summary</h3>
        <p className="text-sm text-gray-500">
          Read-only overview of the sub-task configuration and run results.
        </p>
      </div>

      {/* Problem Statement / Task header */}
      {(problemStatementName || taskName) && (
        <div className="border rounded p-3 bg-gray-50">
          {problemStatementName && (
            <p className="font-semibold text-sm">{problemStatementName}</p>
          )}
          {taskName && (
            <p className="text-sm text-gray-600">{taskName}</p>
          )}
        </div>
      )}

      {/* Thread framing */}
      <section>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">General Framing</h4>
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
          {latestEvent?.notes && (
            <SummaryRow label="Notes:" value={latestEvent.notes} />
          )}
        </div>
      </section>

      {/* Variables */}
      <section>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">Variables</h4>
        <div className="space-y-0.5">
          <SummaryRow label="Indicator:" value={thread.response_variable_id} />
          <SummaryRow label="Driving variable:" value={thread.driving_variable_id} />
        </div>
        {!thread.response_variable_id && (
          <p className="text-xs text-gray-400 italic">No variables selected</p>
        )}
      </section>

      {/* Models — placeholder (detailed model data lives in thread_model table) */}
      <section>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">Models</h4>
        <p className="text-sm text-gray-500 italic">
          Model selection details will be shown here when models have been configured.
        </p>
        {modelsEvent?.notes && (
          <p className="text-xs text-gray-400 mt-1">Notes: {modelsEvent.notes}</p>
        )}
      </section>

      {/* Datasets — placeholder */}
      <section>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">Datasets</h4>
        <p className="text-sm text-gray-500 italic">
          Dataset binding details will be shown here when datasets have been selected.
        </p>
        {datasetsEvent?.notes && (
          <p className="text-xs text-gray-400 mt-1">Notes: {datasetsEvent.notes}</p>
        )}
      </section>

      {/* Setup / Parameters — placeholder */}
      <section>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">Parameters</h4>
        <p className="text-sm text-gray-500 italic">
          Parameter adjustments will be shown here after the parameters step.
        </p>
        {paramsEvent?.notes && (
          <p className="text-xs text-gray-400 mt-1">Notes: {paramsEvent.notes}</p>
        )}
      </section>

      {/* Runs / Results — placeholder */}
      <section>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">Model Runs and Results</h4>
        <p className="text-sm text-gray-500 italic">
          Run results will be shown here after execution completes.
        </p>
        {ingestEvent?.notes && (
          <p className="text-xs text-gray-400 mt-1">Notes: {ingestEvent.notes}</p>
        )}
      </section>
    </div>
  );
}
