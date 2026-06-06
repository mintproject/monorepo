/**
 * Tests for useReferenceData hook and the mapStandardVariables / mapUnits helpers.
 *
 * These tests verify:
 * - Filter logic (case-insensitive substring match)
 * - Data mapping from GraphQL response shape to component interface
 * - Empty/null handling
 */

import { describe, expect, it } from 'vitest';

import { mapStandardVariables, mapUnits } from '@/hooks/useReferenceData';
import type { PrefetchReferenceDataQuery } from '@/graphql/generated/graphql';

// ─── Test data ─────────────────────────────────────────────────────────────

const mockSVData: PrefetchReferenceDataQuery = {
  __typename: 'query_root',
  modelcatalog_standard_variable: [
    {
      __typename: 'modelcatalog_standard_variable',
      id: 'https://w3id.org/okn/i/mint/sv1',
      label: 'Precipitation',
      description: 'Amount of precipitation falling on the surface',
    },
    {
      __typename: 'modelcatalog_standard_variable',
      id: 'https://w3id.org/okn/i/mint/sv2',
      label: 'Temperature',
      description: null,
    },
    {
      __typename: 'modelcatalog_standard_variable',
      id: 'https://w3id.org/okn/i/mint/sv3',
      label: 'Evapotranspiration',
      description: 'Water lost to atmosphere via evaporation and transpiration',
    },
  ],
  modelcatalog_unit: [],
};

const mockUnitData: PrefetchReferenceDataQuery = {
  __typename: 'query_root',
  modelcatalog_standard_variable: [],
  modelcatalog_unit: [
    {
      __typename: 'modelcatalog_unit',
      id: 'https://w3id.org/okn/i/mint/u1',
      label: 'mm/day',
    },
    {
      __typename: 'modelcatalog_unit',
      id: 'https://w3id.org/okn/i/mint/u2',
      label: 'Celsius',
    },
    {
      __typename: 'modelcatalog_unit',
      id: 'https://w3id.org/okn/i/mint/u3',
      label: 'mm/year',
    },
  ],
};

// ─── mapStandardVariables ──────────────────────────────────────────────────

describe('mapStandardVariables', () => {
  it('returns empty array when data is undefined', () => {
    expect(mapStandardVariables(undefined)).toEqual([]);
  });

  it('returns empty array when modelcatalog_standard_variable is empty', () => {
    const data: PrefetchReferenceDataQuery = {
      __typename: 'query_root',
      modelcatalog_standard_variable: [],
      modelcatalog_unit: [],
    };
    expect(mapStandardVariables(data)).toEqual([]);
  });

  it('maps id, label, and description correctly', () => {
    const result = mapStandardVariables(mockSVData);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      id: 'https://w3id.org/okn/i/mint/sv1',
      label: 'Precipitation',
      description: 'Amount of precipitation falling on the surface',
    });
  });

  it('maps null description to null (not undefined or empty string)', () => {
    const result = mapStandardVariables(mockSVData);
    const temp = result.find((r) => r.label === 'Temperature');
    expect(temp?.description).toBeNull();
  });

  it('maps null label to empty string', () => {
    const data: PrefetchReferenceDataQuery = {
      __typename: 'query_root',
      modelcatalog_standard_variable: [
        {
          __typename: 'modelcatalog_standard_variable',
          id: 'https://w3id.org/okn/i/mint/sv-no-label',
          label: null,
          description: null,
        },
      ],
      modelcatalog_unit: [],
    };
    const result = mapStandardVariables(data);
    expect(result[0]!.label).toBe('');
  });
});

// ─── mapUnits ──────────────────────────────────────────────────────────────

describe('mapUnits', () => {
  it('returns empty array when data is undefined', () => {
    expect(mapUnits(undefined)).toEqual([]);
  });

  it('returns empty array when modelcatalog_unit is empty', () => {
    const data: PrefetchReferenceDataQuery = {
      __typename: 'query_root',
      modelcatalog_standard_variable: [],
      modelcatalog_unit: [],
    };
    expect(mapUnits(data)).toEqual([]);
  });

  it('maps id and label correctly', () => {
    const result = mapUnits(mockUnitData);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      id: 'https://w3id.org/okn/i/mint/u1',
      label: 'mm/day',
    });
  });

  it('maps null label to empty string', () => {
    const data: PrefetchReferenceDataQuery = {
      __typename: 'query_root',
      modelcatalog_standard_variable: [],
      modelcatalog_unit: [
        {
          __typename: 'modelcatalog_unit',
          id: 'https://w3id.org/okn/i/mint/u-no-label',
          label: null,
        },
      ],
    };
    const result = mapUnits(data);
    expect(result[0]!.label).toBe('');
  });
});

// ─── Client-side filter logic ──────────────────────────────────────────────

describe('client-side filter logic (Standard Variables)', () => {
  const svList = mapStandardVariables(mockSVData);

  it('returns all items when search is empty', () => {
    const lower = ''.toLowerCase();
    const filtered = svList.filter(
      (sv) =>
        sv.label.toLowerCase().includes(lower) ||
        (sv.description?.toLowerCase().includes(lower) ?? false),
    );
    expect(filtered).toHaveLength(3);
  });

  it('filters on label (case-insensitive)', () => {
    const lower = 'precip'.toLowerCase();
    const filtered = svList.filter(
      (sv) =>
        sv.label.toLowerCase().includes(lower) ||
        (sv.description?.toLowerCase().includes(lower) ?? false),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.label).toBe('Precipitation');
  });

  it('filters on description (case-insensitive)', () => {
    const lower = 'atmosphere'.toLowerCase();
    const filtered = svList.filter(
      (sv) =>
        sv.label.toLowerCase().includes(lower) ||
        (sv.description?.toLowerCase().includes(lower) ?? false),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.label).toBe('Evapotranspiration');
  });

  it('returns empty array when no match', () => {
    const lower = 'zzzznotfound'.toLowerCase();
    const filtered = svList.filter(
      (sv) =>
        sv.label.toLowerCase().includes(lower) ||
        (sv.description?.toLowerCase().includes(lower) ?? false),
    );
    expect(filtered).toHaveLength(0);
  });

  it('handles SVs with null description gracefully', () => {
    // "Temperature" has null description — should still match on label
    const lower = 'temperature'.toLowerCase();
    const filtered = svList.filter(
      (sv) =>
        sv.label.toLowerCase().includes(lower) ||
        (sv.description?.toLowerCase().includes(lower) ?? false),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.label).toBe('Temperature');
  });
});

describe('client-side filter logic (Units)', () => {
  const unitList = mapUnits(mockUnitData);

  it('returns all items when search is empty', () => {
    const lower = '';
    const filtered = unitList.filter((u) => u.label.toLowerCase().includes(lower));
    expect(filtered).toHaveLength(3);
  });

  it('filters on label (case-insensitive)', () => {
    const lower = 'mm'.toLowerCase();
    const filtered = unitList.filter((u) => u.label.toLowerCase().includes(lower));
    expect(filtered).toHaveLength(2); // mm/day and mm/year
  });

  it('returns empty array when no match', () => {
    const lower = 'kelvin'.toLowerCase();
    const filtered = unitList.filter((u) => u.label.toLowerCase().includes(lower));
    expect(filtered).toHaveLength(0);
  });
});
