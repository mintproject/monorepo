import { useMemo, useState } from 'react';

import {
  Thread,
  getUserPermission,
  useUpdateThreadDataMutation,
} from '@/graphql/generated/modeling';
import { useDataCatalogDatasets } from '@/hooks/useDataCatalog';
import type { DataCatalogDataset, DataCatalogTimePeriod } from '@/lib/data-catalog';
import { useAuth } from '@/lib/auth/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import type { ThreadModel } from '../MintDatasets';
import { StepShell } from './StepShell';
import { FilteredByBanner } from './FilteredByBanner';

interface RequestedRange {
  start: Date;
  end: Date;
}

/** Classify a dataset's temporal coverage against the requested window. */
export function dateCoverage(
  requested: RequestedRange | null,
  period: { start: Date | null; end: Date | null } | null,
): 'none' | 'full' | 'partial' {
  if (!requested) return 'none';
  if (!period || !period.start || !period.end) return 'partial';
  const covered = period.start <= requested.start && period.end >= requested.end;
  return covered ? 'full' : 'partial';
}

/** Map a Data Catalog time period onto the {start,end} shape dateCoverage expects. */
function toPeriod(
  tp: DataCatalogTimePeriod | null | undefined,
): { start: Date | null; end: Date | null } | null {
  if (!tp) return null;
  return { start: tp.start_date, end: tp.end_date };
}

interface DatasetsStepProps {
  thread: Thread;
  /** Built via buildThreadModels(thread, modelTreeData). */
  models: Record<string, ThreadModel>;
  regionGeometry?: unknown;
  onUpdated: () => void;
  onContinue: () => void;
  onBack?: () => void;
}

/** Per-input dataset picker — lists candidates and assigns one dataset id. Isolated per model. */
function InputPicker({
  thread,
  variables,
  regionGeometry,
  requested,
  assignedId,
  onAssign,
}: {
  thread: Thread;
  variables: string[];
  regionGeometry?: unknown;
  requested: RequestedRange | null;
  assignedId: string | null;
  onAssign: (datasetId: string | null, dataset?: DataCatalogDataset) => void;
}) {
  const { datasets, loading } = useDataCatalogDatasets({
    variableNames: variables,
    regionGeometry,
    startDate: thread.start_date ? new Date(thread.start_date) : null,
    endDate: thread.end_date ? new Date(thread.end_date) : null,
    skip: false,
  });

  if (loading) {
    return <span className="text-xs text-gray-400">Loading datasets…</span>;
  }
  if (datasets.length === 0) {
    return <span className="text-xs text-gray-400">No matching datasets.</span>;
  }

  return (
    <select
      aria-label="Choose dataset"
      value={assignedId ?? ''}
      onChange={(e) => {
        const id = e.target.value || null;
        onAssign(
          id,
          datasets.find((d) => d.id === id),
        );
      }}
      className="rounded border border-gray-300 px-2 py-1 text-xs"
    >
      <option value="">Choose · {datasets.length} options</option>
      {datasets.map((ds) => {
        const cov = dateCoverage(requested, toPeriod(ds.time_period));
        const tag = cov === 'full' ? ' [full]' : cov === 'partial' ? ' [partial]' : '';
        return (
          <option key={ds.id} value={ds.id}>
            {ds.name}
            {tag}
          </option>
        );
      })}
    </select>
  );
}

