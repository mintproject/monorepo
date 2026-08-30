import { describe, expect, it } from 'vitest';

import { DIMENSION_ORDER, prettyUnit, unitDimension, unitName } from '@/lib/unit-dictionary';

describe('unitName / unitDimension', () => {
  it('resolves a known symbol to its name and dimension', () => {
    expect(unitName('degC')).toBe('degrees Celsius');
    expect(unitDimension('degC')).toBe('Temperature');
  });

  it('falls back to the raw symbol and Other for unknowns', () => {
    expect(unitName('zorp/widget')).toBe('zorp/widget');
    expect(unitDimension('zorp/widget')).toBe('Other');
  });
});

describe('prettyUnit', () => {
  it('renders negative exponents as superscripts', () => {
    expect(prettyUnit('m s-1')).toBe('m s⁻¹');
    expect(prettyUnit('mm day-1')).toBe('mm day⁻¹');
  });

  it('renders m3/m2 and m-3 in one symbol', () => {
    expect(prettyUnit('m3 m-3')).toBe('m³ m⁻³');
  });

  it('leaves a plain symbol unchanged', () => {
    expect(prettyUnit('Pa')).toBe('Pa');
  });
});

describe('DIMENSION_ORDER', () => {
  it('lists Temperature before Other and ends with Other', () => {
    expect(DIMENSION_ORDER.indexOf('Temperature')).toBeLessThan(DIMENSION_ORDER.indexOf('Other'));
    expect(DIMENSION_ORDER[DIMENSION_ORDER.length - 1]).toBe('Other');
  });
});
