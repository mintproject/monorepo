import { describe, expect, it } from 'vitest';

import {
  adapterParameterKey,
  adapterParameterValuesForSubmission,
  adapterParametersComplete,
  type ThreadAdapterPlan,
} from '@/lib/adapter-execution';

function plan(parameterValues: Record<string, unknown>): ThreadAdapterPlan {
  return {
    thread_model_id: 'thread-model-1',
    model_io_id: 'input-1',
    source_resource_id: 'resource-1',
    executor: 'svo_adapter',
    adapter_plan_id: 'adapter-plan-1',
    status: 'transform_required',
    plan_json: {
      plan_id: 'svo_adapter-plan-1',
      executor: 'svo_adapter',
      version: 1,
      status: 'transform_required',
      parameters: [{ name: 'springflow_layer', type: 'integer', required: true, minimum: 0 }],
      parameter_values: {},
    },
    parameter_values: parameterValues,
  };
}

describe('adapter-execution', () => {
  it('uses a model-scoped field name for adapter inputs', () => {
    expect(adapterParameterKey('model-1', 'springflow_layer')).toBe(
      'model-1::adapter::springflow_layer',
    );
  });

  it('does not mark a transform plan complete until required values are present', () => {
    expect(adapterParametersComplete([plan({})])).toBe(false);
    expect(adapterParametersComplete([plan({ springflow_layer: 2 })])).toBe(true);
  });

  it('does not require values for a direct-ready source', () => {
    const ready = plan({});
    ready.status = 'ready';
    ready.adapter_plan_id = null;
    expect(adapterParametersComplete([ready])).toBe(true);
  });

  it('treats a server-side default as complete without persisting a duplicate value', () => {
    const withDefault = plan({});
    withDefault.plan_json.parameters = [
      { name: 'springflow_layer', type: 'integer', required: true, default: 1 },
    ];
    expect(adapterParametersComplete([withDefault])).toBe(true);
  });

  it('does not require server-managed parameters from the user', () => {
    const withManagedParameter = plan({});
    withManagedParameter.plan_json.parameters = [
      { name: 'source_uri', type: 'string', required: true, managed: true },
    ];
    expect(adapterParametersComplete([withManagedParameter])).toBe(true);
  });

  it('keys post-model values by the newly-created server plan ID', () => {
    const postModel = plan({ gma_id: 'GMA 7', gma_boundary_uri: 'https://example.test/gma' });
    postModel.stage = 'post_model';
    postModel.adapter_plan_id = 'old-deferred-plan-id';

    expect(
      adapterParameterValuesForSubmission([postModel], {
        post_model_adapter: { adapter_plan_id: 'new-deferred-plan-id' },
      }),
    ).toEqual({
      'new-deferred-plan-id': {
        gma_id: 'GMA 7',
        gma_boundary_uri: 'https://example.test/gma',
      },
    });
  });
});
