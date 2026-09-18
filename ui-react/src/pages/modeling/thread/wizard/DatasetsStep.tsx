import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

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

export type DateCoverage = 'none' | 'full' | 'partial' | 'outside' | 'unknown';
type CoverageFilter = Exclude<DateCoverage, 'none'> | 'all';

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
): DateCoverage {
  if (!requested) return 'none';
  const start = validDate(period?.start);
  const end = validDate(period?.end);
  if (!start && !end) return 'unknown';

  // Bounds are inclusive: a dataset ending on the model start date overlaps it.
  if (end && end < requested.start) return 'outside';
  if (start && start > requested.end) return 'outside';
  if (!start || !end) return 'unknown';

  const covered = start <= requested.start && end >= requested.end;
  return covered ? 'full' : 'partial';
}

function validDate(value: Date | null | undefined): Date | null {
  return value && !Number.isNaN(value.getTime()) ? value : null;
}

/** Map a Data Catalog time period onto the {start,end} shape dateCoverage expects. */
function toPeriod(
  tp: DataCatalogTimePeriod | null | undefined,
): { start: Date | null; end: Date | null } | null {
  if (!tp) return null;
  return { start: tp.start_date, end: tp.end_date };
}

function coverageForDataset(
  ds: Pick<DataCatalogDataset, 'time_period'>,
  requested: RequestedRange | null,
): DateCoverage {
  return dateCoverage(requested, toPeriod(ds.time_period));
}

function coverageLabel(coverage: DateCoverage): string {
  switch (coverage) {
    case 'full':
      return 'Full coverage';
    case 'partial':
      return 'Partial overlap';
    case 'outside':
      return 'Outside model window';
    case 'unknown':
      return 'No declared dates';
    default:
      return 'Target dates unavailable';
  }
}

function periodLabel(period: DataCatalogTimePeriod | null | undefined): string {
  const start = validDate(period?.start_date);
  const end = validDate(period?.end_date);
  if (!start && !end) return 'No declared dates';
  return `${start ? start.getUTCFullYear() : 'Open'} – ${end ? end.getUTCFullYear() : 'Open'}`;
}

function datasetMatchesSearch(dataset: DataCatalogDataset, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    dataset.name,
    dataset.description,
    dataset.version,
    dataset.source.name,
    dataset.datatype,
    ...dataset.variables,
    ...(dataset.categories ?? []),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function coverageMatchesFilter(coverage: DateCoverage, filter: CoverageFilter): boolean {
  return filter === 'all' || coverage === filter;
}

function timelineDomain(
  datasets: DataCatalogDataset[],
  requested: RequestedRange | null,
): { start: number; end: number } {
  const dates = datasets.flatMap((dataset) => {
    const start = validDate(dataset.time_period?.start_date)?.getTime();
    const end = validDate(dataset.time_period?.end_date)?.getTime();
    return [start, end].filter((value): value is number => value !== undefined);
  });
  if (requested) dates.push(requested.start.getTime(), requested.end.getTime());

  const start = Math.min(...dates);
  const end = Math.max(...dates);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    const year = new Date().getUTCFullYear();
    return { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) };
  }
  if (start === end) return { start, end: end + 24 * 60 * 60 * 1000 };
  return { start, end };
}

function timelinePercent(value: number, domain: { start: number; end: number }): number {
  return Math.max(0, Math.min(100, ((value - domain.start) / (domain.end - domain.start)) * 100));
}

function timelineTicks(domain: { start: number; end: number }): number[] {
  const startYear = new Date(domain.start).getUTCFullYear();
  const endYear = new Date(domain.end).getUTCFullYear();
  const span = Math.max(1, endYear - startYear);
  const step = span > 20 ? 5 : span > 10 ? 2 : 1;
  const ticks: number[] = [];
  for (let year = startYear; year <= endYear; year += step) {
    ticks.push(Date.UTC(year, 0, 1));
  }
  return ticks;
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
  /** Dataset ids confirmed by guided setup and offered as initial choices. */
  initialDatasetIds?: string[];
  onUpdated: () => void | Promise<void>;
  onContinue: () => void;
  onBack?: () => void;
}

/**
 * How a dataset reads in the picker: its name, plus what is *missing* from it.
 *
 * Missing metadata is stated rather than hidden. A dataset with no declared
 * extent is a candidate — it makes no claim to be elsewhere — but the person
 * choosing it should know the region and date filters could not speak for it.
 */
