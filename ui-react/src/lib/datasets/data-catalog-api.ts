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
  packagesMatchingVariableSubstring,
  packageTags,
  packageTimePeriod,
  parseDate,
  resourceStandardVariables,
  searchAllPackages,
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

/**
 * The distinct standard variables carried by a package's resources, in the
 * order first seen. Read off the resources rather than echoed back from the
 * query, so it says what the dataset holds rather than what was asked for.
 */
function packageStandardVariables(pkg: CkanPackage): string[] {
  const seen = new Set<string>();
  for (const row of pkg.resources ?? []) {
    for (const name of resourceStandardVariables(row)) seen.add(name);
  }
  return [...seen];
}

function mapDataset(pkg: CkanPackage): Dataset {
  const resources = pkg.resources ?? [];

  return {
    // Prefer the name slug: it is what CKAN URLs use and package_show accepts.
    id: cleanString(pkg.name) || cleanString(pkg.id),
    name: cleanString(pkg.title) || cleanString(pkg.name),
    region: '',
    variables: packageStandardVariables(pkg),
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
 * Search datasets by name and/or a fragment of a standard variable name.
 *
 * The two halves are answered in different places. A dataset name goes to CKAN
 * as `q`, which Solr can serve. A standard variable name cannot: the annotation
 * lives on each resource in `mint_standard_variables`, which Solr neither
 * indexes nor tokenises usefully, so it is matched here against the whole
 * catalog. Reading every package is what makes that possible, and it is also
 * what stops the plain listing from stopping at CKAN's 100-row default.
 */
export async function searchDatasets(params: DatasetQueryParameters): Promise<Dataset[]> {
  const query = buildSearchQuery({ ...(params.name ? { name: params.name } : {}) });

  const packages = await searchAllPackages({
    ...(query ? { q: query } : {}),
    ...(params.spatialCoverage ? { boundingBox: params.spatialCoverage } : {}),
  });

  const matched = packagesMatchingVariableSubstring(packages, params.variableSubstring ?? '');
  return matched.map(mapDataset);
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
