/**
 * useScopedStandardVariables — the option list for a StandardVariableCombobox.
 *
 * The catalog holds far more standard variables than the thread wizard can act
 * on. At TACC it holds 668, of which 147 are produced by a configuration the
 * Models step lists and 161 are taken as an input or adjusted by a parameter.
 * Offering all 668 lets a user pick a legitimate variable and meet a confident
 * zero one step later, which is the failure mode the map already rejected once
 * for dataset search (monorepo#96).
 *
 * So a scope narrows the list:
 *
 * - `all`       — every standard variable. Registration forms use this: they
 *                 describe a model rather than search one, so no row is a dead
 *                 end. This is the default, and it costs no extra query.
 * - `indicator` — the variables a listed configuration produces (thread
 *                 response_variable_id).
 * - `driver`    — the variables a listed configuration takes as an input, plus
 *                 the variables its parameters adjust (thread
 *                 driving_variable_id). The knowledge base defines a driver as
 *                 "input variables or adjustable parameters", so the union is
 *                 the right set, not either half.
 *
 * The full catalog is loaded only when it is asked for — scope `all`, or a
 * narrowed picker whose user has clicked the widen link. Measured against TACC,
 * gzipped: the full list is 35.8 KB, the indicator list 22.2 KB and the driver
 * list 20.8 KB. Loading the full list eagerly beside a scoped one would more
 * than double the step's cost for a list most users never open.
 */
import { useMemo } from 'react';

import {
  useGetDriverVariableOptionsQuery,
  useGetIndicatorVariableOptionsQuery,
  usePrefetchReferenceDataQuery,
} from '@/graphql/generated/graphql';
import type { StandardVariableOption } from './StandardVariableCombobox';

export type StandardVariableScope = 'all' | 'indicator' | 'driver';

interface StandardVariableFields {
  id: string;
  label: string;
  description?: string | null;
}

/**
 * Map a catalog row to a combobox option.
 *
 * Shared so that a scoped list and the full list render identically — a row
 * must not change its label just because it arrived through a different query.
 */
export function toStandardVariableOption(sv: StandardVariableFields): StandardVariableOption {
  return {
    id: sv.id,
    label: sv.label?.trim() || 'Unnamed standard variable',
    description: sv.description?.trim() || (sv.label ? null : `Catalog ID: ${sv.id}`),
  };
}

function byLabel(a: StandardVariableOption, b: StandardVariableOption) {
  return a.label.localeCompare(b.label);
}

function dedupe(rows: Array<StandardVariableFields | null | undefined>): StandardVariableOption[] {
  const byId = new Map<string, StandardVariableOption>();
  for (const sv of rows) {
    if (sv && !byId.has(sv.id)) byId.set(sv.id, toStandardVariableOption(sv));
  }
  return [...byId.values()].sort(byLabel);
}

export interface ScopedStandardVariables {
  /** Options for the scope. Equals `all` when the scope is `all`. */
  scoped: StandardVariableOption[];
  /** Every standard variable in the catalog. Empty until `loadAll` is set. */
  all: StandardVariableOption[];
  /** True once `all` holds the catalog, so a caller can print its size. */
  allLoaded: boolean;
  loading: boolean;
}

/**
 * @param scope   which list to offer.
 * @param loadAll fetch the full catalog as well. Forced on for scope `all`.
 */
export function useScopedStandardVariables(
  scope: StandardVariableScope = 'all',
  loadAll = false,
): ScopedStandardVariables {
  const wantAll = scope === 'all' || loadAll;
  const allQ = usePrefetchReferenceDataQuery({ fetchPolicy: 'cache-first', skip: !wantAll });
  const indicatorQ = useGetIndicatorVariableOptionsQuery({
    fetchPolicy: 'cache-first',
    skip: scope !== 'indicator',
  });
  const driverQ = useGetDriverVariableOptionsQuery({
    fetchPolicy: 'cache-first',
    skip: scope !== 'driver',
  });

  const all = useMemo(() => dedupe(allQ.data?.modelcatalog_standard_variable ?? []), [allQ.data]);

  const scoped = useMemo(() => {
    if (scope === 'indicator') {
      const rows = indicatorQ.data?.modelcatalog_dataset_specification_presentation ?? [];
      return dedupe(rows.map((r) => r.presentation.standard_variable));
    }
    if (scope === 'driver') {
      const inputs = driverQ.data?.inputs ?? [];
      const adjusted = driverQ.data?.adjusted ?? [];
      return dedupe([
        ...inputs.map((r) => r.presentation.standard_variable),
        ...adjusted.map((r) => r.variable.standard_variable),
      ]);
    }
    return all;
  }, [scope, indicatorQ.data, driverQ.data, all]);

  const scopeLoading =
    (scope === 'indicator' && indicatorQ.loading) || (scope === 'driver' && driverQ.loading);

  return {
    scoped,
    all,
    allLoaded: wantAll && !allQ.loading && allQ.data != null,
    loading: (wantAll && allQ.loading) || scopeLoading,
  };
}
