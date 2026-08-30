/**
 * useVariableUnits
 *
 * Surfaces the standard_variable → variable_presentations → unit relationship
 * that the flat reference-data query throws away. Reads the existing
 * GetVariablePresentations query (cache-first) and derives:
 *  - the distinct units each standard variable has been used with, and
 *  - for each human label shared by several SV records (the duplicate-row
 *    problem), the single canonical record to resolve to (most presentations;
 *    a non-UUID id wins ties).
 * Pure derivation in a useMemo — no extra network call.
 */

import { useMemo } from 'react';

import { useGetVariablePresentationsQuery } from '@/graphql/generated/graphql';
import { isUnnamedLabel } from '@/lib/standard-variable-taxonomy';

export interface UnitOption {
  id: string;
  label: string;
}

export interface VariableUnits {
  loading: boolean;
  /** Distinct units used with the given standard-variable id (may be empty). */
  unitsForVariable: (standardVariableId: string) => UnitOption[];
  /** Canonical SV id for a label shared by duplicate records, or undefined. */
  canonicalIdForLabel: (label: string) => string | undefined;
}

export function useVariableUnits(): VariableUnits {
  const { data, loading } = useGetVariablePresentationsQuery({ fetchPolicy: 'cache-first' });

  const { unitsBySv, canonicalByLabel } = useMemo(() => {
    const unitsBySv = new Map<string, UnitOption[]>();
    const presCount = new Map<string, number>();
    const labelToIds = new Map<string, Set<string>>();

    const presentations = data?.modelcatalog_variable_presentation ?? [];
    for (const p of presentations) {
      const sv = p.standard_variable;
      if (!sv) continue;

      presCount.set(sv.id, (presCount.get(sv.id) ?? 0) + 1);

      if (sv.label) {
        const ids = labelToIds.get(sv.label) ?? new Set<string>();
        ids.add(sv.id);
        labelToIds.set(sv.label, ids);
      }

      const unit = p.unit;
      if (unit && unit.id) {
        const arr = unitsBySv.get(sv.id) ?? [];
        if (!arr.some((u) => u.id === unit.id)) {
          arr.push({ id: unit.id, label: unit.label ?? '' });
          unitsBySv.set(sv.id, arr);
        }
      }
    }

    const canonicalByLabel = new Map<string, string>();
    for (const [label, ids] of labelToIds) {
      let best: string | undefined;
      let bestScore = -1;
      for (const id of ids) {
        const count = presCount.get(id) ?? 0;
        const lastSegment = id.split('/').pop() ?? id;
        // weight presentation count, break ties toward a human (non-UUID) id
        const score = count * 2 + (isUnnamedLabel(lastSegment) ? 0 : 1);
        if (score > bestScore) {
          bestScore = score;
          best = id;
        }
      }
      if (best) canonicalByLabel.set(label, best);
    }

    return { unitsBySv, canonicalByLabel };
  }, [data]);

  return {
    loading,
    unitsForVariable: (standardVariableId) => unitsBySv.get(standardVariableId) ?? [],
    canonicalIdForLabel: (label) => canonicalByLabel.get(label),
  };
}
