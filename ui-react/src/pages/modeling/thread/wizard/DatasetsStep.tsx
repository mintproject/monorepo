import { useMemo, useState } from 'react';

import {
  Thread,
  getUserPermission,
  useUpdateThreadDataMutation,
} from '@/graphql/generated/modeling';
import type {
  ModelEnsembleMap,
  ThreadExecutionData,
  ThreadModel,
} from '@/graphql/generated/execution';
import { useDataCatalogDatasets } from '@/hooks/useDataCatalog';
import type {
  DataCatalogDataset,
  DataCatalogResource,
  DataCatalogTimePeriod,
} from '@/lib/data-catalog';
import { loadDatasetResources } from '@/lib/data-catalog';
import {
  buildThreadDataInsert,
  newDatasliceId,
  type ThreadDataInsert,
} from '@/lib/thread-datasets';
import { useAuth } from '@/lib/auth/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { StepShell } from './StepShell';
import { FilteredByBanner } from './FilteredByBanner';

interface RequestedRange {
  start: Date;
  end: Date;
}

/**
 * A dataset bound to one model input.
 *
 * `resources` is present when the binding was read back from Hasura — the
 * dataslice already holds the exact files that were bound, so re-saving it does
 * not have to ask the catalog again. A freshly picked dataset leaves it unset
 * and the files are fetched at save time.
 */
interface Assignment {
  datasetId: string;
  datasetName: string;
  timePeriod?: DataCatalogTimePeriod | null;
  resources?: DataCatalogResource[];
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

/**
 * Bindings already written for this thread, as the assignment map the step
 * renders: model id -> input id -> the dataset behind the bound dataslice.
 */
export function assignmentsFromBindings(
  ensembles: ModelEnsembleMap,
  data: ThreadExecutionData['data'],
): Record<string, Record<string, Assignment>> {
  const out: Record<string, Record<string, Assignment>> = {};
  for (const [modelId, ensemble] of Object.entries(ensembles ?? {})) {
    for (const [inputId, sliceIds] of Object.entries(ensemble.bindings ?? {})) {
      const slice = data?.[sliceIds[0] ?? ''];
      // A parameter binding shares this map and has no dataslice behind it.
      if (!slice) continue;
      const dataset = slice['dataset'] as { id: string; name: string } | undefined;
      if (!dataset) continue;
      (out[modelId] ??= {})[inputId] = {
        datasetId: dataset.id,
        datasetName: dataset.name,
        resources: (slice['resources'] as DataCatalogResource[] | undefined) ?? [],
      };
    }
  }
  return out;
}

interface DatasetsStepProps {
  thread: Thread;
  /** Selected models, keyed by configuration id (from the thread execution query). */
  models: Record<string, ThreadModel>;
  /** Existing bindings, keyed the same way — supplies each model's thread_model id. */
  ensembles: ModelEnsembleMap;
  /** Dataslices already persisted for this thread, keyed by dataslice id. */
  persistedData: ThreadExecutionData['data'];
  regionGeometry?: unknown;
  onUpdated: () => void | Promise<void>;
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
  ensembles,
  persistedData,
  regionGeometry,
  onUpdated,
  onContinue,
  onBack,
}: DatasetsStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);
  const [saving, setSaving] = useState(false);

  // What the database already holds. Recomputed whenever the thread execution
  // query refetches, so a save is reflected without remounting the step.
  const persisted = useMemo(
    () => assignmentsFromBindings(ensembles, persistedData),
    [ensembles, persistedData],
  );

  // Edits made in this session. `null` is a deliberate clear, which is why the
  // lookup below tests for `undefined` rather than falsiness.
  const [overrides, setOverrides] = useState<Record<string, Record<string, Assignment | null>>>({});

  const [updateThreadData] = useUpdateThreadDataMutation();

  const modelIds = Object.keys(models);

  function assignmentFor(modelId: string, inputId: string): Assignment | null {
    const override = overrides[modelId]?.[inputId];
    if (override !== undefined) return override;
    return persisted[modelId]?.[inputId] ?? null;
  }

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

  const assignedCount = modelIds.reduce((acc, mid) => {
    const reqInputs = models[mid]?.input_files.filter((i) => !i.isOptional) ?? [];
    return acc + reqInputs.filter((i) => assignmentFor(mid, i.id)).length;
  }, 0);

  const allAssigned = requiredInputCount > 0 && assignedCount === requiredInputCount;

  function assign(
    modelId: string,
    inputId: string,
    datasetId: string | null,
    dataset?: DataCatalogDataset,
  ) {
    setOverrides((prev) => {
      const bucket = { ...(prev[modelId] ?? {}) };
      bucket[inputId] =
        datasetId && dataset
          ? { datasetId, datasetName: dataset.name, timePeriod: dataset.time_period }
          : null;
      return { ...prev, [modelId]: bucket };
    });
  }

  async function handleContinue() {
    if (!allAssigned) return;
    setSaving(true);
    try {
      const data: ThreadDataInsert[] = [];
      const modelIO: Array<{
        thread_model_id: string;
        model_io_id: string;
        dataslice_id: string;
      }> = [];

      for (const modelId of modelIds) {
        const model = models[modelId];
        // The thread_model row id, not the configuration id — thread_model_io
        // is keyed by the former.
        const threadModelId = ensembles[modelId]?.id;
        if (!model || !threadModelId) continue;

        for (const input of model.input_files) {
          const assignment = assignmentFor(modelId, input.id);
          if (!assignment) continue;

          // The mutation drops every dataslice for the thread before inserting,
          // so a binding that is being carried over has to be rebuilt too. A
          // binding read back from Hasura already carries its files; a freshly
          // picked dataset does not, and the catalog only narrows resources to
          // the input's variables on demand.
          const resources =
            assignment.resources ??
            (await loadDatasetResources({
              datasetId: assignment.datasetId,
              variableNames: input.variables ?? [],
            }));

          if (resources.length === 0) {
            toast({
              title: `No matching files in ${assignment.datasetName}`,
              description: `Nothing in this dataset carries ${(input.variables ?? []).join(', ') || 'the input variable'}.`,
              variant: 'destructive',
            });
            setSaving(false);
            return;
          }

          const datasliceId = newDatasliceId();
          data.push(
            buildThreadDataInsert({
              threadId: thread.id,
              threadName: thread.name,
              regionId: thread.region_id,
              startDate: thread.start_date,
              endDate: thread.end_date,
              datasliceId,
              dataset: { id: assignment.datasetId, name: assignment.datasetName },
              resources,
            }),
          );
          modelIO.push({
            thread_model_id: threadModelId,
            model_io_id: input.id,
            dataslice_id: datasliceId,
          });
        }
      }

      await updateThreadData({
        variables: {
          threadId: thread.id,
          event: {
            thread_id: thread.id,
            event: 'SELECT_DATA',
            userid: user?.username ?? 'anonymous',
            notes: null,
          },
          data,
          modelIO,
        },
      });
      setOverrides({});
      await onUpdated();
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
          const doneForModel = reqInputs.filter((i) => assignmentFor(modelId, i.id)).length;
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
                  const current = assignmentFor(modelId, input.id);
                  const cov = dateCoverage(requested, toPeriod(current?.timePeriod));
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
                        variables={input.variables ?? []}
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
