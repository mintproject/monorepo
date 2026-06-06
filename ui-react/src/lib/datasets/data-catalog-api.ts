/**
 * Data Catalog REST API client.
 *
 * All functions call the MINT Data Catalog API and return strongly-typed
 * domain objects. The base URL is read from the runtime config on every call.
 */

import { getDataCatalogApiUrl } from '../config';
import type { Dataset, DataResource, DatasetQueryParameters, SpatialCoverage } from './types';

// ---------------------------------------------------------------------------
// Response mappers
// ---------------------------------------------------------------------------

function mapSpatialCoverage(raw: unknown): SpatialCoverage | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  return raw as SpatialCoverage;
}

function mapDataResource(row: Record<string, unknown>): DataResource {
  const meta = (row['resource_metadata'] as Record<string, unknown>) ?? {};
  const tcover = meta['temporal_coverage'] as Record<string, string> | undefined;
  const scover = meta['spatial_coverage'];
  return {
    id: String(row['resource_id'] ?? ''),
    name: String(row['resource_name'] ?? ''),
    url: String(row['resource_data_url'] ?? ''),
    time_period: tcover
      ? {
          start_date: tcover['start_time'] ? new Date(tcover['start_time']) : null,
          end_date: tcover['end_time'] ? new Date(tcover['end_time']) : null,
        }
      : undefined,
    spatial_coverage: mapSpatialCoverage(scover),
    selected: true,
  };
}

function mapDatasetFromSearch(
  ds: Record<string, unknown>,
  queryParameters: DatasetQueryParameters,
): Dataset {
  const dmeta = (ds['dataset_metadata'] as Record<string, unknown>) ?? {};
  const tcover = dmeta['temporal_coverage'] as Record<string, string> | undefined;
  return {
    id: String(ds['dataset_id'] ?? ''),
    name: String(ds['dataset_name'] ?? ''),
    region: '',
    variables: queryParameters.variables ?? [],
    datatype: String(dmeta['datatype'] ?? dmeta['data_type'] ?? ''),
    time_period: tcover
      ? {
          start_date: tcover['start_time'] ? new Date(tcover['start_time']) : null,
          end_date: tcover['end_time'] ? new Date(tcover['end_time']) : null,
        }
      : null,
    description: String(dmeta['dataset_description'] ?? ''),
    version: String(dmeta['version'] ?? ''),
    limitations: String(dmeta['limitations'] ?? ''),
    source: {
      name: String(dmeta['source'] ?? ''),
      url: String(dmeta['source_url'] ?? ''),
      type: String(dmeta['source_type'] ?? ''),
    },
    is_cached: Boolean(dmeta['is_cached']),
    resource_repr: dmeta['resource_repr'] ?? null,
    dataset_repr: dmeta['dataset_repr'] ?? null,
    resource_count: Number(dmeta['resource_count'] ?? 0),
    spatial_coverage: mapSpatialCoverage(dmeta['dataset_spatial_coverage']),
    categories: (dmeta['category_tags'] as string[]) ?? [],
    resources: [],
  };
}

function mapDatasetFromDetail(raw: Record<string, unknown>): Dataset {
  const meta = (raw['metadata'] as Record<string, unknown>) ?? {};
  const tcover = meta['temporal_coverage'] as Record<string, string> | undefined;
  return {
    id: String(raw['dataset_id'] ?? ''),
    name: String(raw['name'] ?? ''),
    description: String(raw['description'] ?? ''),
    region: '',
    variables: [],
    datatype: String(meta['datatype'] ?? ''),
    time_period: tcover
      ? {
          start_date: tcover['start_time'] ? new Date(tcover['start_time']) : null,
          end_date: tcover['end_time'] ? new Date(tcover['end_time']) : null,
        }
      : null,
    version: String(meta['version'] ?? ''),
    limitations: String(meta['limitations'] ?? ''),
    source: {
      name: String(meta['source'] ?? ''),
      url: String(meta['source_url'] ?? meta['source'] ?? ''),
      type: String(meta['source_type'] ?? ''),
    },
    categories: (raw['categories'] as string[]) ?? [],
    is_cached: Boolean(meta['is_cached']),
    resource_repr: meta['resource_repr'] ?? null,
    dataset_repr: meta['dataset_repr'] ?? null,
    resource_count: Number(meta['resource_count'] ?? 0),
    spatial_coverage: mapSpatialCoverage(meta['dataset_spatial_coverage']),
    resources: [],
  };
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Search datasets by name or standard variable names.
 */
export async function searchDatasets(params: DatasetQueryParameters): Promise<Dataset[]> {
  const baseUrl = getDataCatalogApiUrl();
  const body: Record<string, unknown> = {};

  if (params.name) body['name'] = params.name;
  if (params.variables) body['standard_variable_names__in'] = params.variables;
  if (params.spatialCoverage) {
    body['spatial_coverage__intersects'] = {
      type: 'BoundingBox',
      value: params.spatialCoverage,
    };
  }

  const resp = await fetch(`${baseUrl}/datasets/find`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query_parameters: body }),
  });

  if (!resp.ok) {
    throw new Error(`Data catalog search failed: ${resp.statusText}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const datasets = (data['datasets'] as Record<string, unknown>[]) ?? [];
  return datasets.map((ds) => mapDatasetFromSearch(ds, params));
}

/**
 * Fetch full dataset details including resources.
 */
export async function fetchDatasetDetail(datasetId: string): Promise<Dataset> {
  const baseUrl = getDataCatalogApiUrl();

  const resp = await fetch(`${baseUrl}/datasets/${encodeURIComponent(datasetId)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!resp.ok) {
    throw new Error(`Dataset detail fetch failed: ${resp.statusText}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const dataset = mapDatasetFromDetail((data['dataset'] as Record<string, unknown>) ?? data);

  // Attach resources if present
  const resourcesRaw =
    ((data['dataset'] as Record<string, unknown>)?.['resources'] as Record<string, unknown>[]) ??
    [];
  dataset.resources = resourcesRaw.map(mapDataResource);

  return dataset;
}

/**
 * Fetch resources for a specific dataset (filtered by region bounding box if provided).
 */
export async function fetchDatasetResources(
  datasetId: string,
  region?: { bounding_box?: { xmin: number; xmax: number; ymin: number; ymax: number } },
): Promise<DataResource[]> {
  const baseUrl = getDataCatalogApiUrl();
  const body: Record<string, unknown> = {
    dataset_id: datasetId,
    limit: 100,
  };

  if (region?.bounding_box) {
    body['spatial_coverage__intersects'] = {
      type: 'BoundingBox',
      value: region.bounding_box,
    };
  }

  const resp = await fetch(`${baseUrl}/resources/find`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`Dataset resources fetch failed: ${resp.statusText}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const resources = (data['resources'] as Record<string, unknown>[]) ?? [];
  return resources.map(mapDataResource);
}
