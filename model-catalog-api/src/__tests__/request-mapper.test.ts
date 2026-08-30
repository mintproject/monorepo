/**
 * Tests for toHasuraInput covering object-in-array edge cases.
 * Specifically tests the fix for: POST /timeintervals with intervalUnit:[{}]
 * causing "parsing Text failed, expected String, but encountered Object".
 */

import { describe, it, expect } from 'vitest';
import { toHasuraInput } from '../mappers/request.js';
import type { ResourceConfig } from '../mappers/resource-registry.js';

// Minimal ResourceConfig matching the timeintervals config
const timeintervalConfig: ResourceConfig = {
  hasuraTable: 'modelcatalog_time_interval',
  typeUri: 'https://w3id.org/okn/o/sdm#TimeInterval',
  typeName: 'TimeInterval',
  typeArray: ['TimeInterval'],
  idPrefix: 'https://w3id.org/okn/i/mint/',
  relationships: {},
};

// ============================================================================
// unwrapValue edge cases: object-in-array handling
// ============================================================================

describe('toHasuraInput - object-in-array edge cases (timeintervals)', () => {
  it('omits interval_unit when value is [{}] (empty object in array)', () => {
    const result = toHasuraInput({ intervalUnit: [{}] }, timeintervalConfig);
    expect(result).not.toHaveProperty('interval_unit');
  });

  it('omits interval_unit when value is [{nested: "obj"}] (non-empty object in array)', () => {
    const result = toHasuraInput({ intervalUnit: [{ nested: 'obj' }] }, timeintervalConfig);
    expect(result).not.toHaveProperty('interval_unit');
  });

  it('preserves interval_unit when value is ["seconds"] (valid string)', () => {
    const result = toHasuraInput({ intervalUnit: ['seconds'] }, timeintervalConfig);
    expect(result).toHaveProperty('interval_unit', 'seconds');
  });

  it('preserves interval_unit when value is ["hours"] (valid string)', () => {
    const result = toHasuraInput({ intervalUnit: ['hours'] }, timeintervalConfig);
    expect(result).toHaveProperty('interval_unit', 'hours');
  });

  it('preserves interval_value when value is ["1"] (valid numeric string)', () => {
    const result = toHasuraInput({ intervalValue: ['1'] }, timeintervalConfig);
    expect(result).toHaveProperty('interval_value', '1');
  });

  it('omits interval_unit when value is [] (empty array)', () => {
    const result = toHasuraInput({ intervalUnit: [] }, timeintervalConfig);
    expect(result).not.toHaveProperty('interval_unit');
  });

  it('full failing request: intervalUnit:[{}] with other valid fields omits interval_unit', () => {
    const body = {
      intervalUnit: [{}],
      description: ['desc'],
      label: ['label'],
      type: ['TimeInterval'],
      intervalValue: ['1'],
    };
    const result = toHasuraInput(body, timeintervalConfig);
    expect(result).not.toHaveProperty('interval_unit');
    expect(result).toHaveProperty('description', 'desc');
    expect(result).toHaveProperty('label', 'label');
    expect(result).toHaveProperty('interval_value', '1');
    expect(result).not.toHaveProperty('type');
  });

  it('full valid request: intervalUnit:["seconds"] with other fields works correctly', () => {
    const body = {
      intervalUnit: ['seconds'],
      description: ['1 second interval'],
      label: ['1 second'],
      type: ['TimeInterval'],
      intervalValue: ['1'],
    };
    const result = toHasuraInput(body, timeintervalConfig);
    expect(result).toHaveProperty('interval_unit', 'seconds');
    expect(result).toHaveProperty('description', '1 second interval');
    expect(result).toHaveProperty('label', '1 second');
    expect(result).toHaveProperty('interval_value', '1');
    expect(result).not.toHaveProperty('type');
  });
});
