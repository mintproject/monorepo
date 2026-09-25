import { getModelCatalogApiUrl } from './config';
import { getAccessToken } from './auth/token-store';

export interface RegionImportRequest {
  parent_region_id: string;
  category_id: string;
  regions: Array<{
    id: string;
    name: string;
    geometries: Array<GeoJSON.Geometry | string>;
  }>;
}

export interface RegionImportResponse {
  count: number;
  regions: Array<{ id: string; name: string }>;
}

async function responseError(response: Response): Promise<Error> {
  let message = `Region import request failed (${response.status})`;
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error) message = payload.error;
  } catch {
    // Keep the status-based message when the server did not return JSON.
  }
  return new Error(message);
}

function authorizationHeaders(): HeadersInit {
  const token = getAccessToken();
  if (!token) throw new Error('You must be authenticated to import regions.');
  return { Authorization: `Bearer ${token}` };
}

export async function getRegionImportAccess(): Promise<boolean> {
  const response = await fetch(`${getModelCatalogApiUrl()}/regions/import/access`, {
    headers: authorizationHeaders(),
  });
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) throw await responseError(response);
  const payload = (await response.json()) as { allowed?: unknown };
  return payload.allowed === true;
}

export async function importRegions(payload: RegionImportRequest): Promise<RegionImportResponse> {
  const response = await fetch(`${getModelCatalogApiUrl()}/regions/import`, {
    method: 'POST',
    headers: { ...authorizationHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as RegionImportResponse;
}
