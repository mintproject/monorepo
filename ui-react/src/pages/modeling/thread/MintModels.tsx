/**
 * MintModels — Model selection step in the modeling workflow.
 *
 * 1:1 port of the legacy LitElement MintModels component (mint-models.ts).
 * Lets the user browse all model configurations in the catalog, filter by
 * name/region/category, select one or more configurations, optionally compare
 * them, and save the selection to the thread.
 */
import { Search, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  ModelConfigInfo,
  ModelSetupInfo,
  Thread,
  ThreadModel,
  getUserPermission,
  getLatestEventOfType,
  useGetModelTreeWithRegionsQuery,
  useSetThreadModelsMutation,
} from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';
import { diffThreadModels } from '@/lib/thread-models';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ModelRow {
  /** The modelcatalog_configuration id (setup level) */
  id: string;
  name: string;
  description?: string | null;
  category: string;
  region: string;
}

interface ComparisonFeature {
  name: string;
  getValue: (row: ModelRow) => string;
}

const COMPARISON_FEATURES: ComparisonFeature[] = [
  { name: 'Category', getValue: (r) => r.category || 'Not specified' },
  { name: 'Calibration region', getValue: (r) => r.region || 'Not specified' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Flatten the tree query result to a list of row objects that can be displayed
 * in the selection table.  Each setup-level configuration becomes one row.
 */
function flattenToRows(
  data: ReturnType<typeof useGetModelTreeWithRegionsQuery>['data'],
): ModelRow[] {
  if (!data) return [];
  const rows: ModelRow[] = [];

  for (const sw of data.modelcatalog_software) {
    for (const ver of sw.versions) {
      for (const cfg of ver.configurations) {
        // A config may have child setups (setup-level) — prefer those
        if (cfg.child_configurations.length > 0) {
          for (const setup of cfg.child_configurations) {
            rows.push(setupToRow(setup, cfg));
          }
        } else {
          // Config itself is the leaf (no distinct setup level)
          rows.push(configToRow(cfg));
        }
      }
    }
  }

  return rows;
}

function configToRow(cfg: ModelConfigInfo): ModelRow {
  return {
    id: cfg.id,
    name: cfg.label ?? cfg.id,
    description: null,
    category: '',
    region: cfg.regions.map((r) => r.region.label ?? r.region.id).join(', '),
  };
}

function setupToRow(setup: ModelSetupInfo, parentCfg: ModelConfigInfo): ModelRow {
  return {
    id: setup.id,
    name: setup.label ?? setup.id,
    description: setup.description,
    category: '',
    region:
      setup.regions.length > 0
        ? setup.regions.map((r) => r.region.label ?? r.region.id).join(', ')
        : parentCfg.regions.map((r) => r.region.label ?? r.region.id).join(', '),
  };
}

// ─── ModelRow component ────────────────────────────────────────────────────────

interface ModelTableRowProps {
  row: ModelRow;
  checked: boolean;
  onToggle: (id: string, checked: boolean) => void;
}

function ModelTableRow({ row, checked, onToggle }: ModelTableRowProps) {
  return (
    <tr className={cn('border-b', checked && 'bg-blue-50')}>
      <td className="w-8 px-3 py-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(row.id, e.target.checked)}
          aria-label={`Select ${row.name}`}
          className="cursor-pointer"
        />
      </td>
      <td className="px-3 py-2">
        <span className="text-sm font-medium">{row.name}</span>
        {row.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{row.description}</p>
        )}
      </td>
      <td className="px-3 py-2 text-sm text-gray-600">{row.category || '-'}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{row.region || '-'}</td>
    </tr>
  );
}

// ─── Comparison dialog ─────────────────────────────────────────────────────────

interface CompareDialogProps {
  rows: ModelRow[];
  onClose: () => void;
}

function CompareDialog({ rows, onClose }: CompareDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal
      aria-label="Model comparison"
      data-testid="compare-dialog"
    >
      <div className="mx-4 flex max-h-[80vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-base font-semibold">Model Comparison</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="rounded p-1 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="border-r px-3 py-2 text-left font-semibold">Model details</th>
                {rows.map((r) => (
                  <th key={r.id} className="px-3 py-2 text-left font-semibold">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_FEATURES.map((feature) => (
                <tr key={feature.name} className="border-b">
                  <td className="border-r bg-gray-50 px-3 py-2 font-medium">{feature.name}</td>
                  {rows.map((r) => (
                    <td key={r.id} className="px-3 py-2">
                      {feature.getValue(r)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b">
                <td className="border-r bg-gray-50 px-3 py-2 font-medium">Description</td>
                {rows.map((r) => (
                  <td key={r.id} className="px-3 py-2 text-xs text-gray-600">
                    {r.description || <span className="italic text-gray-400">None</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── MintModels ────────────────────────────────────────────────────────────────

interface MintModelsProps {
  thread: Thread;
  onContinue?: () => void;
  onThreadUpdated?: () => void;
}

export function MintModels({ thread, onContinue, onThreadUpdated }: MintModelsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  const [editMode, setEditMode] = useState(() => {
    // Start in edit mode when no models are selected yet
    return !thread.thread_models || thread.thread_models.length === 0;
  });
  const [searchText, setSearchText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    (thread.thread_models ?? []).forEach((tm: ThreadModel) => {
      if (tm.modelcatalog_configuration_id) ids.add(tm.modelcatalog_configuration_id);
    });
    return ids;
  });
  const [notes, setNotes] = useState('');
  const [showCompare, setShowCompare] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAllRegions, setShowAllRegions] = useState(false);

  const { data, loading, error } = useGetModelTreeWithRegionsQuery();

  const [setThreadModels] = useSetThreadModelsMutation();

  // ── Derive latest SELECT_MODELS event ──────────────────────────────────────

  const latestModelEvent = getLatestEventOfType(['SELECT_MODELS'], thread.events);
  const notesDefault = latestModelEvent?.notes ?? '';

  // ── Flatten all rows ────────────────────────────────────────────────────────

  const allRows = useMemo(() => flattenToRows(data), [data]);

  // ── Filter rows ─────────────────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    if (!searchText.trim()) return allRows;
    const q = searchText.toLowerCase();
    return allRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q),
    );
  }, [allRows, searchText]);

  // Thread region for matching — derive from region_id
  const threadRegionId = thread.region_id ?? null;

  // Partition: region-matching rows vs others
  const { regionRows, otherRows } = useMemo(() => {
    if (!threadRegionId) {
      return { regionRows: filteredRows, otherRows: [] };
    }
    const regionRows: ModelRow[] = [];
    const otherRows: ModelRow[] = [];
    for (const r of filteredRows) {
      // A row "matches" the region if its region string contains the region id segment
      // or if it has no region at all (applies globally)
      const hasRegion = r.region.length > 0;
      if (!hasRegion || r.region.includes(threadRegionId)) {
        regionRows.push(r);
      } else {
        otherRows.push(r);
      }
    }
    return { regionRows, otherRows };
  }, [filteredRows, threadRegionId]);

  const displayedRows = showAllRegions ? filteredRows : regionRows;

  // ── Selection helpers ───────────────────────────────────────────────────────

  const toggleModel = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectedRows = useMemo(
    () => allRows.filter((r) => selectedIds.has(r.id)),
    [allRows, selectedIds],
  );

  // ── Save handler ────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!user?.username) return;

    const changes = diffThreadModels(thread.id, thread.thread_models ?? [], selectedIds);
    if (changes.unchanged) {
      setEditMode(false);
      if (onContinue) onContinue();
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
          notes: notes || null,
        },
      });
      setEditMode(false);
      onThreadUpdated?.();
      if (onContinue) onContinue();
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isDone = (thread.thread_models?.length ?? 0) > 0;

  // View mode — show selected models
  if (isDone && !editMode) {
    return (
      <div className="space-y-4" data-testid="models-view-mode">
        <p className="text-sm text-gray-600">
          The following models have been selected for this sub-task.
        </p>

        <div className="clt">
          <h3 className="mb-2 text-sm font-semibold">
            Selected Models
            {perm.write && (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="ml-2 text-xs text-blue-600 hover:underline"
                data-testid="edit-models-btn"
              >
                Edit
              </button>
            )}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {(thread.thread_models ?? []).map((tm: ThreadModel) => {
              const cfgId = tm.modelcatalog_configuration_id ?? tm.model_id ?? tm.id;
              const row = allRows.find((r) => r.id === cfgId);
              return <li key={tm.id}>{row ? row.name : cfgId}</li>;
            })}
          </ul>
        </div>

        {latestModelEvent?.notes && (
          <fieldset className="rounded border p-3">
            <legend className="px-1 text-xs font-medium">Notes</legend>
            <p className="text-sm text-gray-700">{latestModelEvent.notes}</p>
          </fieldset>
        )}

        <div className="flex justify-end">
          <Button type="button" onClick={onContinue} data-testid="continue-btn">
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // Selection / edit mode
  return (
    <div className="space-y-4" data-testid="models-edit-mode">
      <p className="text-sm text-gray-600">
        The models below are available in the catalog. Select one or more calibrated models to use
        in this sub-task. You can compare selected models before saving.
      </p>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          id="model-search"
          type="text"
          placeholder="Filter models by name, region or description…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full rounded border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          data-testid="model-search-input"
        />
      </div>

      {/* Model table */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          Failed to load models: {error.message}
        </p>
      )}

      {!loading && !error && (
        <div className="overflow-auto rounded border">
          <table className="w-full text-sm" data-testid="models-table">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2 text-left font-semibold">Model</th>
                <th className="px-3 py-2 text-left font-semibold">Category</th>
                <th className="px-3 py-2 text-left font-semibold">Calibration Region</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-sm text-gray-400"
                    data-testid="no-models-row"
                  >
                    {searchText ? 'No models match your search.' : 'No models found.'}
                  </td>
                </tr>
              ) : (
                displayedRows.map((row) => (
                  <ModelTableRow
                    key={row.id}
                    row={row}
                    checked={selectedIds.has(row.id)}
                    onToggle={toggleModel}
                  />
                ))
              )}

              {/* Show/hide other-region models link */}
              {!searchText && otherRows.length > 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-sm text-gray-400">
                    <button
                      type="button"
                      className="cursor-pointer underline hover:text-gray-600"
                      onClick={() => setShowAllRegions((v) => !v)}
                      data-testid="toggle-other-regions"
                    >
                      {showAllRegions ? 'Hide' : 'Show'} {otherRows.length} model
                      {otherRows.length !== 1 ? 's' : ''} for other regions
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      <fieldset className="rounded border p-3">
        <legend className="px-1 text-xs font-medium">Notes</legend>
        <textarea
          id="model-notes"
          rows={3}
          defaultValue={notesDefault}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full resize-none border-none text-sm outline-none"
          data-testid="model-notes"
        />
      </fieldset>

      {/* Footer */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (selectedIds.size < 2) {
              // Require at least 2 for compare
              return;
            }
            setShowCompare(true);
          }}
          disabled={selectedIds.size < 2}
          data-testid="compare-btn"
        >
          Compare Selected Models
        </Button>

        <div className="flex-1" />

        {isDone && editMode && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditMode(false)}
            disabled={saving}
            data-testid="cancel-btn"
          >
            Cancel
          </Button>
        )}

        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || selectedIds.size === 0}
          data-testid="select-continue-btn"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Saving…
            </span>
          ) : (
            'Select & Continue'
          )}
        </Button>
      </div>

      {/* Comparison modal */}
      {showCompare && <CompareDialog rows={selectedRows} onClose={() => setShowCompare(false)} />}
    </div>
  );
}
