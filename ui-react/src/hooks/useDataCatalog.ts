/**
 * useDataCatalogDatasets — fetch datasets from the Data Catalog REST API
 * for a specific model input (identified by its standard variable names).
 *
 * Returns { datasets, loading, error, reload }.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DataCatalogDataset,
  DataCatalogResource,
  findAvailableDatasetVariables,
  findDatasetsByVariables,
  loadDatasetResources,
} from '@/lib/data-catalog';

export interface UseDataCatalogDatasetsOptions {
  variableNames: string[];
  regionGeometry?: unknown;
  startDate?: Date | null;
  endDate?: Date | null;
  /** Keep outside-range candidates visible for temporal comparison. */
  includeOutsideDateRange?: boolean;
  /** Skip fetching (e.g. when bindings already exist and not in edit mode) */
  skip?: boolean;
}

export interface UseDataCatalogDatasetsResult {
  datasets: DataCatalogDataset[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useDataCatalogDatasets(
  opts: UseDataCatalogDatasetsOptions,
): UseDataCatalogDatasetsResult {
  const [datasets, setDatasets] = useState<DataCatalogDataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    if (opts.skip || !opts.variableNames.length) {
      setDatasets([]);
      setLoading(false);
      return;
    }

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    try {
      const results = await findDatasetsByVariables({
        variableNames: opts.variableNames,
        regionGeometry: opts.regionGeometry,
        startDate: opts.startDate,
        endDate: opts.endDate,
        includeOutsideDateRange: opts.includeOutsideDateRange,
      });
      setDatasets(results);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(opts.variableNames),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(opts.regionGeometry),
    opts.startDate?.toISOString(),
    opts.endDate?.toISOString(),
    opts.includeOutsideDateRange,
    opts.skip,
  ]);

  useEffect(() => {
    void fetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetch]);

  return { datasets, loading, error, reload: fetch };
}

export interface UseDataCatalogVariableAvailabilityOptions {
  variableNames: string[];
  regionGeometry?: unknown;
  startDate?: Date | null;
  endDate?: Date | null;
  skip?: boolean;
}

export interface UseDataCatalogVariableAvailabilityResult {
  availableVariables: Set<string>;
  loading: boolean;
  error: string | null;
}

/** Check which standard-variable inputs have usable data for a scope. */
export function useDataCatalogVariableAvailability(
  opts: UseDataCatalogVariableAvailabilityOptions,
): UseDataCatalogVariableAvailabilityResult {
  const [availableVariables, setAvailableVariables] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    if (opts.skip || opts.variableNames.length === 0) {
      setAvailableVariables(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const available = await findAvailableDatasetVariables({
        variableNames: opts.variableNames,
        regionGeometry: opts.regionGeometry,
        startDate: opts.startDate,
        endDate: opts.endDate,
      });
      setAvailableVariables(new Set(available));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
    // The serialized keys intentionally control refetching when callers recreate
    // equivalent arrays/geometries on render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(opts.variableNames),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(opts.regionGeometry),
    opts.startDate?.toISOString(),
    opts.endDate?.toISOString(),
    opts.skip,
  ]);

  useEffect(() => {
    void fetchAvailability();
  }, [fetchAvailability]);

  return { availableVariables, loading, error };
}

// ─── Resource loading hook ────────────────────────────────────────────────────

export interface UseDatasetResourcesResult {
  resources: DataCatalogResource[];
  loading: boolean;
  error: string | null;
  load: () => void;
}

export function useDatasetResources(params: {
  datasetId: string | null;
  variableNames?: string[];
  regionGeometry?: unknown;
  startDate?: Date | null;
  endDate?: Date | null;
}): UseDatasetResourcesResult {
  const [resources, setResources] = useState<DataCatalogResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!params.datasetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await loadDatasetResources({
        datasetId: params.datasetId,
        ...(params.variableNames ? { variableNames: params.variableNames } : {}),
        regionGeometry: params.regionGeometry,
        startDate: params.startDate,
        endDate: params.endDate,
      });
      // All resources selected by default
      setResources(res.map((r) => ({ ...r, selected: true })));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [
    params.datasetId,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(params.variableNames),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(params.regionGeometry),
    params.startDate?.toISOString(),
    params.endDate?.toISOString(),
  ]);

  return { resources, loading, error, load };
}
