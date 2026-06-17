/**
 * modelBrowseFilters — pure helpers for the /models browse filters.
 *
 * Filters live in the URL (text query + three facet id lists) and are compiled
 * into a Hasura `where` for SearchModelConfigurations. Facets are AND-combined
 * across dimensions and OR-combined within a dimension (`_in`).
 */
import type { Modelcatalog_Configuration_Bool_Exp } from '@/graphql/generated/graphql';

export interface ModelBrowseFilters {
  q: string;
  regionIds: string[];
  categoryIds: string[];
  variableIds: string[];
}

export const EMPTY_FILTERS: ModelBrowseFilters = {
  q: '',
  regionIds: [],
  categoryIds: [],
  variableIds: [],
};

export function hasActiveFilters(filters: ModelBrowseFilters): boolean {
  return (
    filters.q.trim().length > 0 ||
    filters.regionIds.length > 0 ||
    filters.categoryIds.length > 0 ||
    filters.variableIds.length > 0
  );
}

export function buildConfigurationWhere(
  filters: ModelBrowseFilters,
): Modelcatalog_Configuration_Bool_Exp {
  const and: Modelcatalog_Configuration_Bool_Exp[] = [];

  const q = filters.q.trim();
  if (q) {
    const pattern = `%${q}%`;
    and.push({
      _or: [
        { label: { _ilike: pattern } },
        { software_version: { software: { label: { _ilike: pattern } } } },
        {
          parent_configuration: { software_version: { software: { label: { _ilike: pattern } } } },
        },
      ],
    });
  }

  if (filters.categoryIds.length > 0) {
    and.push({ categories: { category_id: { _in: filters.categoryIds } } });
  }

  if (filters.regionIds.length > 0) {
    and.push({ regions: { region_id: { _in: filters.regionIds } } });
  }

  if (filters.variableIds.length > 0) {
    and.push({
      outputs: {
        output: {
          presentations: {
            presentation: { standard_variable: { id: { _in: filters.variableIds } } },
          },
        },
      },
    });
  }

  return and.length > 0 ? { _and: and } : {};
}

export function parseFilters(params: URLSearchParams): ModelBrowseFilters {
  return {
    q: params.get('q') ?? '',
    regionIds: params.getAll('region'),
    categoryIds: params.getAll('category'),
    variableIds: params.getAll('variable'),
  };
}

/** Serialize filters into URLSearchParams (repeated params per facet dimension). */
export function filtersToParams(filters: ModelBrowseFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q);
  filters.regionIds.forEach((id) => params.append('region', id));
  filters.categoryIds.forEach((id) => params.append('category', id));
  filters.variableIds.forEach((id) => params.append('variable', id));
  return params;
}
