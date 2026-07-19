/**
 * CKAN Action API transport.
 *
 * The data catalog is a CKAN instance (e.g. https://ckan.tacc.utexas.edu), not
 * the legacy MINT Data Catalog REST API. CKAN exposes a single read API under
 * `/api/3/action/<action>` with GET query parameters and an envelope of
 * `{ success, result }`.
 *
 * This module owns the transport and the CKAN wire types. Mapping CKAN packages
 * into MINT domain objects lives with each caller, since the two data-catalog
 * clients project into different (historically divergent) domain types.
 *
 * Concept mapping, CKAN vs the old MINT API:
 *   datasets/find        -> package_search  (q, ext_bbox, rows)
 *   datasets/{id}        -> package_show    (id accepts a UUID or a name slug)
 *   resources/find       -> package_show, then read `resources[]`
 *
 * CKAN has no standard-variable vocabulary, so MINT standard variable names are
 * mapped onto CKAN free-text search rather than an exact field match. Likewise
 * CKAN resources carry no per-resource spatial/temporal coverage, so resources
 * inherit their parent package's coverage.
 */

import { getDataCatalogApiUrl } from '../config';

import type { DateRange, SpatialCoverage } from './types';

// ─── CKAN wire types ──────────────────────────────────────────────────────────

export interface CkanResource {
  id?: string;
  name?: string;
  url?: string;
  description?: string;
  format?: string;
  created?: string;
  last_modified?: string;
}

export interface CkanPackage {
  id?: string;
  name?: string;
  title?: string;
  notes?: string;
  version?: string;
  url?: string;
  author?: string;
  license_title?: string;
  num_resources?: number;
  /** GeoJSON geometry, serialised as a string by ckanext-spatial. */
  spatial?: string;
  temporal_coverage_start?: string;
  temporal_coverage_end?: string;
  tags?: { name?: string }[];
  groups?: { name?: string; title?: string }[];
  organization?: { name?: string; title?: string } | null;
  extras?: { key?: string; value?: string }[];
  resources?: CkanResource[];
}

interface CkanEnvelope<T> {
  success?: boolean;
  result?: T;
  error?: { message?: string };
}

interface CkanSearchResult {
  count?: number;
  results?: CkanPackage[];
}

/** Bounding box in the order CKAN's `ext_bbox` expects. */
export interface BoundingBox {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

// ─── Transport ────────────────────────────────────────────────────────────────

/**
 * Call a CKAN action endpoint. Throws on transport failure, on a non-2xx
 * response, or when CKAN reports `success: false`.
 */
async function ckanAction<T>(
  action: string,
  params: Record<string, string | number | undefined>,
  init?: { signal?: AbortSignal },
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }

  const url = `${getDataCatalogApiUrl()}/api/3/action/${action}?${query.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    ...(init?.signal ? { signal: init.signal } : {}),
  });

  if (!res.ok) {
    throw new Error(`CKAN ${action} failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as CkanEnvelope<T>;
  if (body.success === false || body.result === undefined) {
    throw new Error(`CKAN ${action} failed: ${body.error?.message ?? 'unknown error'}`);
  }
  return body.result;
}

/** `package_search` — free-text plus optional bounding-box filter. */
export async function searchPackages(opts: {
  q?: string;
  boundingBox?: BoundingBox;
  rows?: number;
  signal?: AbortSignal;
}): Promise<CkanPackage[]> {
  const params: Record<string, string | number | undefined> = {
    rows: opts.rows ?? 100,
  };
  if (opts.q) params['q'] = opts.q;
  if (opts.boundingBox) params['ext_bbox'] = formatBbox(opts.boundingBox);

  const result = await ckanAction<CkanSearchResult>(
    'package_search',
    params,
    opts.signal ? { signal: opts.signal } : undefined,
  );
  return result.results ?? [];
}

