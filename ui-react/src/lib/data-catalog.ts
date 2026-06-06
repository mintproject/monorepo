/**
 * Data Catalog REST API client.
 *
 * The MINT Data Catalog is a separate REST API (not Hasura/GraphQL).
 * This module provides typed fetch helpers and data-shaping utilities
 * that mirror the legacy ui/src/screens/datasets/actions.ts behaviour.
 *
 * Endpoint: window.__MINT_CONFIG__.DATA_CATALOG_API (or VITE_DATA_CATALOG_API)
 */

// ─── Runtime config ───────────────────────────────────────────────────────────

export function getDataCatalogUrl(): string {
  return (
    window.__MINT_CONFIG__?.DATA_CATALOG_API ??
    import.meta.env.VITE_DATA_CATALOG_API ??
    'https://datacatalog.mint.isi.edu/api/v1'
  );
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface DataCatalogTimePeriod {
  start_date: Date | null;
  end_date: Date | null;
}

export interface DataCatalogSource {
  name: string;
  url: string;
  type: string;
}

export interface DataCatalogResource {
  id: string;
  name: string;
  url: string;
  time_period?: DataCatalogTimePeriod | null;
  selected?: boolean;
}

export interface DataCatalogDataset {
  id: string;
  name: string;
  region: string;
  variables: string[];
  datatype: string;
  time_period: DataCatalogTimePeriod | null;
  description: string;
  version: string;
  limitations: string;
  source: DataCatalogSource;
  categories?: string[];
  resource_count?: number;
  resources: DataCatalogResource[];
  resources_loaded?: boolean;
}

export interface DataCatalogDataslice {
  id: string;
  name: string;
  dataset: DataCatalogDataset;
  total_resources?: number;
  selected_resources?: number;
  resources: DataCatalogResource[];
  resources_loaded?: boolean;
  time_period: DataCatalogTimePeriod | null;
}

export interface DatasetQueryParams {
  standard_variable_names__in?: string[];
  spatial_coverage__intersects?: unknown;
  start_time__gte?: string;
  end_time__lte?: string;
  limit?: number;
}

// ─── Internal shape helpers ───────────────────────────────────────────────────

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

function datasetFromDCResponse(
  ds: Record<string, unknown>,
  variables: string[],
): DataCatalogDataset {
  const dmeta = (ds['dataset_metadata'] as Record<string, unknown>) ?? {};
  const tc = dmeta['temporal_coverage'] as Record<string, unknown> | undefined;
  return {
    id: (ds['dataset_id'] as string) ?? '',
    name: (ds['dataset_name'] as string) ?? '',
    region: '',
    variables,
    datatype:
      (dmeta['datatype'] as string) ?? (dmeta['data_type'] as string) ?? '',
    time_period: tc
      ? {
          start_date: parseDate(tc['start_time']),
          end_date: parseDate(tc['end_time']),
        }
      : null,
    description: (dmeta['dataset_description'] as string) ?? '',
    version: (dmeta['version'] as string) ?? '',
    limitations: (dmeta['limitations'] as string) ?? '',
    source: {
      name: (dmeta['source'] as string) ?? '',
      url: (dmeta['source_url'] as string) ?? '',
      type: (dmeta['source_type'] as string) ?? '',
    },
    categories: (dmeta['category_tags'] as string[]) ?? [],
    resource_count: (dmeta['resource_count'] as number) ?? 0,
    resources: [],
    resources_loaded: false,
  };
}

function resourceFromDCResponse(
  row: Record<string, unknown>,
): DataCatalogResource {
  const dmeta = (row['resource_metadata'] as Record<string, unknown>) ?? {};
  const tc = dmeta['temporal_coverage'] as Record<string, unknown> | undefined;
  return {
    id: (row['resource_id'] as string) ?? '',
    name: (row['resource_name'] as string) ?? '',
    url: (dmeta['resource_data_url'] as string) ?? '',
    time_period: tc
      ? {
          start_date: parseDate(tc['start_time']),
          end_date: parseDate(tc['end_time']),
        }
      : null,
    selected: true,
  };
}

// ─── API functions ────────────────────────────────────────────────────────────

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Data Catalog request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Find datasets by standard variable names, optional spatial + temporal filters.
 */
export async function findDatasets(
  params: DatasetQueryParams,
): Promise<DataCatalogDataset[]> {
  const baseUrl = getDataCatalogUrl();
  const obj = await post<Record<string, unknown>>(
    `${baseUrl}/datasets/find`,
    params,
  );
  if (!obj || obj['result'] !== 'success') return [];
  const rawList = (obj['datasets'] as Record<string, unknown>[]) ?? [];
  const variables =
    (params.standard_variable_names__in as string[] | undefined) ?? [];
  return rawList.map((ds) => datasetFromDCResponse(ds, variables));
}

/**
 * Find datasets that match a set of standard variable names for a thread input.
 */
export async function findDatasetsByVariables(params: {
  variableNames: string[];
  regionGeometry?: unknown;
  startDate?: Date | null;
  endDate?: Date | null;
}): Promise<DataCatalogDataset[]> {
  if (!params.variableNames.length) return [];

  const query: DatasetQueryParams = {
    standard_variable_names__in: params.variableNames,
    limit: 1000,
  };

  if (params.regionGeometry) {
    query.spatial_coverage__intersects = params.regionGeometry;
  }
  if (params.startDate) {
    query.end_time__lte = params.startDate.toISOString().replace(/\.\d{3}Z$/, '');
  }
  if (params.endDate) {
    query.start_time__gte = params.endDate.toISOString().replace(/\.\d{3}Z$/, '');
  }

  return findDatasets(query);
}

/**
 * Load resources for a dataset, filtered by region and date range.
 */
export async function loadDatasetResources(params: {
  datasetId: string;
  regionGeometry?: unknown;
  startDate?: Date | null;
  endDate?: Date | null;
}): Promise<DataCatalogResource[]> {
  const baseUrl = getDataCatalogUrl();
  const filter: Record<string, unknown> = {};
  if (params.regionGeometry) {
    filter['spatial_coverage__intersects'] = params.regionGeometry;
  }
  if (params.startDate) {
    filter['end_time__gte'] = params.startDate.toISOString().replace(/\.\d{3}Z$/, '');
  }
  if (params.endDate) {
    filter['start_time__lte'] = params.endDate.toISOString().replace(/\.\d{3}Z$/, '');
  }

  const obj = await post<Record<string, unknown>>(
    `${baseUrl}/datasets/dataset_resources`,
    {
      dataset_id: params.datasetId,
      filter,
      limit: 5000,
    },
  );

  if (!obj || !obj['resources']) return [];
  const rawList = obj['resources'] as Record<string, unknown>[];
  const resources = rawList.map(resourceFromDCResponse);
  // Sort by name
  resources.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return resources;
}
