/**
 * Hook to prefetch and cache reference data (Standard Variables, Units).
 * These are loaded once on app init and filtered client-side.
 *
 * Strategy: single Apollo query on mount with cache-first fetch policy.
 * Subsequent reads by autocomplete components hit the Apollo cache (zero network).
 *
 * Standard Variables: ~303 entries
 * Units: ~107 entries
 * Total payload: ~40 KB uncompressed, ~10 KB gzipped
 */

import {
  usePrefetchReferenceDataQuery,
  type PrefetchReferenceDataQuery,
} from '@/graphql/generated/graphql';

export interface StandardVariable {
  id: string;
  label: string;
  description: string | null;
}

export interface Unit {
  id: string;
  label: string;
}

export interface UseReferenceDataResult {
  standardVariables: StandardVariable[];
  units: Unit[];
  loading: boolean;
  error: Error | null;
}

function mapStandardVariables(
  data: PrefetchReferenceDataQuery | undefined,
): StandardVariable[] {
  if (!data?.modelcatalog_standard_variable) return [];
  return data.modelcatalog_standard_variable.map((sv) => ({
    id: sv.id,
    label: sv.label ?? '',
    description: sv.description ?? null,
  }));
}

function mapUnits(data: PrefetchReferenceDataQuery | undefined): Unit[] {
  if (!data?.modelcatalog_unit) return [];
  return data.modelcatalog_unit.map((u) => ({
    id: u.id,
    label: u.label ?? '',
  }));
}

export function useReferenceData(): UseReferenceDataResult {
  const { data, loading, error } = usePrefetchReferenceDataQuery({
    fetchPolicy: 'cache-first',
  });

  return {
    standardVariables: mapStandardVariables(data),
    units: mapUnits(data),
    loading,
    error: error ?? null,
  };
}

// Named exports for use in combobox components that read from the cache
export { mapStandardVariables, mapUnits };