/** `package_show` — a single package, including its resources. */
export async function showPackage(id: string, signal?: AbortSignal): Promise<CkanPackage> {
  return ckanAction<CkanPackage>('package_show', { id }, signal ? { signal } : undefined);
}

// ─── Shaping helpers ──────────────────────────────────────────────────────────

/** `ext_bbox` is ordered minx,miny,maxx,maxy — not the xmin/xmax/ymin/ymax of our type. */
function formatBbox(bbox: BoundingBox): string {
  return [bbox.xmin, bbox.ymin, bbox.xmax, bbox.ymax].join(',');
}

/**
 * Build a CKAN `q` string from a name and/or a set of standard variable names.
 * Variables are OR-ed, since a dataset matching any requested variable is a
 * candidate. Returns undefined when there is nothing to search on, which CKAN
 * treats as "match everything".
 */
export function buildSearchQuery(opts: {
  name?: string;
  variables?: string[];
}): string | undefined {
  const terms: string[] = [];
  if (opts.name) terms.push(quote(opts.name));

  const variables = (opts.variables ?? []).filter(Boolean);
  if (variables.length) {
    const clause = variables.map(quote).join(' OR ');
    terms.push(variables.length > 1 ? `(${clause})` : clause);
  }

  if (!terms.length) return undefined;
  return terms.join(' AND ');
}

/** Quote a term so Solr treats it as a phrase and does not choke on its syntax. */
function quote(term: string): string {
  return `"${term.replace(/"/g, '\\"')}"`;
}

export function parseDate(val: unknown): Date | null {
  if (!val || val === 'None') return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

/** A package's temporal coverage, or null when CKAN carries neither bound. */
export function packageTimePeriod(pkg: CkanPackage): DateRange | null {
  const start = parseDate(pkg.temporal_coverage_start);
  const end = parseDate(pkg.temporal_coverage_end);
  if (!start && !end) return null;
  return { start_date: start, end_date: end };
}

/** Parse ckanext-spatial's stringified GeoJSON geometry. */
export function packageSpatialCoverage(pkg: CkanPackage): SpatialCoverage | undefined {
  if (!pkg.spatial) return undefined;
  try {
    const geo = JSON.parse(pkg.spatial) as { type?: string; coordinates?: unknown };
    if (!geo?.type) return undefined;
    // GeoJSON polygons nest one ring deeper than SpatialCoverage.coordinates allows.
    const ring = Array.isArray(geo.coordinates) ? geo.coordinates[0] : undefined;
    return {
      type: geo.type,
      ...(Array.isArray(ring) ? { coordinates: ring as number[][] } : {}),
    };
  } catch {
    return undefined;
  }
}

/** CKAN's `version` is often the literal string "None". */
export function cleanString(val: unknown): string {
  if (val === undefined || val === null || val === 'None') return '';
  return String(val);
}

export function packageTags(pkg: CkanPackage): string[] {
  return (pkg.tags ?? []).map((t) => t.name ?? '').filter(Boolean);
}

/** Read a CKAN `extras` entry as a boolean flag. CKAN stores extras as strings. */
export function packageExtraFlag(pkg: CkanPackage, key: string): boolean {
  return (pkg.extras ?? []).some((e) => e.key === key && e.value === 'true');
}

/**
 * Client-side temporal filter. CKAN's temporal_coverage_* fields are extras and
 * are not reliably indexed for range queries, so we filter after fetching
 * rather than pushing an `fq` that some instances would reject.
 *
 * A package is kept when its coverage overlaps the requested window; packages
 * with no coverage at all are kept rather than silently dropped.
 */
export function overlapsDateRange(
  pkg: CkanPackage,
  start?: Date | null,
  end?: Date | null,
): boolean {
  if (!start && !end) return true;
  const period = packageTimePeriod(pkg);
  if (!period) return true;
  if (end && period.start_date && period.start_date > end) return false;
  if (start && period.end_date && period.end_date < start) return false;
  return true;
}
