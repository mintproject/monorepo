import { describe, expect, it } from 'vitest';
import type { GetModelTreeWithRegionsQuery, Thread } from '@/graphql/generated/modeling';
import { buildThreadModels } from '../buildThreadModels';

const tree: GetModelTreeWithRegionsQuery = {
  modelcatalog_software: [
    {
      id: 'sw',
      label: 'PIHM',
      versions: [
        {
          id: 'v1',
          label: 'v4',
          configurations: [
            {
              id: 'cfgA',
              label: 'PIHM Flood A',
              regions: [],
              inputs: [
                {
                  is_optional: false,
                  input: {
                    id: 'inA',
                    label: 'precipitation',
                    presentations: [
                      {
                        presentation: {
                          id: 'vp',
                          standard_variable: { id: 'sv-precip', label: 'precip' },
                        },
                      },
                    ],
                  },
                },
              ],
              outputs: [],
              child_configurations: [],
            },
          ],
        },
      ],
    },
  ],
};

function thread(): Thread {
  return {
    __typename: 'thread',
    id: 't1',
    name: 'X',
    task_id: 'task1',
    start_date: '2000-01-01',
    end_date: '2026-01-01',
    region_id: null,
    driving_variable_id: null,
    response_variable_id: null,
    events: [],
    permissions: [],
    thread_models: [
      {
        __typename: 'thread_model',
        id: 'tm1',
        thread_id: 't1',
        modelcatalog_configuration_id: 'cfgA',
      },
    ],
  };
}

describe('buildThreadModels', () => {
  it('maps selected configuration ids to ThreadModel with input variable names', () => {
    const models = buildThreadModels(thread(), tree);
    expect(Object.keys(models)).toEqual(['cfgA']);
    expect(models.cfgA?.name).toBe('PIHM Flood A');
    expect(models.cfgA?.input_files).toEqual([
      { id: 'inA', name: 'precipitation', variables: ['sv-precip'], isOptional: false },
    ]);
  });

  it('returns an empty map when no models are selected', () => {
    const t = thread();
    t.thread_models = [];
    expect(buildThreadModels(t, tree)).toEqual({});
  });
});
