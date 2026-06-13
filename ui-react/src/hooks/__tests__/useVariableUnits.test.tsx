import { MockedProvider } from '@apollo/client/testing';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { GetVariablePresentationsDocument } from '@/graphql/generated/graphql';
import { useVariableUnits } from '@/hooks/useVariableUnits';

const pres = (
  id: string,
  svId: string,
  label: string,
  unit: { id: string; label: string } | null,
) => ({
  __typename: 'modelcatalog_variable_presentation',
  id,
  label: `${id}-presentation`,
  has_long_name: null,
  has_short_name: null,
  standard_variable: {
    __typename: 'modelcatalog_standard_variable',
    id: svId,
    label,
    description: null,
  },
  unit: unit ? { __typename: 'modelcatalog_unit', id: unit.id, label: unit.label } : null,
});

const mocks = [
  {
    request: { query: GetVariablePresentationsDocument },
    result: {
      data: {
        modelcatalog_variable_presentation: [
          // canonical record: 2 presentations, non-UUID id, unit m
          pres('p1', 'sv-canon', 'land_surface__elevation', { id: 'u-m', label: 'm' }),
          pres('p2', 'sv-canon', 'land_surface__elevation', { id: 'u-m', label: 'm' }),
          // duplicate sibling: UUID id, 1 presentation, no unit
          pres('p3', '06100430-298a-49d7-9834-590783d62379', 'land_surface__elevation', null),
          // a different variable used with two units
          pres('p4', 'sv-soil', 'soil_water__volume_fraction', { id: 'u-vf', label: 'm3 m-3' }),
          pres('p5', 'sv-soil', 'soil_water__volume_fraction', { id: 'u-pct', label: '%' }),
        ],
      },
    },
  },
];

const wrapper = ({ children }: { children: ReactNode }) => (
  <MockedProvider mocks={mocks}>{children}</MockedProvider>
);

describe('useVariableUnits', () => {
  it('returns the distinct units used with a variable', async () => {
    const { result } = renderHook(() => useVariableUnits(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unitsForVariable('sv-canon')).toEqual([{ id: 'u-m', label: 'm' }]);
    expect(result.current.unitsForVariable('sv-soil')).toEqual([
      { id: 'u-vf', label: 'm3 m-3' },
      { id: 'u-pct', label: '%' },
    ]);
  });

  it('picks the canonical record for a label shared by several SV ids', async () => {
    const { result } = renderHook(() => useVariableUnits(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canonicalIdForLabel('land_surface__elevation')).toBe('sv-canon');
  });

  it('returns an empty array for an unknown variable', async () => {
    const { result } = renderHook(() => useVariableUnits(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unitsForVariable('nope')).toEqual([]);
    expect(result.current.canonicalIdForLabel('nope')).toBeUndefined();
  });
});