export function datasetOptionLabel(
  ds: Pick<DataCatalogDataset, 'name' | 'region_match' | 'time_period'>,
  requested: RequestedRange | null,
): string {
  const notes: string[] = [];
  if (ds.region_match === 'unknown') notes.push('! no location');
  if (!ds.time_period) notes.push('! no dates');
  else {
    const cov = dateCoverage(requested, toPeriod(ds.time_period));
    if (cov === 'full') notes.push('dates full');
    else if (cov === 'partial') notes.push('dates partial');
    else if (cov === 'outside') notes.push('dates outside');
    else if (cov === 'unknown') notes.push('dates unknown');
  }
  return notes.length ? `${ds.name} · ${notes.join(' · ')}` : ds.name;
}

/**
 * Split the candidates by what the region filter can say about them.
 *
 * Three buckets, because there are three answers. `outside` is a positive claim
 * — the dataset declares a location and it is not here — and is the only one
 * worth hiding. `unknown` declares nothing, so hiding it would be an assertion
 * the data does not support.
 */
export function splitByRegion(datasets: DataCatalogDataset[]): {
  inRegion: DataCatalogDataset[];
  noLocation: DataCatalogDataset[];
  outside: DataCatalogDataset[];
} {
  return {
    inRegion: datasets.filter((d) => d.region_match === 'inside'),
    noLocation: datasets.filter((d) => d.region_match === 'unknown'),
    outside: datasets.filter((d) => d.region_match === 'outside'),
  };
}

function coverageBarClass(coverage: DateCoverage, selected: boolean): string {
  const selectedRing = selected ? 'ring-2 ring-blue-500 ring-offset-1' : '';
  switch (coverage) {
    case 'full':
      return `bg-emerald-500 ${selectedRing}`;
    case 'partial':
      return `bg-amber-400 ${selectedRing}`;
    case 'outside':
      return `bg-slate-300 ${selectedRing}`;
    default:
      return selectedRing;
  }
}

