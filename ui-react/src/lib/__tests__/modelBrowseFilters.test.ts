import { describe, expect, it } from 'vitest';

import {
  buildConfigurationWhere,
  hasActiveFilters,
  parseFilters,
  type ModelBrowseFilters,
} from '@/lib/modelBrowseFilters';

const base: ModelBrowseFilters = { q: '', regionIds: [], categoryIds: [], variableIds: [] };

describe('buildConfigurationWhere', () => {
  it('returns an empty where when no filters are active', () => {
    expect(buildConfigurationWhere(base)).toEqual({});
  });

  it('matches own label and model label for text search', () => {
    const where = buildConfigurationWhere({ ...base, q: 'flow' });
    expect(where._and).toHaveLength(1);
    expect(where._and![0]!._or).toEqual([
      { label: { _ilike: '%flow%' } },
      { software_version: { software: { label: { _ilike: '%flow%' } } } },
      { parent_configuration: { software_version: { software: { label: { _ilike: '%flow%' } } } } },
    ]);
  });

  it('ignores whitespace-only text', () => {
    expect(buildConfigurationWhere({ ...base, q: '   ' })).toEqual({});
  });

  it('adds category, region, and output-variable clauses', () => {
    const where = buildConfigurationWhere({
      ...base,
      categoryIds: ['cat1'],
      regionIds: ['r1', 'r2'],
      variableIds: ['v1'],
    });
    expect(where._and).toContainEqual({ categories: { category_id: { _in: ['cat1'] } } });
    expect(where._and).toContainEqual({ regions: { region_id: { _in: ['r1', 'r2'] } } });
    expect(where._and).toContainEqual({
      outputs: {
        output: { presentations: { presentation: { standard_variable: { id: { _in: ['v1'] } } } } },
      },
    });
  });

  it('omits a facet clause when its id list is empty', () => {
    const where = buildConfigurationWhere({ ...base, categoryIds: ['cat1'] });
    expect(where._and).toHaveLength(1);
  });
});

describe('hasActiveFilters', () => {
  it('is false for empty filters', () => {
    expect(hasActiveFilters(base)).toBe(false);
  });
  it('is true when any dimension is set', () => {
    expect(hasActiveFilters({ ...base, q: 'x' })).toBe(true);
    expect(hasActiveFilters({ ...base, regionIds: ['r1'] })).toBe(true);
  });
});

describe('parseFilters', () => {
  it('reads q and repeated facet params', () => {
    const params = new URLSearchParams('q=modflow&region=r1&region=r2&category=c1&variable=v1');
    expect(parseFilters(params)).toEqual({
      q: 'modflow',
      regionIds: ['r1', 'r2'],
      categoryIds: ['c1'],
      variableIds: ['v1'],
    });
  });

  it('defaults to empty filters', () => {
    expect(parseFilters(new URLSearchParams())).toEqual(base);
  });
});
