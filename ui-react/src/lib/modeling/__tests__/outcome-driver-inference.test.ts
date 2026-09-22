import { describe, expect, it } from 'vitest';
import {
  inferReachableContractKeys,
  inferReachableModelConfigurationIds,
  inferOutcomeDriverOptions,
  type ContractTransform,
  type InferenceModelOutput,
  type VariableTransform,
} from '@/lib/modeling/outcome-driver-inference';

const variable = (id: string, label = id) => ({ id, label, description: null });

describe('inferOutcomeDriverOptions', () => {
  it('follows mixed model and ETL transforms across multiple steps', () => {
    const transforms: VariableTransform[] = [
      { outputs: [variable('outcome')], inputs: [variable('intermediate')] },
      { outputs: [variable('intermediate')], inputs: [variable('rain')] },
      { outputs: [variable('rain')], inputs: [variable('forcing')] },
    ];

    expect(inferOutcomeDriverOptions('outcome', transforms).map((item) => item.id)).toEqual([
      'forcing',
      'intermediate',
      'rain',
    ]);
  });

  it('deduplicates branches, handles cycles, and excludes the outcome', () => {
    const transforms: VariableTransform[] = [
      { outputs: [variable('outcome')], inputs: [variable('rain'), variable('soil')] },
      { outputs: [variable('rain')], inputs: [variable('soil')] },
      { outputs: [variable('soil')], inputs: [variable('outcome'), variable('bedrock')] },
      { outputs: [variable('outcome')], inputs: [variable('rain')] },
    ];

    expect(inferOutcomeDriverOptions('outcome', transforms).map((item) => item.id)).toEqual([
      'bedrock',
      'rain',
      'soil',
    ]);
  });

  it('uses an id fallback for a variable only named by a transform contract', () => {
    const result = inferOutcomeDriverOptions('outcome', [
      { outputs: [variable('outcome')], inputs: [{ id: 'https://example.org/rain' }] },
    ]);

    expect(result).toEqual([
      { id: 'https://example.org/rain', label: 'https://example.org/rain', description: null },
    ]);
  });

  it('walks through a format-only model output to upstream SVO drivers', () => {
    const transforms: VariableTransform[] = [
      {
        outputs: [{ id: 'spring__volume_flow_rate' }],
        inputs: [{ id: '', format: 'cbc-mf6' }],
      },
      {
        outputs: [{ id: '', format: 'cbc-mf6' }],
        inputs: [variable('groundwater__recharge_volume_flux')],
      },
    ];

    expect(
      inferOutcomeDriverOptions('spring__volume_flow_rate', transforms).map((item) => item.id),
    ).toEqual(['groundwater__recharge_volume_flux']);
  });

  it('connects an SVO-bearing model output to a format-only adapter input', () => {
    const transforms: VariableTransform[] = [
      {
        outputs: [
          {
            id: 'https://w3id.org/okn/i/mint/spring__volume_flow_rate',
            format: 'gma-scalar',
          },
        ],
        inputs: [{ id: '', format: 'cbc-mf6' }],
      },
      {
        outputs: [
          {
            id: 'https://w3id.org/okn/i/mint/aquifer_system__volumetric_budget',
            label: 'aquifer_system__volumetric_budget',
            format: 'cbc-mf6',
          },
        ],
        inputs: [variable('groundwater__recharge_volume_flux')],
      },
    ];

    expect(
      inferOutcomeDriverOptions(
        'https://w3id.org/okn/i/mint/spring__volume_flow_rate',
        transforms,
      ).map((item) => item.id),
    ).toEqual(['groundwater__recharge_volume_flux']);
  });

  it('does not connect unrelated SVOs just because they share a format', () => {
    const transforms: VariableTransform[] = [
      {
        kind: 'model',
        outputs: [{ id: 'groundwater__hydraulic_head', format: 'gma-scalar' }],
        inputs: [{ id: '', format: 'cbc-mf6' }],
      },
      {
        kind: 'adapter',
        outputs: [{ id: 'spring__volume_flow_rate', format: 'cbc-mf6' }],
        inputs: [variable('unrelated__forcing')],
      },
    ];

    expect(inferOutcomeDriverOptions('groundwater__hydraulic_head', transforms)).toEqual([]);
  });

  it('matches canonical catalog SVO IDs to slug-style adapter contracts', () => {
    const result = inferOutcomeDriverOptions(
      {
        id: 'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-hydraulic-head',
        label: 'groundwater__hydraulic_head',
      },
      [
        {
          outputs: [
            {
              id: 'https://w3id.org/okn/i/mint/groundwater__hydraulic_head',
              label: 'https://w3id.org/okn/i/mint/groundwater__hydraulic_head',
            },
          ],
          inputs: [variable('groundwater__recharge_volume_flux')],
        },
      ],
    );

    expect(result.map((item) => item.id)).toEqual(['groundwater__recharge_volume_flux']);
  });

  it('does not return a URI alias of the selected outcome as a driver', () => {
    const result = inferOutcomeDriverOptions(
      {
        id: 'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-hydraulic-head',
        label: 'groundwater__hydraulic_head',
      },
      [
        {
          outputs: [
            {
              id: 'https://w3id.org/okn/i/mint/groundwater__hydraulic_head',
              label: 'https://w3id.org/okn/i/mint/groundwater__hydraulic_head',
            },
          ],
          inputs: [
            {
              id: 'https://w3id.org/okn/i/mint/groundwater__hydraulic_head',
              label: 'https://w3id.org/okn/i/mint/groundwater__hydraulic_head',
            },
          ],
        },
      ],
    );

    expect(result).toEqual([]);
  });
});

describe('inferReachableModelConfigurationIds', () => {
  it('matches a model format through a multi-step adapter chain', () => {
    const transforms: ContractTransform[] = [
      {
        outputs: [{ id: 'spring__volume_flow_rate', format: 'gma-scalar' }],
        inputs: [{ id: 'spring__volume_flow_rate', format: 'm3s' }],
      },
      {
        outputs: [{ id: 'spring__volume_flow_rate', format: 'm3s' }],
        inputs: [{ id: '', format: 'cbc-mf6' }],
      },
    ];
    const modelOutputs: InferenceModelOutput[] = [
      { configurationId: 'modflow', output: { id: '', format: 'cbc-mf6' } },
      { configurationId: 'unrelated', output: { id: '', format: 'netcdf' } },
    ];

    expect(
      inferReachableModelConfigurationIds('spring__volume_flow_rate', modelOutputs, transforms),
    ).toEqual(new Set(['modflow']));
    expect(inferReachableContractKeys('spring__volume_flow_rate', transforms)).toEqual(
      new Set(['format:m3s', 'format:cbc-mf6']),
    );
  });

  it('keeps direct SVO outputs and ignores an unreachable format', () => {
    const modelOutputs: InferenceModelOutput[] = [
      { configurationId: 'direct', output: { id: 'outcome' } },
      { configurationId: 'unreachable', output: { id: '', format: 'other' } },
    ];
    expect(inferReachableModelConfigurationIds('outcome', modelOutputs, [])).toEqual(
      new Set(['direct']),
    );
  });
});
