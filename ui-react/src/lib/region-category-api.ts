import { getModelCatalogApiUrl } from './config';
import { getAccessToken } from './auth/token-store';

export interface CreateRegionSubcategoryRequest {
  parent_category_id: string;
  name: string;
  citation?: string;
}

export interface RegionSubcategoryResponse {
  id: string;
  name: string;
  citation: string | null;
  parent_category_id: string;
}

async function responseError(response: Response): Promise<Error> {
  let message = `Region category request failed (${response.status})`;
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
  if (!token) throw new Error('You must be authenticated to create categories.');
  return { Authorization: `Bearer ${token}` };
}

export async function createRegionSubcategory(
  payload: CreateRegionSubcategoryRequest,
): Promise<RegionSubcategoryResponse> {
  const response = await fetch(`${getModelCatalogApiUrl()}/regions/categories`, {
    method: 'POST',
    headers: { ...authorizationHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as RegionSubcategoryResponse;
}
