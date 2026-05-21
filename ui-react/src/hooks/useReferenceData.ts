/**
 * Hook to prefetch and cache reference data (Standard Variables, Units).
 * These are loaded once on app init and filtered client-side.
 *
 * Standard Variables: ~303 entries
 * Units: ~107 entries
 *
 * Will be implemented when GraphQL queries are wired up.
 */

export interface StandardVariable {
  id: string;
  label: string;
  description: string | null;
}

export interface Unit {
  id: string;
  label: string;
}

export function useReferenceData() {
  // TODO: Implement with Apollo useQuery against reference-data.graphql
  return {
    standardVariables: [] as StandardVariable[],
    units: [] as Unit[],
    loading: false,
    error: null as Error | null,
  };
}