function DatasetCoverageTimeline({
  datasets,
  allCandidates,
  requested,
  assignedId,
  onAssign,
}: {
  datasets: DataCatalogDataset[];
  allCandidates: DataCatalogDataset[];
  requested: RequestedRange | null;
  assignedId: string | null;
  onAssign: (datasetId: string, dataset: DataCatalogDataset) => void;
}) {
  const domain = timelineDomain(allCandidates, requested);
  const ticks = timelineTicks(domain);
  const counts = allCandidates.reduce<Record<string, number>>((acc, dataset) => {
    const coverage = coverageForDataset(dataset, requested);
    acc[coverage] = (acc[coverage] ?? 0) + 1;
    return acc;
  }, {});
  const targetLeft = requested ? timelinePercent(requested.start.getTime(), domain) : null;
  const targetRight = requested ? timelinePercent(requested.end.getTime(), domain) : null;

  return (
    <div className="space-y-3 rounded-md border bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-medium text-slate-900">Temporal coverage</h4>
          <p className="text-xs text-slate-500">
            {requested
              ? `Target model window: ${requested.start.toISOString().slice(0, 10)} – ${requested.end.toISOString().slice(0, 10)}`
              : 'Target model dates are not available.'}
          </p>
        </div>
        <div
          className="flex flex-wrap gap-1.5 text-[11px] text-slate-600"
          aria-label="Coverage summary"
        >
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 ring-1 ring-emerald-200">
            {counts.full ?? 0} full
          </span>
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800 ring-1 ring-amber-200">
            {counts.partial ?? 0} partial
          </span>
          <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">
            {counts.unknown ?? 0} no dates
          </span>
        </div>
      </div>

      <div className="min-w-[42rem]">
        <div className="relative ml-48 h-8 border-b border-slate-300 text-[11px] text-slate-500">
          {targetLeft !== null && targetRight !== null && (
            <span
              className="absolute inset-y-0 bg-blue-100/80"
              style={{ left: `${targetLeft}%`, width: `${Math.max(1, targetRight - targetLeft)}%` }}
              aria-hidden
            />
          )}
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute bottom-1 -translate-x-1/2"
              style={{ left: `${timelinePercent(tick, domain)}%` }}
            >
              {new Date(tick).getUTCFullYear()}
            </span>
          ))}
        </div>

        <div role="radiogroup" aria-label="Choose dataset" className="space-y-1.5 pt-2">
          <p className="text-xs text-slate-500">Choose · {allCandidates.length} options</p>
          {datasets.map((dataset) => {
            const coverage = coverageForDataset(dataset, requested);
            const start = validDate(dataset.time_period?.start_date)?.getTime();
            const end = validDate(dataset.time_period?.end_date)?.getTime();
            const left = start === undefined ? 0 : timelinePercent(start, domain);
            const right = end === undefined ? 100 : timelinePercent(end, domain);
            const selected = dataset.id === assignedId;
            const hasBar = start !== undefined || end !== undefined;

            return (
              <button
                key={dataset.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${dataset.name}: ${coverageLabel(coverage)}; ${periodLabel(dataset.time_period)}`}
                onClick={() => onAssign(dataset.id, dataset)}
                className={cn(
                  'grid w-full grid-cols-[12rem_minmax(28rem,1fr)_9rem] items-center gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-white',
                  selected && 'bg-white ring-1 ring-blue-400',
                )}
              >
                <span className="min-w-0 truncate text-xs font-medium text-slate-800">
                  <span className="mr-1 text-slate-400" aria-hidden>
                    {selected ? '●' : '○'}
                  </span>
                  {dataset.name}
                  {dataset.region_match === 'unknown' && (
                    <span className="font-normal text-slate-500"> · ! no location</span>
                  )}
                  {dataset.region_match === 'outside' && (
                    <span className="font-normal text-slate-500"> · ! outside region</span>
                  )}
                </span>
                <span className="relative h-6 rounded bg-slate-200/70">
                  {hasBar && (
                    <span
                      className={cn(
                        'absolute top-1 h-4 min-w-[0.35rem] rounded-full',
                        coverageBarClass(coverage, selected),
                        (start === undefined || end === undefined) &&
                          'border border-dashed border-slate-500',
                      )}
                      style={{ left: `${left}%`, width: `${Math.max(0.75, right - left)}%` }}
                      aria-hidden
                    />
                  )}
                  {requested && (
                    <span
                      className="pointer-events-none absolute inset-y-0 border-x border-blue-500/80"
                      style={{
                        left: `${targetLeft}%`,
                        width: `${Math.max(1, (targetRight ?? 0) - (targetLeft ?? 0))}%`,
                      }}
                      aria-hidden
                    />
                  )}
                  {!hasBar && (
                    <span className="absolute inset-y-0 left-2 flex items-center text-[11px] text-slate-500">
                      No temporal extent declared
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-slate-600">
                  <span className="block font-medium">{coverageLabel(coverage)}</span>
                  <span className="block text-slate-500">{periodLabel(dataset.time_period)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Per-input dataset picker — lists candidates and assigns one dataset id. Isolated per model. */
function InputPicker({
  thread,
  variables,
  regionGeometry,
  requested,
  assignedId,
  suggestedDatasetIds,
  onAssign,
}: {
  thread: Thread;
  variables: string[];
  regionGeometry?: unknown;
  requested: RequestedRange | null;
  assignedId: string | null;
  suggestedDatasetIds?: string[];
  onAssign: (datasetId: string | null, dataset?: DataCatalogDataset) => void;
}) {
  const [showOutside, setShowOutside] = useState(false);
  const [query, setQuery] = useState('');
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>('all');
  const { datasets, loading } = useDataCatalogDatasets({
    variableNames: variables,
    regionGeometry,
    startDate: thread.start_date ? new Date(thread.start_date) : null,
    endDate: thread.end_date ? new Date(thread.end_date) : null,
    includeOutsideDateRange: true,
    skip: false,
  });

  const { inRegion, noLocation, outside } = useMemo(() => splitByRegion(datasets), [datasets]);

  useEffect(() => {
    if (assignedId || !suggestedDatasetIds?.length) return;
    const suggestion = datasets.find((dataset) => suggestedDatasetIds.includes(dataset.id));
    if (suggestion) onAssign(suggestion.id, suggestion);
  }, [assignedId, datasets, onAssign, suggestedDatasetIds]);

  const offered = showOutside ? datasets : [...inRegion, ...noLocation];
  const assignedDataset = assignedId ? datasets.find((dataset) => dataset.id === assignedId) : null;
  const candidates =
    assignedDataset && !offered.some((dataset) => dataset.id === assignedDataset.id)
      ? [assignedDataset, ...offered]
      : offered;
  const filteredCandidates = candidates.filter(
    (dataset) =>
      datasetMatchesSearch(dataset, query) &&
      coverageMatchesFilter(coverageForDataset(dataset, requested), coverageFilter),
  );
  const visibleDatasets =
    assignedDataset && !filteredCandidates.some((dataset) => dataset.id === assignedDataset.id)
      ? [assignedDataset, ...filteredCandidates]
      : filteredCandidates;
  const assignedIsPinned = Boolean(
    assignedDataset && !filteredCandidates.includes(assignedDataset),
  );

  const outsideToggle = outside.length > 0 && (
    <button
      type="button"
      onClick={() => setShowOutside((v) => !v)}
      className="text-xs text-blue-600 hover:underline"
    >
      {showOutside ? 'Hide' : 'Show'} {outside.length} dataset{outside.length !== 1 ? 's' : ''}{' '}
      outside this region
    </button>
  );

  if (loading) {
    return <span className="text-xs text-gray-400">Loading datasets…</span>;
  }
  if (candidates.length === 0) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
        No matching datasets in this region.
        {outsideToggle}
      </span>
    );
  }

  return (
    <div className="mt-3 w-full space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            aria-label="Search datasets"
            placeholder="Search datasets by name, source, or variable…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 w-full rounded border border-slate-300 bg-white pl-8 pr-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <span>Coverage</span>
          <select
            aria-label="Filter by date coverage"
            value={coverageFilter}
            onChange={(event) => setCoverageFilter(event.target.value as CoverageFilter)}
            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
          >
            <option value="all">All candidates</option>
            <option value="full">Full coverage</option>
            <option value="partial">Partial overlap</option>
            <option value="unknown">No declared dates</option>
            <option value="outside">Outside model window</option>
          </select>
        </label>
        {outsideToggle}
      </div>

      {assignedIsPinned && (
        <p className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-800">
          The selected dataset remains visible even though it does not match the current search or
          coverage filter.
        </p>
      )}

      {visibleDatasets.length > 0 ? (
        <DatasetCoverageTimeline
          datasets={visibleDatasets}
          allCandidates={candidates}
          requested={requested}
          assignedId={assignedId}
          onAssign={(datasetId, dataset) => onAssign(datasetId, dataset)}
        />
      ) : (
        <p className="rounded border border-dashed px-3 py-4 text-center text-xs text-slate-500">
          No candidates match this search and coverage filter.
        </p>
      )}
    </div>
  );
}

export function DatasetsStep({
  thread,
  models,
  ensembles,
  persistedData,
  regionGeometry,
  initialDatasetIds = [],
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
    const start = new Date(thread.start_date);
    const end = new Date(thread.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
    return { start, end };
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

  // A region with no geometry cannot narrow anything; say so rather than
  // implying a filter that never ran.
  const regionHasExtent = Array.isArray(regionGeometry)
    ? regionGeometry.length > 0
    : Boolean(regionGeometry);
  const chips = [
    { icon: '📦', label: 'Input', value: 'per model input' },
    ...(thread.region_id
      ? [
          {
            icon: '⌖',
            label: 'Region',
            value: thread.region?.name ?? thread.region_id,
            source: regionHasExtent ? 'from Framing' : 'from Framing · no extent, not applied',
          },
        ]
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
                    <li key={input.id} className="rounded border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-gray-700">
                          {input.name}
                          {input.isOptional && (
                            <span className="ml-1 text-xs font-normal text-gray-400">
                              (optional)
                            </span>
                          )}
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs">
                          {!current && !input.isOptional && (
                            <span className="text-amber-600">⚠ no dataset assigned</span>
                          )}
                          {current && cov !== 'none' && (
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5',
                                cov === 'full'
                                  ? 'bg-green-100 text-green-800'
                                  : cov === 'partial'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700',
                              )}
                            >
                              🗓 {coverageLabel(cov)}
                            </span>
                          )}
                        </span>
                      </div>
                      <InputPicker
                        thread={thread}
                        variables={input.variables ?? []}
                        regionGeometry={regionGeometry}
                        requested={requested}
                        assignedId={current?.datasetId ?? null}
                        suggestedDatasetIds={initialDatasetIds}
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
