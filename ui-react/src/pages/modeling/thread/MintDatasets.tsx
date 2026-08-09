/**
 * MintDatasets — Dataset selection step.
 *
 * 1:1 port of the legacy LitElement MintDatasets component
 * (ui/src/screens/modeling/thread/mint-datasets.ts, 1350+ LOC).
 *
 * Responsibilities:
 * - For each selected model in the thread, list its required input files.
 * - Query the Data Catalog REST API for datasets that match each input's variables.
 * - Show checkboxes to select datasets; bold = matches driving variable.
 * - Allow comparing selected datasets in a dialog.
 * - Allow filtering/selecting individual resources for a dataset.
 * - On "Select & Continue", write selections to Hasura via UpdateThreadData mutation.
 */
import React, { useEffect, useRef, useState } from 'react';

import {
  Thread,
  getUserPermission,
  useUpdateThreadDataMutation,
} from '@/graphql/generated/modeling';
import { useDataCatalogDatasets } from '@/hooks/useDataCatalog';
import { DataCatalogDataset, DataCatalogResource, loadDatasetResources } from '@/lib/data-catalog';
import { hashResourceId, newDatasliceId as newId } from '@/lib/thread-datasets';
import { useAuth } from '@/lib/auth/useAuth';
import { useToast } from '@/components/ui/use-toast';

// ─── Local types ──────────────────────────────────────────────────────────────

/** A thread model input file (from the model catalog). */
export interface ThreadModelInput {
  id: string;
  name: string;
  /** Standard variable names used to query the data catalog */
  variables: string[];
  /** If set, the expert modeler pre-selected a value — skip user selection */
  value?: unknown;
  isOptional?: boolean;
}

/** A thread model (minimal shape needed by this component). */
export interface ThreadModel {
  id: string;
  name: string;
  /** URL suffix for the model in the catalog browser */
  url?: string;
  input_files: ThreadModelInput[];
}

/** Ensemble binding: maps input_id -> list of dataslice ids chosen */
export interface ThreadModelEnsemble {
  id: string;
  bindings: Record<string, string[]>;
}

/** A dataslice already persisted for a thread binding. */
export interface PersistedDataslice {
  id: string;
  name: string;
  dataset: { id: string; name: string };
  total_resources?: number;
  selected_resources?: number;
}

