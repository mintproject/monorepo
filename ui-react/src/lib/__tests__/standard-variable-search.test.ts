import { describe, expect, it } from 'vitest';

import type { StandardVariableOption } from '@/components/autocomplete/StandardVariableCombobox';
import {
  RECENT_GROUP_KEY,
  buildStandardVariableGroups,
  highlightRanges,
  rankStandardVariables,
} from '@/lib/standard-variable-search';

const OPTIONS: StandardVariableOption[] = [
  { id: 'sv-air', label: 'air__temperature', description: 'Near-surface air temperature' },
  { id: 'sv-soil-t', label: 'soil_temperature', description: null },
  { id: 'sv-soil-m', label: 'soil_moisture_content', description: 'Volumetric soil moisture' },
  { id: 'sv-fuel', label: '100hr_dead_moisture', description: '100 Hr Dead Fuel Moisture' },
  {
    id: 'sv-uuid',
    label: '06100430-298a-49d7-9834-590783d62379',
    description: 'Near-surface moisture index',
  },
  { id: 'sv-desc-only', label: 'precipitation_rate', description: 'temperature-adjusted rate' },
];

describe('rankStandardVariables', () => {
  it('returns all options unfiltered for an empty query', () => {
    expect(rankStandardVariables(OPTIONS, '')).toHaveLength(OPTIONS.length);
  });
  it('ranks label matches above description-only matches', () => {
    const ranked = rankStandardVariables(OPTIONS, 'temperature');
    const ids = ranked.map((o) => o.id);
    // air__temperature (label) ranks before precipitation_rate (description only)
    expect(ids.indexOf('sv-air')).toBeLessThan(ids.indexOf('sv-desc-only'));
  });
  it('excludes non-matches', () => {
    const ranked = rankStandardVariables(OPTIONS, 'soil');
    expect(ranked.every((o) => o.id !== 'sv-air')).toBe(true);
  });
});

describe('highlightRanges', () => {
  it('returns the matched range (case-insensitive)', () => {
    expect(highlightRanges('air__Temperature', 'temp')).toEqual([[5, 9]]);
  });
  it('returns empty for no match or empty query', () => {
    expect(highlightRanges('air__temperature', 'xyz')).toEqual([]);
    expect(highlightRanges('air__temperature', '')).toEqual([]);
  });
});

describe('buildStandardVariableGroups', () => {
  it('groups by category in canonical order with Unnamed last', () => {
    const { groups } = buildStandardVariableGroups(OPTIONS, [], '');
    const keys = groups.map((g) => g.key);
    expect(keys).toContain('Soil');
    expect(keys).toContain('Unnamed / Other');
    expect(keys.indexOf('Unnamed / Other')).toBe(keys.length - 1);
    // Atmosphere precedes Soil per CATEGORY_ORDER
    expect(keys.indexOf('Atmosphere & Climate')).toBeLessThan(keys.indexOf('Soil'));
  });
  it('demotes UUID rows: displayLabel uses description, flagged unnamed', () => {
    const { groups } = buildStandardVariableGroups(OPTIONS, [], '');
    const unnamed = groups.find((g) => g.key === 'Unnamed / Other');
    const row = unnamed?.options.find((o) => o.id === 'sv-uuid');
    expect(row?.isUnnamed).toBe(true);
    expect(row?.displayLabel).toBe('Near-surface moisture index');
  });
  it('pins a Recently used group first when recent ids match', () => {
    const { groups } = buildStandardVariableGroups(OPTIONS, ['sv-soil-m'], '');
    expect(groups[0]?.key).toBe(RECENT_GROUP_KEY);
    expect(groups[0]?.options[0]?.id).toBe('sv-soil-m');
  });
  it('omits the Recently used group when no recent id survives the filter', () => {
    const { groups } = buildStandardVariableGroups(OPTIONS, ['sv-air'], 'soil');
    expect(groups.every((g) => g.key !== RECENT_GROUP_KEY)).toBe(true);
  });
  it('reports match and total counts (matchCount excludes recent duplication)', () => {
    const res = buildStandardVariableGroups(OPTIONS, ['sv-soil-m'], '');
    expect(res.total).toBe(OPTIONS.length);
    expect(res.matchCount).toBe(OPTIONS.length);
  });
});
