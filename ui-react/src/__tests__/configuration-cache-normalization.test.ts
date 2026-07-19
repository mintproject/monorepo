// Regression for the /modelconfigurations/:slug Apollo error #5
// ("Missing field 'configuration_id' while writing result
//  { time_interval: {...}, __typename: 'modelcatalog_configuration_time_interval' }").
//
// Junction types declare composite keyFields in the real typePolicies, so every
// junction row the cache normalizes must carry both FK columns. The
// ConfigurationFields fragment selected `time_intervals { time_interval { ... } }`
// without the two key columns, so Apollo could not compute the cache key.
//
// MockedProvider does NOT apply typePolicies, so component tests cannot catch
// this — the assertion must run against the real cache + real generated document.
import { InMemoryCache } from '@apollo/client';
import { describe, it, expect } from 'vitest';

import {
  GetConfigurationDocument,
  GetOutputVariableOptionsDocument,
} from '@/graphql/generated/graphql';
import { typePolicies } from '@/lib/apollo-client';

describe('GetConfiguration cache normalization', () => {
  it('writes a configuration with time_intervals into the real keyed cache', () => {
    const cache = new InMemoryCache({ typePolicies });

    const data = {
      modelcatalog_configuration_by_pk: {
        __typename: 'modelcatalog_configuration',
        id: 'https://w3id.org/okn/i/mint/climcomp_0.0.2_P',
        label: 'clim_comp_P',
        description: null,
        software_version_id: 'https://w3id.org/okn/i/mint/climcomp_0.0.2',
        model_configuration_id: null,
        software_version: null,
        time_intervals: [
          {
            __typename: 'modelcatalog_configuration_time_interval',
            configuration_id: 'https://w3id.org/okn/i/mint/climcomp_0.0.2_P',
            time_interval_id: 'https://w3id.org/okn/i/mint/climcomp_0.0.2_P_cfg_TI',
            time_interval: {
              __typename: 'modelcatalog_time_interval',
              id: 'https://w3id.org/okn/i/mint/climcomp_0.0.2_P_cfg_TI',
              label: 'TI',
              description: null,
              interval_unit: null,
              interval_value: null,
            },
          },
        ],
        inputs: [],
        outputs: [],
        parameters: [],
        authors: [],
        regions: [],
      },
    };

    expect(() =>
      cache.writeQuery({ query: GetConfigurationDocument, data, variables: { id: 'x' } }),
    ).not.toThrow();
  });
});

describe('GetOutputVariableOptions cache normalization', () => {
  it('writes the nested junction chain into the real keyed cache', () => {
    const cache = new InMemoryCache({ typePolicies });

    const data = {
      modelcatalog_configuration_output: [
        {
          __typename: 'modelcatalog_configuration_output',
          configuration_id: 'cfg-1',
          output_id: 'ds-1',
          output: {
            __typename: 'modelcatalog_dataset_specification',
            id: 'ds-1',
            presentations: [
              {
                __typename: 'modelcatalog_dataset_specification_presentation',
                dataset_specification_id: 'ds-1',
                presentation_id: 'vp-1',
                presentation: {
                  __typename: 'modelcatalog_variable_presentation',
                  id: 'vp-1',
                  standard_variable: {
                    __typename: 'modelcatalog_standard_variable',
                    id: 'sv-1',
                    label: 'Temperature',
                  },
                },
              },
            ],
          },
        },
      ],
    };

    expect(() => cache.writeQuery({ query: GetOutputVariableOptionsDocument, data })).not.toThrow();
  });
});
