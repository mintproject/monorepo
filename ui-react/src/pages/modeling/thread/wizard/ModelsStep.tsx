import { Search } from 'lucide-react';
import { gql, useQuery } from '@apollo/client';
import { useCallback, useMemo, useState } from 'react';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  ModelConfigInfo,
  ModelSetupInfo,
  Thread,
  ThreadModel,
  extractModelIO,
  getUserPermission,
  useGetModelTreeWithRegionsQuery,
  useSetThreadModelsMutation,
} from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';
import { diffThreadModels } from '@/lib/thread-models';
import { slugFromUri } from '@/lib/uri';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSemanticSearch } from '@/hooks/useSemanticSearch';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  inferReachableModelConfigurationIds,
  type ContractTransform,
  type InferenceModelOutput,
} from '@/lib/modeling/outcome-driver-inference';
import { StepShell } from './StepShell';
import { FilteredByBanner } from './FilteredByBanner';

interface ModelRow {
  id: string;
  searchIds: string[];
  name: string;
  description?: string | null;
  region: string;
  producesIds: string[];
  producesLabels: string[];
  outputContracts: { id: string; format?: string | null }[];
  needs: { name: string; varIds: string[]; varLabels: string[] }[];
}

export const ModelOutcomeAdapterInferenceDocument = gql`
  query GetModelOutcomeAdapterInference {
    adapterTransforms: adapter_transform_spec {
      contracts {
        role
        standard_variable_uri
        format
      }
    }
  }
`;

interface ModelOutcomeAdapterInferenceData {
  adapterTransforms: Array<{
    contracts: Array<{
      role: string;
      standard_variable_uri?: string | null;
      format?: string | null;
    }>;
  }>;
}

interface ModelsStepProps {
  thread: Thread;
  onUpdated: () => void;
  onContinue: () => void;
  onBack?: () => void;
  /** Optional: jump back to the Variables step (banner edit link). */
  onEditIndicator?: () => void;
}

function rowFromConfig(cfg: ModelConfigInfo | ModelSetupInfo, parent?: ModelConfigInfo): ModelRow {
  const io = extractModelIO(cfg);
  const regions = cfg.regions.length > 0 ? cfg.regions : (parent?.regions ?? []);
  return {
    id: cfg.id,
    searchIds: parent ? [cfg.id, parent.id] : [cfg.id],
    name: cfg.label ?? cfg.id,
    description: 'description' in cfg ? cfg.description : null,
    region: regions.map((r) => r.region.label ?? r.region.id).join(', '),
    producesIds: io.producesVariableIds,
    producesLabels: io.outputs.flatMap((o) => o.variableLabels),
    outputContracts: io.outputs.flatMap((output) => {
      const ids = output.variableIds.length > 0 ? output.variableIds : [''];
      return ids.map((id) => ({ id, format: output.format }));
    }),
    needs: io.inputs.map((i) => ({
      name: i.name,
      varIds: i.variableIds,
      varLabels: i.variableLabels,
    })),
  };
}

function flattenToRows(
  data: ReturnType<typeof useGetModelTreeWithRegionsQuery>['data'],
): ModelRow[] {
  if (!data) return [];
  const rows: ModelRow[] = [];
  for (const sw of data.modelcatalog_software) {
    for (const ver of sw.versions) {
      for (const cfg of ver.configurations) {
        if (cfg.child_configurations.length > 0) {
          for (const setup of cfg.child_configurations) rows.push(rowFromConfig(setup, cfg));
        } else {
          rows.push(rowFromConfig(cfg));
        }
      }
    }
  }
  return rows;
}

