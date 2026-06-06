/**
 * MintParameters — parameter sweep configuration for the execution pipeline.
 *
 * 1:1 port of the legacy LitElement MintParameters component.
 * Lets the domain scientist specify values for adjustable model parameters,
 * supporting comma-separated multi-value sweeps to generate ensemble runs.
 *
 * Legacy: ui/src/screens/modeling/thread/mint-parameters.ts
 */
import { ChevronDown, Edit2 } from 'lucide-react';
import { useRef, useState } from 'react';

import {
  ExecutionSummaryMap,
  ModelEnsembleMap,
  ModelParameter,
  ThreadExecutionData,
} from '@/graphql/generated/execution';

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_PARAMETER_COMBINATIONS = 100000;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function totalConfigs(
  bindings: Record<string, string[]>,
  parameters: ModelParameter[],
): number {
  return parameters
    .filter((p) => !p.value)
    .reduce((acc, p) => {
      const vals = bindings[p.id ?? ''] ?? [];
      return acc * Math.max(vals.length, 1);
    }, 1);
}

function formatDate(ts: number): string {
  const date = new Date(ts);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MintParametersProps {
  threadData: ThreadExecutionData;
  canWrite: boolean;
  canExecute: boolean;
  problemStartDate?: number | null;
  problemEndDate?: number | null;
  onSave: (
    modelEnsembles: ModelEnsembleMap,
    executionSummary: ExecutionSummaryMap,
    notes: string,
  ) => Promise<void>;
  onContinue: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MintParameters({
  threadData,
  canWrite,
  problemStartDate,
  problemEndDate,
  onSave,
  onContinue,
}: MintParametersProps) {
  const modelIds = Object.keys(threadData.models ?? {});
  const isConfigured = modelIds.length > 0;

  // Derive whether parameters have been selected: every adjustable param has a binding
  const isDone =
    isConfigured &&
    modelIds.every((mid) => {
      const model = threadData.models[mid]!;
      const bindings = threadData.model_ensembles[mid]?.bindings ?? {};
      return model.input_parameters
        .filter((p) => !p.value)
        .every((p) => (bindings[p.id ?? ''] ?? []).length > 0);
    });

  const [editMode, setEditMode] = useState(!isDone);
  const [waiting, setWaiting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRefs = useRef<Record<string, HTMLFormElement | null>>({});
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // ─ Validate a single input value ──────────────────────────────────────────
  function validateValues(param: ModelParameter, values: string[]): string | null {
    for (const v of values) {
      if (!v) continue;
      if (param.type === 'string' && param.accepted_values) {
        if (!param.accepted_values.includes(v)) {
          return `Accepted values: ${param.accepted_values.join(', ')}`;
        }
      } else if (param.type === 'int') {
        const n = parseInt(v, 10);
        if (param.min != null && n < parseInt(param.min, 10))
          return `Min is ${param.min}`;
        if (param.max != null && n > parseInt(param.max, 10))
          return `Max is ${param.max}`;
      } else if (param.type === 'float') {
        const n = parseFloat(v);
        if (param.min != null && n < parseFloat(param.min))
          return `Min is ${param.min}`;
        if (param.max != null && n > parseFloat(param.max))
          return `Max is ${param.max}`;
      }
    }
    return null;
  }

  // ─ Parse values from the form for a parameter ─────────────────────────────
  function getParamValues(modelId: string, param: ModelParameter): string[] {
    const form = formRefs.current[modelId];
    if (!form) return [];
    const el = form.elements.namedItem(param.id ?? '') as HTMLInputElement | null;
    const raw = el?.value ?? param.default ?? '';
    return raw
      .split(/\s*,\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // ─ Save handler ───────────────────────────────────────────────────────────
  async function handleSave() {
    const newErrors: Record<string, string> = {};
    const newEnsembles: ModelEnsembleMap = {
      ...Object.fromEntries(
        Object.entries(threadData.model_ensembles).map(([k, v]) => [
          k,
          { ...v, bindings: { ...v.bindings } },
        ]),
      ),
    };
    const newSummary: ExecutionSummaryMap = {};
    let allOk = true;

    for (const mid of modelIds) {
      const model = threadData.models[mid]!;
      const adjustable = model.input_parameters.filter((p) => !p.value);
      const bindings = newEnsembles[mid]?.bindings ?? {};

      for (const param of adjustable) {
        const current = bindings[param.id ?? ''];
        // If not in edit mode and already bound, keep existing
        if (!editMode && current && current.length > 0) continue;

        const vals = getParamValues(mid, param);
        const err = validateValues(param, vals);
        if (err) {
          newErrors[`${mid}::${param.id}`] = err;
          allOk = false;
        } else {
          if (!newEnsembles[mid]) {
            newEnsembles[mid] = { id: threadData.model_ensembles[mid]?.id ?? '', bindings: {} };
          }
          newEnsembles[mid]!.bindings[param.id ?? ''] = vals;
        }
      }

      const cfg = totalConfigs(newEnsembles[mid]?.bindings ?? {}, model.input_parameters);
      if (cfg > MAX_PARAMETER_COMBINATIONS) {
        alert(
          `Too many parameter combinations (${cfg}) for the model '${model.name}'. Please reduce the number of values.`,
        );
        allOk = false;
      }

      newSummary[mid] = {
        total_runs: cfg,
        submitted_runs: 0,
        failed_runs: 0,
        successful_runs: 0,
      };
    }

    setErrors(newErrors);
    if (!allOk) return;

    setWaiting(true);
    try {
      await onSave(newEnsembles, newSummary, notesRef.current?.value ?? '');
      setEditMode(false);
    } finally {
      setWaiting(false);
    }
  }

  // ─ Get default value for a param (handles region_geojson, dates) ──────────
  function getDefaultDisplayValue(param: ModelParameter): string {
    if (param.default === '__region_geojson') return 'Region GeoJSON';
    if (
      param.type?.includes('StartDate') &&
      problemStartDate
    )
      return formatDate(problemStartDate);
    if (
      param.type?.includes('EndDate') &&
      problemEndDate
    )
      return formatDate(problemEndDate);
    return param.default ?? '';
  }

  // ─ No models guard ────────────────────────────────────────────────────────
  if (!isConfigured) {
    return (
      <div data-testid="mint-parameters">
        <p className="text-sm text-gray-600 mb-2">
          Please specify the values for the adjustable parameters.
        </p>
        <p className="text-sm text-gray-500">Please select model(s) first.</p>
      </div>
    );
  }

  // ─ Latest events ──────────────────────────────────────────────────────────

  return (
    <div data-testid="mint-parameters">
      <p className="text-sm text-gray-600 mb-4">
        This step is for specifying values for the adjustable parameters of the models that
        you selected earlier.
      </p>

      {isDone && canWrite && !editMode && (
        <p className="text-sm text-gray-500 mb-4">
          Please click on the <span className="font-mono">✎</span> icon to make changes
          and run the model.
        </p>
      )}

      {/* ── Setup Models ── */}
      <div className="border rounded-md mb-4">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b rounded-t-md">
          <h3 className="text-sm font-semibold">Setup Models</h3>
          {canWrite && !editMode && (
            <button
              type="button"
              aria-label="Edit parameters"
              data-testid="edit-parameters-btn"
              onClick={() => setEditMode(true)}
              className="p-1 rounded hover:bg-gray-200 text-gray-500"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <ul className="divide-y">
          {modelIds.map((mid) => {
            const model = threadData.models[mid]!;
            const ensemble = threadData.model_ensembles[mid] ?? { id: '', bindings: {} };

            const fixedParams = model.input_parameters
              .filter((p) => !!p.value)
              .sort((a, b) => {
                if (a.position != null && b.position != null) return a.position - b.position;
                return (a.name ?? '').localeCompare(b.name ?? '');
              });

            const adjustableParams = model.input_parameters
              .filter((p) => !p.value)
              .sort((a, b) => {
                if (a.position != null && b.position != null) return a.position - b.position;
                return (a.name ?? '').localeCompare(b.name ?? '');
              });

            return (
              <li key={mid} className="px-4 py-3">
                <h4 className="text-sm font-medium mb-2">
                  Model: <span className="text-blue-700">{model.name}</span>
                </h4>
                <ul className="space-y-3">
                  {/* Fixed (expert-set) parameters */}
                  {fixedParams.length > 0 && (
                    <li>
                      <p className="text-xs font-semibold mb-1">
                        Expert modeler has selected the following parameters:
                      </p>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="text-left px-2 py-1 font-semibold w-3/5">
                              Adjustable Parameter
                            </th>
                            <th className="text-left px-2 py-1 font-semibold">Values</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fixedParams.map((p) => (
                            <tr key={p.id} className="odd:bg-white even:bg-gray-50">
                              <td className="px-2 py-1">
                                <div className="font-medium">
                                  {(p.name ?? '').replace(/_/g, ' ')}
                                </div>
                                {p.description && (
                                  <div className="text-gray-500">{p.description}</div>
                                )}
                              </td>
                              <td className="px-2 py-1">
                                {p.default === '__region_geojson'
                                  ? 'Region GeoJSON'
                                  : p.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </li>
                  )}

                  {/* Adjustable parameters */}
                  {adjustableParams.length > 0 ? (
                    <li>
                      {editMode && (
                        <p className="text-xs text-gray-600 mb-1">
                          Setup the model by specifying values below. You can enter more than
                          one value (comma separated) if you want several runs.
                        </p>
                      )}
                      {model.usage_notes && (
                        <p className="text-xs text-gray-500 mb-1">{model.usage_notes}</p>
                      )}
                      <form
                        ref={(el) => { formRefs.current[mid] = el; }}
                        data-testid={`param-form-${mid}`}
                      >
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="text-left px-2 py-1 font-semibold w-3/5">
                                Adjustable Parameter
                              </th>
                              <th className="text-left px-2 py-1 font-semibold">Values</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adjustableParams.map((p) => {
                              const bindings = ensemble.bindings[p.id ?? ''] ?? [];
                              const displayValue = bindings.join(', ');
                              const isRegionGeoJson = p.default === '__region_geojson';
                              const errKey = `${mid}::${p.id}`;

                              return (
                                <tr key={p.id} className="odd:bg-white even:bg-gray-50">
                                  <td className="px-2 py-1">
                                    <div className="font-medium">
                                      {(p.name ?? '').replace(/_/g, ' ')}
                                    </div>
                                    {p.description && (
                                      <div className="text-gray-500">{p.description}</div>
                                    )}
                                    {(p.min != null || p.max != null) && (
                                      <div className="text-gray-400">
                                        {p.min != null && p.max != null
                                          ? `Range: ${p.min} – ${p.max}.`
                                          : p.min != null
                                          ? `Min: ${p.min}.`
                                          : `Max: ${p.max}.`}
                                        {p.default && ` Default: ${p.default}`}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-2 py-1">
                                    {!editMode ? (
                                      <span>{displayValue || '—'}</span>
                                    ) : isRegionGeoJson ? (
                                      <span className="text-gray-500">Region GeoJSON</span>
                                    ) : (
                                      <div>
                                        <input
                                          type="text"
                                          name={p.id ?? ''}
                                          data-testid={`param-input-${p.id}`}
                                          defaultValue={displayValue}
                                          placeholder={getDefaultDisplayValue(p)}
                                          className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                                        />
                                        {errors[errKey] && (
                                          <div
                                            className="text-red-500 text-xs mt-0.5"
                                            data-testid={`param-error-${p.id}`}
                                          >
                                            {errors[errKey]}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </form>
                    </li>
                  ) : (
                    <li>
                      <p className="text-xs font-semibold text-gray-500">
                        There are no adjustments possible for this model.
                      </p>
                    </li>
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Footer ── */}
      {canWrite && (!isDone || editMode) ? (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end gap-2">
            {editMode && (
              <button
                type="button"
                onClick={() => setEditMode(false)}
                disabled={waiting}
                className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              data-testid="parameters-save-btn"
              onClick={() => void handleSave()}
              disabled={waiting}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {waiting ? (
                <>
                  Saving…{' '}
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </>
              ) : (
                'Select & Continue'
              )}
            </button>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
            <textarea
              ref={notesRef}
              className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              rows={3}
              data-testid="parameters-notes"
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            data-testid="parameters-continue-btn"
            onClick={onContinue}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Continue
            <ChevronDown className="inline ml-1 h-4 w-4 -rotate-90" />
          </button>
        </div>
      )}
    </div>
  );
}
