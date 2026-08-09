/**
 * Data Catalog client, backed by CKAN.
 *
 * The data catalog is a CKAN instance (not Hasura/GraphQL). This module
 * provides typed helpers and data-shaping utilities that mirror the legacy
 * ui/src/screens/datasets/actions.ts behaviour, projected onto CKAN's Action
 * API. See lib/datasets/ckan.ts for the transport and the concept mapping.
 *
 * Endpoint: resolved via getDataCatalogApiUrl() in lib/config.ts, which reads
 * window.__MINT_CONFIG__.DATA_CATALOG_API (or VITE_DATA_CATALOG_API). The
 * transport in lib/datasets/ckan.ts owns that lookup.
 */

import {
  cleanString,
  overlapsDateRange,
  packagesMatchingVariables,
  packageTags,
  packageTimePeriod,
  parseDate as parseCkanDate,
  resourceMatchesVariables,
  searchAllPackages,
  showPackage,
  type CkanPackage,
  type CkanResource,
} from './datasets/ckan';

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

function datasetFromCkanPackage(pkg: CkanPackage, variables: string[]): DataCatalogDataset {
  const resources = pkg.resources ?? [];
  return {
    // Prefer the name slug: it is what CKAN URLs use and package_show accepts.
    id: cleanString(pkg.name) || cleanString(pkg.id),
    name: cleanString(pkg.title) || cleanString(pkg.name),
    region: '',
    variables,
    // CKAN has no datatype field; resource formats are the closest analogue.
    datatype: cleanString(resources[0]?.format),
    time_period: packageTimePeriod(pkg),
    description: cleanString(pkg.notes),
    version: cleanString(pkg.version),
    // CKAN models usage restrictions as a licence rather than free-text limitations.
    limitations: cleanString(pkg.license_title),
    source: {
      name: cleanString(pkg.organization?.title ?? pkg.organization?.name ?? pkg.author),
      url: cleanString(pkg.url),
      type: '',
    },
    categories: packageTags(pkg),
    resource_count: pkg.num_resources ?? resources.length,
    resources: [],
    resources_loaded: false,
  };
}

/**
 * CKAN resources carry no coverage metadata of their own, so they inherit the
 * parent package's temporal coverage.
 */
function resourceFromCkanResource(row: CkanResource, parent: CkanPackage): DataCatalogResource {
  const created = parseCkanDate(row.last_modified) ?? parseCkanDate(row.created);
  const inherited = packageTimePeriod(parent);
  return {
    id: cleanString(row.id),
    name: cleanString(row.name) || cleanString(row.description) || cleanString(row.format),
    url: cleanString(row.url),
    time_period: inherited ?? (created ? { start_date: created, end_date: created } : null),
    selected: true,
  };
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Find datasets by standard variable names, optional spatial + temporal filters.
 *
 * The variable names are NOT sent as a CKAN `q`. They live on each resource in
 * `mint_standard_variables`, which Solr neither indexes nor tokenises usefully,
 * so a free-text query matches prose instead of the annotation. Fetch the
 * bbox-filtered catalog and match the field here, as the legacy Lit client does.
 */
export async function findDatasets(params: DatasetQueryParams): Promise<DataCatalogDataset[]> {
  const variables = params.standard_variable_names__in ?? [];
  const boundingBox = toBoundingBox(params.spatial_coverage__intersects);

  const packages = await searchAllPackages({
    ...(boundingBox ? { boundingBox } : {}),
  });

  // CKAN cannot filter reliably on temporal extras, so narrow the window here.
  const start = params.end_time__lte ? new Date(params.end_time__lte) : null;
  const end = params.start_time__gte ? new Date(params.start_time__gte) : null;

  const matched = packagesMatchingVariables(
    packages.filter((pkg) => overlapsDateRange(pkg, start, end)),
    variables,
  );

  // `limit` caps the datasets handed back, not the pages fetched: the whole
  // catalog has to be read before the variable filter can be applied.
  const capped = params.limit ? matched.slice(0, params.limit) : matched;
  return capped.map((pkg) => datasetFromCkanPackage(pkg, variables));
}

/**
 * Coax the legacy `spatial_coverage__intersects` payload into a bounding box.
 * Callers pass either a bare {xmin,xmax,ymin,ymax} or the MINT
 * `{ type: 'BoundingBox', value: {...} }` envelope; anything else is ignored.
 */
function toBoundingBox(
  raw: unknown,
): { xmin: number; xmax: number; ymin: number; ymax: number } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const candidate = (
    obj['value'] && typeof obj['value'] === 'object' ? obj['value'] : obj
  ) as Record<string, unknown>;

  const coords = ['xmin', 'xmax', 'ymin', 'ymax'].map((k) => Number(candidate[k]));
  if (coords.some((n) => !isFinite(n))) return undefined;
  const [xmin, xmax, ymin, ymax] = coords as [number, number, number, number];
  return { xmin, xmax, ymin, ymax };
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
 * Load resources for a dataset, narrowed to the standard variables asked for.
 */
export async function loadDatasetResources(params: {
  datasetId: string;
  variableNames?: string[];
  regionGeometry?: unknown;
  startDate?: Date | null;
  endDate?: Date | null;
}): Promise<DataCatalogResource[]> {
  // Region and date filters cannot be applied: CKAN resources carry no coverage
  // of their own. The standard variable filter can be, and must be — a dataset
  // matches because *some* of its resources carry the variable, so handing back
  // all of them would bind files the model input cannot read.
  const pkg = await showPackage(params.datasetId);
  const variables = (params.variableNames ?? []).filter(Boolean);
  const resources = (pkg.resources ?? [])
    .filter((r) => resourceMatchesVariables(r, variables))
    .map((r) => resourceFromCkanResource(r, pkg));
  // Sort by name
  resources.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return resources;
}
