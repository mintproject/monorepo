import { describe, expect, it } from 'vitest';
import { extractModelIO, type ModelIOConfig } from '@/graphql/generated/modeling';

const config: ModelIOConfig = {
  id: 'cfg-1',
  label: 'PIHM Flood v4',
  regions: [{ region: { id: 'texas', label: 'Texas Gulf' } }],
  child_configurations: [],
  inputs: [
    {
      is_optional: false,
      input: {
        id: 'in-precip',
        label: 'precipitation',
        presentations: [
          {
            presentation: {
              id: 'vp-1',
              standard_variable: { id: 'sv-precip', label: 'precipitation flux' },
            },
          },
        ],
      },
    },
  ],
  outputs: [
    {
      output: {
        id: 'out-flood',
        label: 'flood inundation',
        presentations: [
          {
            presentation: {
              id: 'vp-2',
              standard_variable: { id: 'sv-flood', label: 'flood extent' },
            },
          },
        ],
      },
    },
  ],
};

describe('extractModelIO', () => {
  it('flattens inputs to {id, name, variableIds, variableLabels, optional}', () => {
    const io = extractModelIO(config);
    expect(io.inputs).toEqual([
      {
        id: 'in-precip',
        name: 'precipitation',
        variableIds: ['sv-precip'],
        variableLabels: ['precipitation flux'],
        optional: false,
      },
    ]);
  });

  it('flattens outputs and exposes producesVariableIds for the indicator filter', () => {
    const io = extractModelIO(config);
    expect(io.outputs[0]?.variableIds).toEqual(['sv-flood']);
    expect(io.producesVariableIds).toContain('sv-flood');
  });

  it('returns empty arrays when a config has no inputs/outputs', () => {
    const io = extractModelIO({ ...config, inputs: [], outputs: [] });
    expect(io.inputs).toEqual([]);
    expect(io.outputs).toEqual([]);
    expect(io.producesVariableIds).toEqual([]);
  });
});
