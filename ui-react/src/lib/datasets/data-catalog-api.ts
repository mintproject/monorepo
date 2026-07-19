/**
 * Data Catalog client, backed by CKAN.
 *
 * All functions call the CKAN Action API (see ./ckan) and return strongly-typed
 * domain objects. The base URL is read from the runtime config on every call.
 */

import {
  buildSearchQuery,
  cleanString,
  packageSpatialCoverage,
  packageTags,
  packageTimePeriod,
  parseDate,
  searchPackages,
  showPackage,
  type CkanPackage,
  type CkanResource,
} from './ckan';
import type { Dataset, DataResource, DatasetQueryParameters } from './types';

// ---------------------------------------------------------------------------
// Response mappers
// ---------------------------------------------------------------------------

/**
 * CKAN resources carry no coverage metadata of their own, so they inherit the
 * parent package's spatial and temporal coverage.
 */
function mapDataResource(row: CkanResource, parent?: CkanPackage): DataResource {
  const created = parseDate(row.last_modified) ?? parseDate(row.created);
  const inherited = parent ? packageTimePeriod(parent) : null;
  const spatial = parent ? packageSpatialCoverage(parent) : undefined;

  return {
    id: cleanString(row.id),
    name: cleanString(row.name) || cleanString(row.description) || cleanString(row.format),
    url: cleanString(row.url),
    time_period: inherited ?? (created ? { start_date: created, end_date: created } : undefined),
    ...(spatial ? { spatial_coverage: spatial } : {}),
    selected: true,
  };
}

function mapDataset(pkg: CkanPackage, variables: string[] = []): Dataset {
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
    is_cached: false,
    resource_repr: null,
    dataset_repr: null,
    resource_count: pkg.num_resources ?? resources.length,
    spatial_coverage: packageSpatialCoverage(pkg),
    resources: resources.map((r) => mapDataResource(r, pkg)),
  };
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Search datasets by name and/or standard variable names.
 *
 * CKAN has no standard-variable vocabulary, so variable names are matched as
 * free text against title, description and tags.
 */
export async function searchDatasets(params: DatasetQueryParameters): Promise<Dataset[]> {
  const query = buildSearchQuery({
    ...(params.name ? { name: params.name } : {}),
    ...(params.variables ? { variables: params.variables } : {}),
  });

  const packages = await searchPackages({
    ...(query ? { q: query } : {}),
    ...(params.spatialCoverage ? { boundingBox: params.spatialCoverage } : {}),
  });

  return packages.map((pkg) => mapDataset(pkg, params.variables ?? []));
}

/**
 * Fetch full dataset details including resources.
 */
export async function fetchDatasetDetail(datasetId: string): Promise<Dataset> {
  const pkg = await showPackage(datasetId);
  return mapDataset(pkg);
}

/**
 * Fetch resources for a specific dataset.
 *
 * The `region` argument is accepted for call-site compatibility but cannot be
 * applied: CKAN resources have no independent spatial coverage to filter on,
 * so every resource of the dataset is returned.
 */
export async function fetchDatasetResources(
  datasetId: string,
  _region?: { bounding_box?: { xmin: number; xmax: number; ymin: number; ymax: number } },
): Promise<DataResource[]> {
  const pkg = await showPackage(datasetId);
  return (pkg.resources ?? []).map((r) => mapDataResource(r, pkg));
}
