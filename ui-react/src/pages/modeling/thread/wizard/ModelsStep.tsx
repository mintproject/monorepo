import { Search } from 'lucide-react';
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
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { StepShell } from './StepShell';
import { FilteredByBanner } from './FilteredByBanner';

interface ModelRow {
  id: string;
  name: string;
  description?: string | null;
  region: string;
  producesIds: string[];
  producesLabels: string[];
  needs: { name: string; varLabels: string[] }[];
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
    name: cfg.label ?? cfg.id,
    description: 'description' in cfg ? cfg.description : null,
    region: regions.map((r) => r.region.label ?? r.region.id).join(', '),
    producesIds: io.producesVariableIds,
    producesLabels: io.outputs.flatMap((o) => o.variableLabels),
    needs: io.inputs.map((i) => ({ name: i.name, varLabels: i.variableLabels })),
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
          {row.producesLabels.map((p) => (
            <span key={p} className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
              produces: {p}
            </span>
          ))}
          {row.needs.length > 0 && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
              needs {row.needs.length}: {row.needs.map((n) => n.varLabels[0] ?? n.name).join(', ')}
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

  const { data, loading, error } = useGetModelTreeWithRegionsQuery();
  const [setThreadModels] = useSetThreadModelsMutation();

  const allRows = useMemo(() => flattenToRows(data), [data]);
  const totalCount = allRows.length;

  const indicator = thread.response_variable_id ?? null;
  const indicatorRows = useMemo(
    () => (indicator ? allRows.filter((r) => r.producesIds.includes(indicator)) : allRows),
    [allRows, indicator],
  );

  const searchedRows = useMemo(() => {
    if (!searchText.trim()) return indicatorRows;
    const q = searchText.toLowerCase();
    return indicatorRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q),
    );
  }, [indicatorRows, searchText]);

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
            label: 'Indicator',
            value: `${indicatorRows.length} of ${totalCount} models`,
            source: indicator,
          },
        ],
      }
    : { chips: [{ icon: '🎯', label: 'Indicator', value: `all ${totalCount} models` }] };

  const canContinue = selectedIds.size >= 1 && !saving && perm.write;

  return (
    <StepShell
      title="Models"
      description="Choose one or more calibrated model configurations."
      canContinue={canContinue}
      continueHint={
        selectedIds.size === 0 ? 'Select at least one model' : `${selectedIds.size} selected`
      }
      continueLabel={saving ? 'Saving…' : 'Continue'}
      onContinue={handleContinue}
      onBack={onBack}
    >
      <FilteredByBanner
        chips={banner.chips}
        onEdit={indicator ? onEditIndicator : undefined}
        editLabel="edit indicator"
      />

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
            <p className="py-6 text-center text-sm text-gray-400">
              {searchText ? 'No models match your search.' : 'No models found.'}
            </p>
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
