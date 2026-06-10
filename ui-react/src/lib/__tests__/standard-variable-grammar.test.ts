import { describe, expect, it } from 'vitest';

import { humanizeStandardVariable, parseCsdmsName } from '@/lib/standard-variable-grammar';

describe('parseCsdmsName', () => {
  it('splits object__quantity on the double underscore', () => {
    expect(parseCsdmsName('channel_water__volume_flow_rate')).toEqual({
      object: 'channel water',
      quantity: 'volume flow rate',
      isGrammar: true,
    });
  });

  it('treats ~ and _ as word joiners', () => {
    expect(parseCsdmsName('atmosphere_air_water~vapor__relative_saturation')).toEqual({
      object: 'atmosphere air water vapor',
      quantity: 'relative saturation',
      isGrammar: true,
    });
  });

  it('splits on the first __ only', () => {
    const r = parseCsdmsName('a__b__c');
    expect(r.object).toBe('a');
    expect(r.quantity).toBe('b c');
    expect(r.isGrammar).toBe(true);
  });

  it('marks labels without __ as non-grammar and keeps the text as quantity', () => {
    expect(parseCsdmsName('Flame Length')).toEqual({
      object: '',
      quantity: 'Flame Length',
      isGrammar: false,
    });
  });

  it('is null-safe', () => {
    expect(parseCsdmsName('')).toEqual({ object: '', quantity: '', isGrammar: false });
  });
});

describe('humanizeStandardVariable', () => {
  it('sentence-cases each part', () => {
    expect(humanizeStandardVariable('channel_water__volume_flow_rate')).toEqual({
      phenomenon: 'Channel water',
      property: 'Volume flow rate',
    });
  });

  it('leaves the property as-is for non-grammar labels', () => {
    expect(humanizeStandardVariable('Flame Length')).toEqual({
      phenomenon: '',
      property: 'Flame Length',
    });
  });
});