interface MintDatasetsProps {
  thread: Thread;
  /** Models already selected for this thread */
  models: Record<string, ThreadModel>;
  /** Existing model ensembles (data bindings) */
  modelEnsembles: Record<string, ThreadModelEnsemble>;
  /** Existing dataslice map (id -> dataslice) */
  threadData: Record<string, PersistedDataslice>;
  /** Region geometry for spatial filtering */
  regionGeometry?: unknown;
  onContinue: () => void;
  onThreadUpdated?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safe CSS class prefix — strip special chars from a Hasura URI */
function safeId(id: string): string {
  return id.replace(/[/.:]/g, '_');
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Resource selection dialog for a dataset or dataslice */
interface ResourceSelectionDialogProps {
  title: string;
  resources: DataCatalogResource[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (selected: Record<string, boolean>) => void;
}

function ResourceSelectionDialog({
  title,
  resources,
  loading,
  onClose,
  onSubmit,
}: ResourceSelectionDialogProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    resources.forEach((r) => {
      init[r.id] = r.selected ?? true;
    });
    return init;
  });

  // Sync when resources change (e.g. loaded async)
  useEffect(() => {
    setSelected((prev) => {
      const next = { ...prev };
      resources.forEach((r) => {
        if (!(r.id in next)) next[r.id] = r.selected ?? true;
      });
      return next;
    });
  }, [resources]);

  const allChecked = resources.length > 0 && resources.every((r) => selected[r.id] !== false);

  function toggleAll(checked: boolean) {
    const next: Record<string, boolean> = {};
    resources.forEach((r) => {
      next[r.id] = checked;
    });
    setSelected(next);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Select resources"
      data-testid="resource-selection-dialog"
    >
      <div className="flex max-h-[80vh] w-[600px] flex-col rounded bg-white shadow-lg">
        <div className="border-b px-4 py-3 text-sm font-semibold">{title}</div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="w-8 px-2 py-1 text-left">
                    <input
                      type="checkbox"
                      id="all-resources"
                      checked={allChecked}
                      onChange={(e) => toggleAll(e.target.checked)}
                      aria-label="Select all resources"
                    />
                  </th>
                  <th className="px-2 py-1 text-left">Resource</th>
                  <th className="px-2 py-1 text-left">Time</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        data-resourceid={r.id}
                        checked={selected[r.id] ?? true}
                        onChange={(e) =>
                          setSelected((prev) => ({ ...prev, [r.id]: e.target.checked }))
                        }
                        aria-label={`Select ${r.name}`}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {r.name}
                      </a>
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-500">
                      {r.time_period
                        ? `${formatDate(r.time_period.start_date)} — ${formatDate(r.time_period.end_date)}`
                        : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            data-testid="resource-submit"
            onClick={() => onSubmit(selected)}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

/** Dataset comparison dialog */
interface ComparisonDialogProps {
  datasets: DataCatalogDataset[];
  regionId: string;
  onClose: () => void;
}

function ComparisonDialog({ datasets, regionId, onClose }: ComparisonDialogProps) {
  const features: Array<{ name: string; fn: (ds: DataCatalogDataset) => React.ReactNode }> = [
    {
      name: 'More information',
      fn: (ds) => (
        <a
          target="_blank"
          rel="noreferrer"
          href={`/${regionId}/datasets/browse/${ds.id}`}
          className="text-blue-600 hover:underline"
        >
          Dataset Profile
        </a>
      ),
    },
    { name: 'Description', fn: (ds) => ds.description },
    {
      name: 'Source',
      fn: (ds) => (
        <a
          href={ds.source.url}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:underline"
        >
          {ds.source.name}
        </a>
      ),
    },
    { name: 'Source Type', fn: (ds) => ds.source.type },
    { name: 'Limitations', fn: (ds) => ds.limitations },
    { name: 'Version', fn: (ds) => ds.version },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Compare datasets"
      data-testid="comparison-dialog"
    >
      <div className="flex max-h-[80vh] w-[80vw] flex-col rounded bg-white shadow-lg">
        <div className="border-b px-4 py-3 text-sm font-semibold">Compare Datasets</div>
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="w-40 border-r px-3 py-2 text-left" />
                {datasets.map((ds) => (
                  <th key={ds.id} className="px-3 py-2 text-left">
                    <b>{ds.name}</b>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feat) => (
                <tr key={feat.name} className="border-b hover:bg-gray-50">
                  <td className="border-r px-3 py-2 font-semibold">{feat.name}</td>
                  {datasets.map((ds) => (
                    <td key={ds.id} className="px-3 py-2">
                      {feat.fn(ds)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Per-input dataset picker ─────────────────────────────────────────────────

interface InputDatasetPickerProps {
  modelId: string;
  input: ThreadModelInput;
  thread: Thread;
  existingBindings: string[]; // dataslice ids already bound
  threadData: Record<string, PersistedDataslice>;
  editMode: boolean;
  regionGeometry?: unknown;
  regionId: string;
  /** Called when user changes selection for this input */
  onChange: (inputId: string, datasets: DataCatalogDataset[]) => void;
}

function InputDatasetPicker({
  modelId,
  input,
  thread,
  existingBindings,
  threadData,
  editMode,
  regionGeometry,
  regionId,
  onChange,
}: InputDatasetPickerProps) {
  const skip = !editMode && existingBindings.length > 0;
  const { datasets, loading } = useDataCatalogDatasets({
    variableNames: input.variables,
    regionGeometry,
    startDate: thread.start_date ? new Date(thread.start_date) : null,
    endDate: thread.end_date ? new Date(thread.end_date) : null,
    skip,
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAllDatasets, setShowAllDatasets] = useState(false);
  const [datasetResources, setDatasetResources] = useState<Record<string, DataCatalogResource[]>>(
    {},
  );
  const [loadingResources, setLoadingResources] = useState<Record<string, boolean>>({});
  const [resourceDialog, setResourceDialog] = useState<{
    dataset: DataCatalogDataset;
    resources: DataCatalogResource[];
    loading: boolean;
  } | null>(null);
  const [compareDialog, setCompareDialog] = useState<DataCatalogDataset[] | null>(null);

  // Pre-select existing bindings
  useEffect(() => {
    if (existingBindings.length > 0 && !editMode) {
      const ids = existingBindings
        .map((sliceId) => threadData[sliceId]?.dataset?.id)
        .filter(Boolean) as string[];
      setSelectedIds(new Set(ids));
    }
  }, [existingBindings, editMode, threadData]);

  // Notify parent whenever selection changes
  useEffect(() => {
    const chosen = datasets.filter((ds) => selectedIds.has(ds.id));
    onChange(input.id, chosen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, datasets]);

  const inputType = input.variables[0]?.replace(/.*#/, '') ?? '';

  // Filter by datatype match
  const typeMatchingDatasets = datasets.filter((ds) => ds.datatype === inputType);
  const visibleDatasets = showAllDatasets
    ? datasets
    : typeMatchingDatasets.length > 0
      ? typeMatchingDatasets
      : datasets;
  const hiddenCount = datasets.length - typeMatchingDatasets.length;

  // Driving variable match check (bold rows)
  const drivingVar = thread.driving_variable_id ?? '';
  function matchesDrivingVariable(ds: DataCatalogDataset): boolean {
    return drivingVar.length > 0 && ds.variables.includes(drivingVar);
  }

  async function handleLoadAndToggleResources(ds: DataCatalogDataset) {
    if (!datasetResources[ds.id]) {
      setLoadingResources((prev) => ({ ...prev, [ds.id]: true }));
      try {
        const res = await loadDatasetResources({
          datasetId: ds.id,
          variableNames: input.variables,
          regionGeometry,
          startDate: thread.start_date ? new Date(thread.start_date) : null,
          endDate: thread.end_date ? new Date(thread.end_date) : null,
        });
        const withSelected = res.map((r) => ({ ...r, selected: true }));
        setDatasetResources((prev) => ({ ...prev, [ds.id]: withSelected }));
        setResourceDialog({ dataset: ds, resources: withSelected, loading: false });
      } catch {
        // ignore
      } finally {
        setLoadingResources((prev) => ({ ...prev, [ds.id]: false }));
      }
    } else {
      setResourceDialog({ dataset: ds, resources: datasetResources[ds.id] ?? [], loading: false });
    }
  }

  function handleResourceSubmit(selected: Record<string, boolean>) {
    if (!resourceDialog) return;
    const updated = resourceDialog.resources.map((r) => ({
      ...r,
      selected: selected[r.id] ?? r.selected,
    }));
    setDatasetResources((prev) => ({ ...prev, [resourceDialog.dataset.id]: updated }));
    setResourceDialog(null);
    // Auto-select this dataset if not already
    setSelectedIds((prev) => new Set([...prev, resourceDialog.dataset.id]));
  }

  function handleCompare() {
    const chosen = datasets.filter((ds) => selectedIds.has(ds.id));
    setCompareDialog(chosen);
  }

  function toggleDataset(dsId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(dsId)) next.delete(dsId);
      else next.add(dsId);
      return next;
    });
  }

  // View mode: already-selected bindings
  if (!editMode && existingBindings.length > 0) {
    return (
      <ul className="mt-1 space-y-1 text-sm">
        {existingBindings.map((sliceId) => {
          const slice = threadData[sliceId];
          if (!slice) return null;
          const total = slice.total_resources ?? 0;
          const selCount = slice.selected_resources ?? 0;
          return (
            <li key={sliceId}>
              <a
                target="_blank"
                rel="noreferrer"
                href={`/${regionId}/datasets/browse/${slice.dataset.id}`}
                className="text-blue-600 hover:underline"
              >
                {slice.dataset.name}
              </a>
              {total > 1 && (
                <span className="ml-1 text-xs text-gray-500">
                  ({selCount}/{total} files)
                </span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  // Edit mode or no existing bindings
  return (
    <div className="mt-2">
      <div className="mb-2 flex items-start gap-1 text-sm">
        {input.isOptional ? (
          <span className="text-xs text-gray-400" title="Optional input — selection not required">
            ℹ
          </span>
        ) : (
          <span className="text-xs text-orange-500" title="Required input">
            ⚠
          </span>
        )}
        <span>
          Select an input dataset for <strong>{input.name}</strong>
          {input.isOptional && <span className="ml-1 text-xs text-gray-400">(optional)</span>}. You
          can select more than one dataset if you want several runs. Datasets matching the driving
          variable (if any) are in <strong>bold</strong>.
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          Loading datasets…
        </div>
      ) : (
        <>
          <div className="overflow-auto">
            <table className="w-full border-collapse border border-gray-200 text-xs">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="w-6 px-2 py-1" />
                  <th className="px-2 py-1 text-left font-semibold">Dataset</th>
                  <th className="px-2 py-1 text-left">Categories</th>
                  <th className="px-2 py-1 text-left">Region</th>
                  <th className="px-2 py-1 text-left">Time Period</th>
                  <th className="px-2 py-1 text-left">Source</th>
                </tr>
              </thead>
              <tbody>
                {visibleDatasets.map((ds) => {
                  const matched = matchesDrivingVariable(ds);
                  const resources = datasetResources[ds.id];
                  const selCount = resources?.filter((r) => r.selected).length ?? 0;
                  const resCount = ds.resource_count ?? 0;

                  return (
                    <tr
                      key={ds.id}
                      className={`border-b hover:bg-gray-50 ${matched ? 'font-semibold' : ''}`}
                    >
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          className={`${safeId(modelId)}_${safeId(input.id)}_checkbox`}
                          data-datasetid={ds.id}
                          checked={selectedIds.has(ds.id)}
                          onChange={() => toggleDataset(ds.id)}
                          aria-label={`Select dataset ${ds.name}`}
                        />
                      </td>
                      <td className={`px-2 py-1 ${matched ? 'font-bold' : ''}`}>
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href={`/${regionId}/datasets/browse/${ds.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {ds.name}
                        </a>
                        <br />
                        <span className="text-gray-400">
                          {resources ? (
                            resources.length === 0 ? (
                              'This dataset has no resources'
                            ) : (
                              <>
                                {selCount}/{resources.length} resources —{' '}
                                <button
                                  type="button"
                                  className="cursor-pointer text-blue-600 hover:underline"
                                  onClick={() =>
                                    setResourceDialog({
                                      dataset: ds,
                                      resources,
                                      loading: false,
                                    })
                                  }
                                >
                                  Change
                                </button>
                              </>
                            )
                          ) : (
                            <>
                              {resCount} total resources —{' '}
                              <button
                                type="button"
                                className="cursor-pointer text-blue-600 hover:underline"
                                disabled={loadingResources[ds.id]}
                                onClick={() => handleLoadAndToggleResources(ds)}
                              >
                                {loadingResources[ds.id] ? 'Loading…' : 'Filter and select'}
                              </button>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-gray-500">
                        {(ds.categories ?? []).join(', ')}
                      </td>
                      <td className="px-2 py-1 text-gray-500">{ds.region}</td>
                      <td className="px-2 py-1 text-gray-500">
                        {ds.time_period ? (
                          <>
                            {formatDate(ds.time_period.start_date)} —{' '}
                            {formatDate(ds.time_period.end_date)}
                          </>
                        ) : null}
                      </td>
                      <td className="px-2 py-1">
                        {ds.source.url ? (
                          <a
                            href={ds.source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {ds.source.name}
                          </a>
                        ) : (
                          ds.source.name
                        )}
                      </td>
                    </tr>
                  );
                })}

                {hiddenCount > 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-1 text-center text-gray-400">
                      <button
                        type="button"
                        onClick={() => setShowAllDatasets((v) => !v)}
                        className="cursor-pointer text-blue-600 hover:underline"
                      >
                        {showAllDatasets ? 'Hide' : 'Show'} {hiddenCount} dataset
                        {hiddenCount !== 1 ? 's' : ''} that match the input variables but not the
                        input datatype ({inputType}). They might need some data transformation.
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleCompare}
              disabled={selectedIds.size === 0}
              className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
            >
              Compare Selected Data
            </button>
          </div>
        </>
      )}

      {resourceDialog && (
        <ResourceSelectionDialog
          title={`Select resources for: ${resourceDialog.dataset.name}`}
          resources={resourceDialog.resources}
          loading={resourceDialog.loading}
          onClose={() => setResourceDialog(null)}
          onSubmit={handleResourceSubmit}
        />
      )}

      {compareDialog && (
        <ComparisonDialog
          datasets={compareDialog}
          regionId={regionId}
          onClose={() => setCompareDialog(null)}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MintDatasets({
  thread,
  models,
  modelEnsembles,
  threadData,
  regionGeometry,
  onContinue,
  onThreadUpdated,
}: MintDatasetsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  const [editMode, setEditMode] = useState(false);
  const [waiting, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Map: modelId -> inputId -> selected datasets
  const selectionRef = useRef<Record<string, Record<string, DataCatalogDataset[]>>>({});

  // Dataset resource overrides (filtered resources per dataset)
  const resourceOverrideRef = useRef<Record<string, DataCatalogResource[]>>({});

  const [updateThreadData] = useUpdateThreadDataMutation();

  // Determine if the step is done
  const hasSomeBinding = Object.values(modelEnsembles).some((ens) =>
    Object.values(ens.bindings).some((binds) => binds.length > 0),
  );

  const modelIds = Object.keys(models);

  function handleInputChange(modelId: string, inputId: string, datasets: DataCatalogDataset[]) {
    if (!selectionRef.current[modelId]) selectionRef.current[modelId] = {};
    selectionRef.current[modelId][inputId] = datasets;
  }

  function handleResourceOverride(datasetId: string, resources: DataCatalogResource[]) {
    resourceOverrideRef.current[datasetId] = resources;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      // Build data map and model IO bindings
      type DataSliceInput = {
        thread_id: string;
        dataslice: {
          data: {
            id: string;
            name: string;
            region_id: string;
            start_date: string | null;
            end_date: string | null;
            resource_count: number;
            dataset: {
              data: { id: string; name: string };
              on_conflict: { constraint: string; update_columns: string[] };
            };
            resources: {
              data: Array<{
                resource: {
                  data: {
                    id: string;
                    dcid?: string | null;
                    name: string;
                    url: string;
                    start_date?: string | null;
                    end_date?: string | null;
                  };
                  on_conflict: { constraint: string; update_columns: string[] };
                };
                selected: boolean;
              }>;
              on_conflict: { constraint: string; update_columns: string[] };
            };
          };
          on_conflict: { constraint: string; update_columns: string[] };
        };
      };

      const dataSlices: DataSliceInput[] = [];
      const modelIO: Array<{ thread_model_id: string; model_io_id: string; dataslice_id: string }> =
        [];
      let allOk = true;

      for (const modelId of modelIds) {
        const model = models[modelId];
        if (!model) continue;
        const ensemble = modelEnsembles[modelId];

        for (const input of model.input_files.filter((inp) => !inp.value)) {
          // If we have pre-existing bindings and not in edit mode, carry them forward
          const existingBindings = ensemble?.bindings?.[input.id] ?? [];
          if (!editMode && existingBindings.length > 0) {
            // Keep existing — don't add new slices
            existingBindings.forEach((sliceId) => {
              if (ensemble) {
                modelIO.push({
                  thread_model_id: ensemble.id,
                  model_io_id: input.id,
                  dataslice_id: sliceId,
                });
              }
            });
            continue;
          }

          const chosenDatasets = selectionRef.current[modelId]?.[input.id] ?? [];
          if (chosenDatasets.length === 0 && !input.isOptional) {
            allOk = false;
          }

          for (const ds of chosenDatasets) {
            const sliceId = newId();
            const resources = (resourceOverrideRef.current[ds.id] ?? ds.resources).filter(
              (r) => r.selected !== false,
            );

            const resourceObjs = resources.map((r) => ({
              resource: {
                data: {
                  id: hashResourceId(r.url),
                  dcid: r.id,
                  name: r.name,
                  url: r.url,
                  start_date: r.time_period?.start_date?.toISOString().split('T')[0] ?? null,
                  end_date: r.time_period?.end_date?.toISOString().split('T')[0] ?? null,
                },
                on_conflict: { constraint: 'resource_pkey', update_columns: ['name'] },
              },
              selected: true,
            }));

            dataSlices.push({
              thread_id: thread.id,
              dataslice: {
                data: {
                  id: sliceId,
                  name: `${ds.name} for thread: ${thread.name ?? ''}`,
                  region_id: thread.region_id ?? '',
                  start_date: thread.start_date ?? null,
                  end_date: thread.end_date ?? null,
                  resource_count: ds.resource_count ?? resources.length,
                  dataset: {
                    data: { id: ds.id, name: ds.name },
                    on_conflict: { constraint: 'dataset_pkey', update_columns: ['name'] },
                  },
                  resources: {
                    data: resourceObjs,
                    on_conflict: {
                      constraint: 'dataslice_resource_pkey',
                      update_columns: ['dataslice_id'],
                    },
                  },
                },
                on_conflict: { constraint: 'dataslice_pkey', update_columns: ['id'] },
              },
            });

            if (ensemble) {
              modelIO.push({
                thread_model_id: ensemble.id,
                model_io_id: input.id,
                dataslice_id: sliceId,
              });
            }
          }
        }
      }

      if (!allOk) {
        setSaving(false);
        toast({
          title: 'Please select at least one dataset for each required input',
          variant: 'destructive',
        });
        return;
      }

      await updateThreadData({
        variables: {
          threadId: thread.id,
          event: {
            thread_id: thread.id,
            event: 'SELECT_DATA',
            userid: user?.username ?? 'anonymous',
            notes: notesRef.current?.value ?? null,
          },
          data: dataSlices,
          modelIO,
        },
      });

      toast({ title: 'Dataset selections saved' });
      setEditMode(false);
      onThreadUpdated?.();
      onContinue();
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (modelIds.length === 0) {
    return (
      <div data-testid="mint-datasets" className="space-y-2 text-sm text-gray-600">
        <p>This step is for selecting datasets for each of the models that you selected earlier.</p>
        <p className="text-orange-600">Please select model(s) first.</p>
      </div>
    );
  }

  const regionId = thread.region_id ?? '';

  return (
    <div data-testid="mint-datasets">
      <p className="mb-4 text-sm text-gray-600">
        This step is for selecting datasets for each of the models that you selected earlier.
      </p>

      {hasSomeBinding && perm.write && !editMode && (
        <p className="mb-4 text-sm text-gray-500">
          Please click the <span className="font-mono font-bold text-gray-700">✎</span> icon to make
          changes.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Per-model sections */}
          {modelIds.map((modelId) => {
            const model = models[modelId];
            if (!model) return null;
            const ensemble = modelEnsembles[modelId];
            const inputFiles = model.input_files.filter((inp) => !inp.value);
            const fixedInputs = model.input_files.filter((inp) => !!inp.value);

            return (
              <div key={modelId} className="space-y-4 rounded border p-4">
                <h4 className="text-sm font-semibold">
                  <span className="font-normal text-gray-400">MODEL: </span>
                  {model.url ? (
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={model.url}
                      className="text-blue-600 hover:underline"
                    >
                      {model.name}
                    </a>
                  ) : (
                    model.name
                  )}
                </h4>

                {/* Pre-selected (fixed) inputs */}
                <div>
                  <h5 className="mb-1 text-xs font-semibold uppercase text-gray-500">
                    Pre-selected Datasets
                  </h5>
                  {fixedInputs.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      No pre-selected datasets were needed for this model.
                    </p>
                  ) : (
                    <table className="w-full border-collapse border border-gray-200 text-xs">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="px-2 py-1 text-left">Input</th>
                          <th className="px-2 py-1 text-left">Selected File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fixedInputs.map((inp) => (
                          <tr key={inp.id} className="border-b">
                            <td className="px-2 py-1">{inp.name}</td>
                            <td className="px-2 py-1 text-gray-500">
                              {inp.value ? String(inp.value) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* User-selected inputs */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <h5 className="text-xs font-semibold uppercase text-gray-500">
                      User Selected Datasets
                    </h5>
                    {perm.write && hasSomeBinding && !editMode && (
                      <button
                        type="button"
                        aria-label="Edit dataset selections"
                        onClick={() => setEditMode(true)}
                        className="rounded p-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      >
                        ✎
                      </button>
                    )}
                  </div>

                  {inputFiles.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      No additional datasets were needed for this model.
                    </p>
                  ) : (
                    <ul className="space-y-4">
                      {inputFiles.map((inp) => (
                        <li key={inp.id}>
                          <p className="mb-1 text-xs font-medium text-gray-700">
                            Input: {inp.name}
                          </p>
                          <InputDatasetPicker
                            modelId={modelId}
                            input={inp}
                            thread={thread}
                            existingBindings={ensemble?.bindings?.[inp.id] ?? []}
                            threadData={threadData}
                            editMode={editMode || !hasSomeBinding}
                            regionGeometry={regionGeometry}
                            regionId={regionId}
                            onChange={(inputId, datasets) => {
                              handleInputChange(modelId, inputId, datasets);
                              // Track resource overrides if they exist
                              datasets.forEach((ds) => {
                                const overrides = resourceOverrideRef.current[ds.id];
                                if (overrides) {
                                  handleResourceOverride(ds.id, overrides);
                                }
                              });
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {perm.write && (!hasSomeBinding || editMode) ? (
          <div className="mt-6 space-y-4">
            {editMode && (
              <div>
                <label
                  htmlFor="dataset-notes"
                  className="mb-1 block text-xs font-medium text-gray-700"
                >
                  Notes
                </label>
                <textarea
                  id="dataset-notes"
                  ref={notesRef}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Optional notes about this dataset selection…"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              {editMode && (
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  disabled={waiting}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                data-testid="datasets-submit"
                disabled={waiting}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {waiting ? 'Saving…' : 'Select & Continue'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              data-testid="datasets-continue"
              onClick={onContinue}
              disabled={waiting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
