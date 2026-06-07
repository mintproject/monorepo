import { describe, expect, it } from 'vitest';

import {
  CATEGORY_ORDER,
  categorizeStandardVariable,
  isUnnamedLabel,
} from '@/lib/standard-variable-taxonomy';

describe('isUnnamedLabel', () => {
  it('flags UUID labels', () => {
    expect(isUnnamedLabel('06100430-298a-49d7-9834-590783d62379')).toBe(true);
  });
  it('flags empty/whitespace labels', () => {
    expect(isUnnamedLabel('')).toBe(true);
    expect(isUnnamedLabel('   ')).toBe(true);
  });
  it('flags single tokens with no structure', () => {
    expect(isUnnamedLabel('Modflow')).toBe(true);
  });
  it('accepts SVO-structured names', () => {
    expect(isUnnamedLabel('soil_moisture_content')).toBe(false);
    expect(isUnnamedLabel('atmosphere_precipitation__mass_flux')).toBe(false);
  });
  it('accepts multi-word phrases', () => {
    expect(isUnnamedLabel('Soil Moisture Content')).toBe(false);
  });
});

describe('categorizeStandardVariable', () => {
  it('routes fuel-moisture variables to Fire & Fuel, not Soil', () => {
    expect(categorizeStandardVariable('100hr_dead_moisture')).toBe('Fire & Fuel');
    expect(categorizeStandardVariable('10hr_dead_moisture')).toBe('Fire & Fuel');
  });
  it('routes soil moisture to Soil', () => {
    expect(categorizeStandardVariable('soil_moisture_content')).toBe('Soil');
  });
  it('routes precipitation flux to Atmosphere & Climate (not Energy via "flux")', () => {
    expect(categorizeStandardVariable('atmosphere_precipitation__mass_flux')).toBe(
      'Atmosphere & Climate',
    );
  });
  it('routes groundwater before generic water', () => {
    expect(categorizeStandardVariable('groundwater__recharge_rate')).toBe(
      'Hydrology — Groundwater',
    );
  });
  it('routes surface-water terms', () => {
    expect(categorizeStandardVariable('channel_stream__discharge')).toBe(
      'Hydrology — Surface Water',
    );
  });
  it('routes vegetation terms', () => {
    expect(categorizeStandardVariable('land_vegetation__leaf_area_index')).toBe(
      'Land Cover & Vegetation',
    );
  });
  it('routes topography terms', () => {
    expect(categorizeStandardVariable('land_surface__elevation')).toBe('Topography & Surface');
  });
  it('routes energy/carbon terms', () => {
    expect(categorizeStandardVariable('land_surface__latent_heat_flux')).toBe(
      'Energy & Carbon Flux',
    );
  });
  it('falls back to Unnamed / Other for UUIDs and unmatched tokens', () => {
    expect(categorizeStandardVariable('06100430-298a-49d7-9834-590783d62379')).toBe(
      'Unnamed / Other',
    );
    expect(categorizeStandardVariable('zzz_unmatched__quantity')).toBe('Unnamed / Other');
  });
});

describe('CATEGORY_ORDER', () => {
  it('lists Unnamed / Other last', () => {
    expect(CATEGORY_ORDER[CATEGORY_ORDER.length - 1]).toBe('Unnamed / Other');
  });
  it('has no duplicates', () => {
    expect(new Set(CATEGORY_ORDER).size).toBe(CATEGORY_ORDER.length);
  });
});