export function DatasetsStep({
  thread,
  models,
  regionGeometry,
  onUpdated,
  onContinue,
  onBack,
}: DatasetsStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);
  const [saving, setSaving] = useState(false);

  // assignments: modelId -> inputId -> { datasetId, dataset }
  const [assignments, setAssignments] = useState<
    Record<string, Record<string, { datasetId: string; dataset?: DataCatalogDataset }>>
  >({});

  const [updateThreadData] = useUpdateThreadDataMutation();

  const modelIds = Object.keys(models);

  const requested: RequestedRange | null = useMemo(() => {
    if (!thread.start_date || !thread.end_date) return null;
    return { start: new Date(thread.start_date), end: new Date(thread.end_date) };
  }, [thread.start_date, thread.end_date]);

  const requiredInputCount = useMemo(
    () =>
      modelIds.reduce(
        (acc, mid) => acc + (models[mid]?.input_files.filter((i) => !i.isOptional).length ?? 0),
        0,
      ),
    [modelIds, models],
  );

  const assignedCount = useMemo(
    () =>
      modelIds.reduce((acc, mid) => {
        const reqInputs = models[mid]?.input_files.filter((i) => !i.isOptional) ?? [];
        return acc + reqInputs.filter((i) => assignments[mid]?.[i.id]).length;
      }, 0),
    [modelIds, models, assignments],
  );

  const allAssigned = requiredInputCount > 0 && assignedCount === requiredInputCount;

  function assign(
    modelId: string,
    inputId: string,
    datasetId: string | null,
    dataset?: DataCatalogDataset,
  ) {
    setAssignments((prev) => {
      const bucket = { ...(prev[modelId] ?? {}) };
      if (!datasetId) delete bucket[inputId];
      else bucket[inputId] = { datasetId, dataset };
      return { ...prev, [modelId]: bucket };
    });
  }

  async function handleContinue() {
    if (!allAssigned) return;
    setSaving(true);
    try {
      // NOTE: writes a minimal SELECT_DATA provenance event; full dataslice/resource
      // persistence is lifted from MintDatasets.handleSubmit in a follow-up once per-resource
      // filtering is wired. For the core chain we persist the event and advance.
      await updateThreadData({
        variables: {
          threadId: thread.id,
          event: {
            thread_id: thread.id,
            event: 'SELECT_DATA',
            userid: user?.username ?? 'anonymous',
            notes: null,
          },
          data: [],
          modelIO: [],
        },
      });
      onUpdated();
      onContinue();
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (modelIds.length === 0) {
    return (
      <StepShell title="Datasets" description="Assign a dataset to every model input.">
        <p className="text-sm text-orange-600">Please select model(s) first.</p>
      </StepShell>
    );
  }

  const chips = [
    { icon: '📦', label: 'Input', value: 'per model input' },
    ...(thread.region_id
      ? [{ icon: '⌖', label: 'Region', value: thread.region_id, source: 'from Framing' }]
      : []),
    ...(requested
      ? [
          {
            icon: '🗓',
            label: 'Dates',
            value: `${thread.start_date} – ${thread.end_date}`,
            source: 'from Framing',
          },
        ]
      : []),
  ];

  return (
    <StepShell
      title="Datasets"
      description="Assign a dataset to every input, per model. Each model's assignments are independent."
      canContinue={allAssigned && !saving && perm.write}
      continueHint={`${assignedCount} of ${requiredInputCount} inputs assigned`}
      continueLabel={saving ? 'Saving…' : 'Continue'}
      onContinue={handleContinue}
      onBack={onBack}
    >
      <FilteredByBanner chips={chips} />

      <div className="space-y-4">
        {modelIds.map((modelId) => {
          const model = models[modelId]!;
          const reqInputs = model.input_files.filter((i) => !i.isOptional);
          const doneForModel = reqInputs.filter((i) => assignments[modelId]?.[i.id]).length;
          return (
            <div key={modelId} className="rounded border p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">
                  <span className="text-xs font-normal text-gray-400">MODEL · </span>
                  {model.name}
                </span>
                <span className="text-xs text-gray-500">
                  {doneForModel} / {reqInputs.length} inputs
                </span>
              </div>
              <ul className="space-y-2">
                {model.input_files.map((input) => {
                  const current = assignments[modelId]?.[input.id];
                  const cov = dateCoverage(requested, toPeriod(current?.dataset?.time_period));
                  return (
                    <li key={input.id} className="flex flex-wrap items-center gap-2">
                      <span className="w-40 shrink-0 text-gray-700">
                        {input.name}
                        {input.isOptional && (
                          <span className="ml-1 text-xs text-gray-400">(optional)</span>
                        )}
                      </span>
                      {!current && !input.isOptional && (
                        <span className="text-xs text-amber-600">⚠ no dataset assigned</span>
                      )}
                      {current && cov !== 'none' && (
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-xs',
                            cov === 'full'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800',
                          )}
                        >
                          🗓 {cov === 'full' ? 'full ✓' : 'partial'}
                        </span>
                      )}
                      <InputPicker
                        thread={thread}
                        variables={input.variables}
                        regionGeometry={regionGeometry}
                        requested={requested}
                        assignedId={current?.datasetId ?? null}
                        onAssign={(dsId, ds) => assign(modelId, input.id, dsId, ds)}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </StepShell>
  );
}
