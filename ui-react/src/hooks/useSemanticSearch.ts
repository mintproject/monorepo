import { useEffect, useState } from 'react';

import { getSemanticSearchApiUrl } from '@/lib/config';

export type SemanticSearchTarget = 'svo' | 'model_configuration';

export interface SemanticSearchFilters {
  regionIds?: string[];
  categoryIds?: string[];
  variableIds?: string[];
  outputVariableIds?: string[];
  role?: 'input' | 'output';
}

export interface SemanticSearchResult {
  id: string;
  label?: string | null;
  description?: string | null;
  score?: number;
  ranking_source?: string | null;
  [key: string]: unknown;
}

export interface SemanticSearchOptions {
  target: SemanticSearchTarget;
  limit?: number;
  minLength?: number;
  enabled?: boolean;
  filters?: SemanticSearchFilters;
}

function appendRepeated(params: URLSearchParams, key: string, values: string[] | undefined) {
  values?.forEach((value) => params.append(key, value));
}

export function buildSemanticSearchUrl(
  query: string,
  {
    target,
    limit = 50,
    filters,
    baseUrl = getSemanticSearchApiUrl(),
  }: SemanticSearchOptions & { baseUrl?: string },
): string {
  const params = new URLSearchParams({ q: query.trim(), target, limit: String(limit) });
  appendRepeated(params, 'region_id', filters?.regionIds);
  appendRepeated(params, 'category_id', filters?.categoryIds);
  appendRepeated(params, 'variable_id', filters?.variableIds);
  appendRepeated(params, 'output_variable_id', filters?.outputVariableIds);
  if (filters?.role) params.set('role', filters.role);
  return `${baseUrl.replace(/\/$/, '')}/search?${params.toString()}`;
}

export async function searchSemanticCatalog(
  query: string,
  options: SemanticSearchOptions & { signal?: AbortSignal },
): Promise<SemanticSearchResult[]> {
  const response = await fetch(buildSemanticSearchUrl(query, options), {
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`Semantic search failed (${response.status})`);
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== 'object' ||
    !Array.isArray((body as { results?: unknown }).results)
  ) {
    throw new Error('Semantic search returned an invalid response');
  }
  return (body as { results: SemanticSearchResult[] }).results;
}

export function useSemanticSearch(
  query: string,
  { target, limit = 50, minLength = 2, enabled = true, filters }: SemanticSearchOptions,
) {
  const [results, setResults] = useState<SemanticSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || trimmed.length < minLength) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setResults(null);
    setLoading(true);
    setError(null);

    searchSemanticCatalog(trimmed, { target, limit, filters, signal: controller.signal })
      .then((nextResults) => {
        if (!active) return;
        setResults(nextResults);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!active || controller.signal.aborted) return;
        setResults(null);
        setLoading(false);
        setError(reason instanceof Error ? reason : new Error(String(reason)));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, filters, limit, minLength, query, target]);

  return { results, loading, error };
}