function ModelCard({
  row,
  checked,
  onToggle,
}: {
  row: ModelRow;
  checked: boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded border p-3 text-sm transition-colors',
        checked ? 'border-blue-400 bg-blue-50' : 'hover:bg-gray-50',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(row.id, e.target.checked)}
        aria-label={`Select ${row.name}`}
        className="mt-1"
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{row.name}</div>
        {row.region && <div className="text-xs text-gray-500">{row.region}</div>}
        {row.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{row.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {row.producesLabels.length > 0 ? (
            row.producesLabels.map((p, index) => (
              <span
                key={`${row.id}-produces-${index}`}
                className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800"
              >
                Produces: {p}
              </span>
            ))
          ) : (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              Output metadata unavailable
            </span>
          )}
          {row.needs.length > 0 ? (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
              Model inputs ({row.needs.length}):{' '}
              {row.needs.map((n) => n.varLabels[0] ?? n.name).join(', ')}
            </span>
          ) : (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              Input metadata unavailable
            </span>
          )}
        </div>
      </div>
    </label>
  );
}

export function ModelsStep({
  thread,
  onUpdated,
  onContinue,
  onBack,
  onEditIndicator,
}: ModelsStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  const [searchText, setSearchText] = useState('');
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    (thread.thread_models ?? []).forEach((tm: ThreadModel) => {
      if (tm.modelcatalog_configuration_id) ids.add(tm.modelcatalog_configuration_id);
    });
    return ids;
  });

  const indicator = thread.response_variable_id ?? null;
  const { data, loading, error } = useGetModelTreeWithRegionsQuery();
  const adapterInferenceQ = useQuery<ModelOutcomeAdapterInferenceData>(
    ModelOutcomeAdapterInferenceDocument,
    { fetchPolicy: 'cache-first', skip: !indicator },
  );
  const [setThreadModels] = useSetThreadModelsMutation();

  const allRows = useMemo(() => flattenToRows(data), [data]);
  const totalCount = allRows.length;

  // The stored id is a standard-variable URI (#106), which is unreadable, so
  // prefer the label the relationship carries. A thread whose relationship did
  // not resolve falls back to the URI's trailing slug — never the whole URI.
  const indicatorLabel = thread.response_variable?.label ?? (indicator && slugFromUri(indicator));
  const debouncedSearchText = useDebouncedValue(searchText, 300);
  // Outcome compatibility is evaluated locally from model outputs and the
  // adapter graph. Applying the semantic endpoint's direct-output filter here
  // would hide a model that reaches the outcome through an adapter chain.
  const semanticFilters = useMemo(() => ({ outputVariableIds: undefined }), []);
  const semanticSearch = useSemanticSearch(debouncedSearchText, {
    target: 'model_configuration',
    limit: 100,
    filters: semanticFilters,
  });
  const adapterTransforms = useMemo<ContractTransform[]>(
    () =>
      (adapterInferenceQ.data?.adapterTransforms ?? []).map((process) => ({
        kind: 'adapter' as const,
        outputs: process.contracts
          .filter((contract) => contract.role === 'output')
          .map((contract) => ({
            id: contract.standard_variable_uri?.trim() ?? '',
            format: contract.format,
          })),
        inputs: process.contracts
          .filter((contract) => contract.role === 'input')
          .map((contract) => ({
            id: contract.standard_variable_uri?.trim() ?? '',
            format: contract.format,
          })),
      })),
    [adapterInferenceQ.data],
  );
  const inferredModelIds = useMemo(() => {
    if (!indicator || !adapterInferenceQ.data) return new Set<string>();
    const modelOutputs: InferenceModelOutput[] = allRows.flatMap((row) =>
      row.outputContracts.map((output) => ({ configurationId: row.id, output })),
    );
    return inferReachableModelConfigurationIds(
      { id: indicator, label: indicatorLabel },
      modelOutputs,
      adapterTransforms,
    );
  }, [adapterInferenceQ.data, adapterTransforms, allRows, indicator, indicatorLabel]);
  const indicatorRows = useMemo(
    () =>
      indicator
        ? allRows.filter((r) => r.producesIds.includes(indicator) || inferredModelIds.has(r.id))
        : allRows,
    [allRows, indicator, inferredModelIds],
  );

  const localSearchedRows = useMemo(() => {
    if (!searchText.trim()) return indicatorRows;
    const q = searchText.toLowerCase();
    return indicatorRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q),
    );
  }, [indicatorRows, searchText]);

  const searchedRows = useMemo(() => {
    if (!debouncedSearchText.trim() || !semanticSearch.results) return localSearchedRows;
    const rankById = new Map(semanticSearch.results.map((result, index) => [result.id, index]));
    return indicatorRows
      .map((row) => ({
        row,
        rank: Math.min(
          ...row.searchIds
            .map((id) => rankById.get(id))
            .filter((rank): rank is number => rank !== undefined),
        ),
      }))
      .filter((item) => Number.isFinite(item.rank))
      .sort((a, b) => a.rank - b.rank)
      .map((item) => item.row);
  }, [debouncedSearchText, indicatorRows, localSearchedRows, semanticSearch.results]);

  const threadRegionId = thread.region_id ?? null;
  const { regionRows, otherRows } = useMemo(() => {
    if (!threadRegionId) return { regionRows: searchedRows, otherRows: [] as ModelRow[] };
    const matched: ModelRow[] = [];
    const others: ModelRow[] = [];
    for (const r of searchedRows) {
      const hasRegion = r.region.length > 0;
      if (!hasRegion || r.region.includes(threadRegionId)) matched.push(r);
      else others.push(r);
    }
    return { regionRows: matched, otherRows: others };
  }, [searchedRows, threadRegionId]);

  const displayedRows = showAllRegions ? searchedRows : regionRows;
  const incompatibleSelectedRows = useMemo(() => {
    if (!indicator) return [];
    const selected = new Set(selectedIds);
    return allRows.filter(
      (row) =>
        selected.has(row.id) &&
        !row.producesIds.includes(indicator) &&
        !inferredModelIds.has(row.id),
    );
  }, [allRows, indicator, inferredModelIds, selectedIds]);

  const toggleModel = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  async function handleContinue() {
    if (!user?.username || selectedIds.size === 0) return;

    const changes = diffThreadModels(thread.id, thread.thread_models ?? [], selectedIds);
    // Nothing to write: walking back through the step must not touch the
    // bindings the later steps have already stored against these rows.
    if (changes.unchanged) {
      onContinue();
      return;
    }

    setSaving(true);
    try {
      await setThreadModels({
        variables: {
          threadId: thread.id,
          removedIds: changes.removedIds,
          models: changes.added,
          userid: user.username,
          notes: null,
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

  const banner = indicator
    ? {
        chips: [
          {
            icon: '🎯',
            label: 'Desired outcome',
            value: `${indicatorRows.length} of ${totalCount} models`,
            source: indicatorLabel ? `produces or transforms to ${indicatorLabel}` : undefined,
          },
        ],
      }
    : {
        chips: [
          {
            icon: '🎯',
            label: 'Desired outcome',
            value: `all ${totalCount} models`,
          },
        ],
      };

  const canContinue =
    selectedIds.size >= 1 && incompatibleSelectedRows.length === 0 && !saving && perm.write;

  return (
    <StepShell
      title="Models"
      description="Choose one or more calibrated models. Each card shows what it produces and which inputs can become drivers and datasets."
      canContinue={canContinue}
      continueHint={
        incompatibleSelectedRows.length > 0
          ? `Remove ${incompatibleSelectedRows.length} model${incompatibleSelectedRows.length === 1 ? '' : 's'} that do not produce the desired outcome`
          : selectedIds.size === 0
            ? 'Select at least one model'
            : `${selectedIds.size} selected`
      }
      continueLabel={saving ? 'Saving…' : 'Continue'}
      onContinue={handleContinue}
      onBack={onBack}
    >
      <FilteredByBanner
        chips={banner.chips}
        onEdit={indicator ? onEditIndicator : undefined}
        editLabel="edit outcome"
      />

      {indicator && !loading && !error && incompatibleSelectedRows.length > 0 && (
        <div
          className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="alert"
        >
          <p className="font-medium">
            {incompatibleSelectedRows.length === 1 ? 'One selected model' : 'Some selected models'}{' '}
            {incompatibleSelectedRows.length === 1 ? 'does' : 'do'} not produce{' '}
            {indicatorLabel ?? 'the desired outcome'}.
          </p>
          <p className="mt-1 text-xs">
            Remove {incompatibleSelectedRows.length === 1 ? 'it' : 'them'} or choose a different
            outcome before continuing.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {incompatibleSelectedRows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="rounded border border-amber-400 bg-white px-2 py-1 text-xs text-amber-900 hover:bg-amber-100"
                onClick={() => toggleModel(row.id, false)}
                aria-label={`Remove ${row.name}`}
              >
                Remove {row.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!indicator && !loading && !error && (
        <p className="mb-4 text-xs text-gray-600" role="status">
          No desired outcome selected — all models are available. Choose an outcome in Outcome &
          drivers to narrow this list to models that produce it.
        </p>
      )}

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Filter models by name, region or description…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full rounded border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          Failed to load models: {error.message}
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-2">
          {displayedRows.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">
              {searchText ? (
                'No models match your search.'
              ) : indicator && indicatorRows.length === 0 ? (
                // The Variables step now offers only producible indicators, so
                // this is reachable for a stored value alone — a thread saved
                // before that rule, or one whose model lost its output. Say
                // which choice empties the list, rather than a bare "none".
                <>
                  <p className="text-gray-600">
                    No model produces or transforms to <strong>{indicatorLabel}</strong>.
                  </p>
                  <p className="mt-1 text-xs">
                    This sub-task stores it as its indicator, but no configuration in the catalog
                    carries it as an output.
                  </p>
                  {onEditIndicator && (
                    <button
                      type="button"
                      onClick={onEditIndicator}
                      className="mt-2 text-xs text-blue-600 underline"
                    >
                      Choose a different indicator
                    </button>
                  )}
                </>
              ) : (
                'No models found.'
              )}
            </div>
          ) : (
            displayedRows.map((row) => (
              <ModelCard
                key={row.id}
                row={row}
                checked={selectedIds.has(row.id)}
                onToggle={toggleModel}
              />
            ))
          )}

          {!searchText && otherRows.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllRegions((v) => !v)}
              className="text-sm text-blue-600 underline hover:text-blue-800"
            >
              {showAllRegions ? 'Hide' : 'Show'} {otherRows.length} model
              {otherRows.length !== 1 ? 's' : ''} calibrated for other regions
            </button>
          )}
        </div>
      )}
    </StepShell>
  );
}
