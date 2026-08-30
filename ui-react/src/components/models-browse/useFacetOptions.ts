/**
 * useFacetOptions — loads the option lists for the three browse facets.
 *
 * Region and Category come straight from list queries. Output-variable options
 * are deduped client-side from the configuration_output -> standard_variable
 * path (no aggregates available to the anonymous role).
 */
import { useMemo } from 'react';

import {
  useGetModelCategoryOptionsQuery,
  useGetOutputVariableOptionsQuery,
  useGetRegionsQuery,
} from '@/graphql/generated/graphql';
import type { FacetOption } from './FacetSelect';

export interface FacetOptions {
  regions: FacetOption[];
  categories: FacetOption[];
  variables: FacetOption[];
  loading: boolean;
}

export function useFacetOptions(): FacetOptions {
  const regionsQ = useGetRegionsQuery();
  const categoriesQ = useGetModelCategoryOptionsQuery();
  const variablesQ = useGetOutputVariableOptionsQuery();

  const regions = useMemo<FacetOption[]>(
    () =>
      (regionsQ.data?.modelcatalog_region ?? []).map((r) => ({
        id: r.id,
        label: r.label ?? r.id,
      })),
    [regionsQ.data],
  );

  const categories = useMemo<FacetOption[]>(
    () =>
      (categoriesQ.data?.modelcatalog_model_category ?? []).map((c) => ({
        id: c.id,
        label: c.label ?? c.id,
      })),
    [categoriesQ.data],
  );

  const variables = useMemo<FacetOption[]>(() => {
    const byId = new Map<string, string>();
    for (const out of variablesQ.data?.modelcatalog_configuration_output ?? []) {
      for (const pres of out.output.presentations ?? []) {
        const sv = pres.presentation.standard_variable;
        if (sv && !byId.has(sv.id)) byId.set(sv.id, sv.label ?? sv.id);
      }
    }
    return [...byId.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [variablesQ.data]);

  return {
    regions,
    categories,
    variables,
    loading: regionsQ.loading || categoriesQ.loading || variablesQ.loading,
  };
}
