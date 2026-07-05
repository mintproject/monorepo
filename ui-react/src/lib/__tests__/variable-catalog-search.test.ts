import { describe, expect, it } from 'vitest';

import { searchVariableRows, unitLabels, type VariableSearchRow } from '../variable-catalog-search';

const rows: VariableSearchRow[] = [
  {
    id: 'a',
    label: 'water_flow',
    description: 'Volumetric discharge',
    units: [{ id: 'u1', label: 'm3/s' }],
  },
  {
    id: 'b',
    label: 'runoff',
    description: 'Surface water routed downhill',
    units: [{ id: 'u2', label: 'mm/day' }],
  },
  {
    id: 'c',
    label: 'temperature',
    description: 'Air temperature',
    units: [{ id: 'u3', label: 'Celsius' }],
  },
];

describe('unitLabels', () => {
  it('flattens a row presentations into its unit labels', () => {
    expect(unitLabels(rows[1]!)).toEqual(['mm/day']);
  });
});

describe('searchVariableRows', () => {
  it('returns the input order unchanged for an empty query', () => {
    expect(searchVariableRows(rows, '   ')).toEqual(rows);
  });

  it('ranks a name (label) match above a description-only match', () => {
    const result = searchVariableRows(rows, 'water');
    // 'water_flow' matches on label; 'runoff' only on description.
    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('surfaces a variable by its unit label when name/description do not match', () => {
    const result = searchVariableRows(rows, 'mm/day');
    expect(result.map((r) => r.id)).toEqual(['b']);
  });

  it('appends unit-only matches after name/description matches', () => {
    // 'Celsius' matches only unit of row c; nothing else matches.
    const result = searchVariableRows(rows, 'celsius');
    expect(result.map((r) => r.id)).toEqual(['c']);
  });
});
