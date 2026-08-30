/**
 * ThreadExpansionConfigure — General framing panel for a thread.
 *
 * 1:1 port of the legacy LitElement ThreadExpansionConfigure component.
 * Shows thread name, date range, region, and indicator (response variable).
 * Allows editing if the user has write permission.
 */
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/useAuth';
import { cn } from '@/lib/utils';

import {
  Thread,
  getUserPermission,
  useUpdateThreadMutation,
  useInsertThreadProvenanceMutation,
} from '@/graphql/generated/modeling';

import { ThreadExpansion, type ExpansionStatus } from './ThreadExpansion';

interface ThreadExpansionConfigureProps {
  thread: Thread;
  onUpdated?: () => void;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  return iso.split('T')[0] ?? iso;
}

export function ThreadExpansionConfigure({ thread, onUpdated }: ThreadExpansionConfigureProps) {
  const { user } = useAuth();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  const [name, setName] = useState(thread.name ?? '');
  const [startDate, setStartDate] = useState(fmtDate(thread.start_date));
  const [endDate, setEndDate] = useState(fmtDate(thread.end_date));
  const [regionId, setRegionId] = useState(thread.region_id ?? '');
  const [responseVarId, setResponseVarId] = useState(thread.response_variable_id ?? '');
  const [drivingVarId, setDrivingVarId] = useState(thread.driving_variable_id ?? '');

  // Sync form when thread changes (e.g. after save)
  useEffect(() => {
    setName(thread.name ?? '');
    setStartDate(fmtDate(thread.start_date));
    setEndDate(fmtDate(thread.end_date));
    setRegionId(thread.region_id ?? '');
    setResponseVarId(thread.response_variable_id ?? '');
    setDrivingVarId(thread.driving_variable_id ?? '');
  }, [thread]);

  const [updateThread] = useUpdateThreadMutation();
  const [insertProvenance] = useInsertThreadProvenanceMutation();

  function getStatus(): ExpansionStatus {
    if (!thread) return 'error';
    if (thread.name && thread.region_id) return 'done';
    return 'warning';
  }

  function getStatusInfo(): string {
    const status = getStatus();
    if (status === 'done')
      return `${thread.name} · ${fmtDate(thread.start_date)} – ${fmtDate(thread.end_date)}`;
    return 'Open to set general framing options';
  }

  async function handleSave() {
    if (!name.trim()) {
      throw new Error('Goal name is required');
    }
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date');
    }
    await updateThread({
      variables: {
        id: thread.id,
        name: name.trim() || null,
        startDate,
        endDate,
        regionId: regionId || null,
        drivingVariableId: drivingVarId || null,
        responseVariableId: responseVarId || null,
      },
    });
    if (user?.username) {
      await insertProvenance({
        variables: {
          threadId: thread.id,
          event: 'UPDATE',
          userid: user.username,
          notes: null,
        },
      });
    }
    onUpdated?.();
  }

  function handleCancel() {
    // Reset form to thread values
    setName(thread.name ?? '');
    setStartDate(fmtDate(thread.start_date));
    setEndDate(fmtDate(thread.end_date));
    setRegionId(thread.region_id ?? '');
    setResponseVarId(thread.response_variable_id ?? '');
    setDrivingVarId(thread.driving_variable_id ?? '');
  }

  const viewContent = (
    <table className="w-full text-sm" data-testid="configure-view">
      <tbody>
        <tr className="align-top">
          <td className="w-32 pb-1.5 font-semibold">Goal:</td>
          <td>{thread.name ?? ''}</td>
        </tr>
        <tr className="align-top">
          <td className="pb-1.5 font-semibold">Time Period:</td>
          <td>
            <span className="font-mono">{fmtDate(thread.start_date)}</span>
            {' to '}
            <span className="font-mono">{fmtDate(thread.end_date)}</span>
          </td>
        </tr>
        {thread.region_id && (
          <tr className="align-top">
            <td className="pb-1.5 font-semibold">Region:</td>
            <td className="text-gray-700">{thread.region_id}</td>
          </tr>
        )}
        {thread.response_variable_id && (
          <tr className="align-top">
            <td className="pb-1.5 font-semibold">Indicator:</td>
            <td className="text-gray-700">
              {thread.response_variable?.label ?? thread.response_variable_id}
            </td>
          </tr>
        )}
        {thread.driving_variable_id && (
          <tr className="align-top">
            <td className="pb-1.5 font-semibold">Driving Variable:</td>
            <td className="text-gray-700">
              {thread.driving_variable?.label ?? thread.driving_variable_id}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const editContent = (
    <form className="space-y-3 text-sm" data-testid="configure-edit-form">
      <div className="flex flex-col gap-1">
        <label htmlFor="thread-name" className="font-semibold">
          Goal:
        </label>
        <input
          id="thread-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Describe the goal of this sub-task"
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="thread-start" className="font-semibold">
            Start Date:
          </label>
          <input
            id="thread-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="mt-5 text-gray-400">to</span>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="thread-end" className="font-semibold">
            End Date:
          </label>
          <input
            id="thread-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="thread-region" className="font-semibold">
          Region ID:
        </label>
        <input
          id="thread-region"
          type="text"
          value={regionId}
          onChange={(e) => setRegionId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Region identifier"
        />
      </div>
      <div className={cn('flex flex-col gap-1')}>
        <label htmlFor="thread-indicator" className="font-semibold">
          Indicator (response variable):
        </label>
        <input
          id="thread-indicator"
          type="text"
          value={responseVarId}
          onChange={(e) => setResponseVarId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Response variable ID"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="thread-driving" className="font-semibold">
          Driving Variable:
        </label>
        <input
          id="thread-driving"
          type="text"
          value={drivingVarId}
          onChange={(e) => setDrivingVarId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Driving variable ID"
        />
      </div>
    </form>
  );

  return (
    <ThreadExpansion
      name="General framing"
      description="General framing for this sub-task. The constraints set here will filter the models and datasets available on the next step."
      status={getStatus()}
      statusInfo={getStatusInfo()}
      canEdit={perm.write}
      viewContent={viewContent}
      editContent={editContent}
      onSave={handleSave}
      onCancel={handleCancel}
      data-testid="thread-expansion-configure"
    />
  );
}
