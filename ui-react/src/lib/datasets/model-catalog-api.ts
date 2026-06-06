/**
 * Model Catalog REST API client — DataTransformation resource.
 *
 * DataTransformations live in the legacy model catalog (not Hasura), so we
 * call the REST API directly. Base URL comes from runtime config.
 */

import { getModelCatalogApiUrl } from '../config';
import type { DataTransformation } from './types';

function mapDataTransformation(raw: Record<string, unknown>): DataTransformation {
  // Model catalog API returns JSON-LD style objects with @id, label, description
  const id = String(raw['id'] ?? raw['@id'] ?? '');
  const label = raw['label']
    ? String(Array.isArray(raw['label']) ? raw['label'][0] : raw['label'])
    : undefined;
  const description = raw['description']
    ? String(Array.isArray(raw['description']) ? raw['description'][0] : raw['description'])
    : undefined;
  const type = raw['type']
    ? String(Array.isArray(raw['type']) ? raw['type'][0] : raw['type'])
    : undefined;

  return { id, label, description, type };
}

/**
 * Fetch all DataTransformation resources from the model catalog.
 */
export async function fetchDataTransformations(
  username = 'mint@isi.edu',
): Promise<DataTransformation[]> {
  const baseUrl = getModelCatalogApiUrl();
  const resp = await fetch(
    `${baseUrl}/datatransformations?username=${encodeURIComponent(username)}&per_page=200`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    },
  );

  if (!resp.ok) {
    throw new Error(`Model catalog DataTransformations fetch failed: ${resp.statusText}`);
  }

  const data = (await resp.json()) as Record<string, unknown>[];
  return data.map(mapDataTransformation);
}

/**
 * Fetch a single DataTransformation by its full URI id.
 */
export async function fetchDataTransformation(
  id: string,
  username = 'mint@isi.edu',
): Promise<DataTransformation> {
  const baseUrl = getModelCatalogApiUrl();
  // The id might be a full URI; extract the last segment for the path param
  const shortId = id.split('/').pop() ?? id;
  const resp = await fetch(
    `${baseUrl}/datatransformations/${encodeURIComponent(shortId)}?username=${encodeURIComponent(username)}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    },
  );

  if (!resp.ok) {
    throw new Error(`Model catalog DataTransformation fetch failed: ${resp.statusText}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  return mapDataTransformation(data);
}
