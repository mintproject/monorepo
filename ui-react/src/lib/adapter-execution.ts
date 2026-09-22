import type { ApolloClient } from '@apollo/client';
import { gql } from '@apollo/client';

import type { UnifiedExecutionPlan, UnifiedParameterDefinition } from './ensemble-manager';

export interface ThreadAdapterPlan {
  id?: string;
  thread_model_id: string;
  model_io_id: string;
  source_resource_id: string;
  executor: 'svo_adapter';
  adapter_plan_id?: string | null;
  status: string;
  plan_json: UnifiedExecutionPlan & { parameters?: UnifiedParameterDefinition[] };
  parameter_values: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

type ThreadAdapterPlanRow = ThreadAdapterPlan;

type GetThreadAdapterPlansData = {
  thread_adapter_plan: ThreadAdapterPlanRow[];
};

export const GetThreadAdapterPlansDocument = gql`
  query GetThreadAdapterPlans($threadId: String!) {
    thread_adapter_plan(where: { thread_model: { thread_id: { _eq: $threadId } } }) {
      id
      thread_model_id
      model_io_id
      source_resource_id
      executor
      adapter_plan_id
      status
      plan_json
      parameter_values
      created_at
      updated_at
    }
  }
`;

type ReplaceThreadAdapterPlansData = {
  delete_thread_adapter_plan?: { affected_rows: number } | null;
  insert_thread_adapter_plan?: { returning: ThreadAdapterPlanRow[] } | null;
};

type ReplaceThreadAdapterPlansVariables = {
  threadId: string;
  plans: Array<{
    thread_model_id: string;
    model_io_id: string;
    source_resource_id: string;
    executor: 'svo_adapter';
    adapter_plan_id?: string | null;
    status: string;
    plan_json: unknown;
    parameter_values: unknown;
  }>;
};

const ReplaceThreadAdapterPlansDocument = gql`
  mutation ReplaceThreadAdapterPlans(
    $threadId: String!
    $plans: [thread_adapter_plan_insert_input!]!
  ) {
    delete_thread_adapter_plan(where: { thread_model: { thread_id: { _eq: $threadId } } }) {
      affected_rows
    }
    insert_thread_adapter_plan(objects: $plans) {
      returning {
        id
        thread_model_id
        model_io_id
        source_resource_id
        executor
        adapter_plan_id
        status
        plan_json
        parameter_values
        created_at
        updated_at
      }
    }
  }
`;

export async function fetchThreadAdapterPlans(
  apollo: ApolloClient<object>,
  threadId: string,
): Promise<ThreadAdapterPlan[]> {
  const result = await apollo.query<GetThreadAdapterPlansData>({
    query: GetThreadAdapterPlansDocument,
    variables: { threadId },
    fetchPolicy: 'network-only',
  });
  return result.data?.thread_adapter_plan ?? [];
}

export async function replaceThreadAdapterPlans(
  apollo: ApolloClient<object>,
  threadId: string,
  plans: ThreadAdapterPlan[],
): Promise<ThreadAdapterPlan[]> {
  const result = await apollo.mutate<
    ReplaceThreadAdapterPlansData,
    ReplaceThreadAdapterPlansVariables
  >({
    mutation: ReplaceThreadAdapterPlansDocument,
    variables: {
      threadId,
      plans: plans.map((plan) => ({
        thread_model_id: plan.thread_model_id,
        model_io_id: plan.model_io_id,
        source_resource_id: plan.source_resource_id,
        executor: plan.executor,
        adapter_plan_id: plan.adapter_plan_id ?? null,
        status: plan.status,
        plan_json: plan.plan_json,
        parameter_values: plan.parameter_values,
      })),
    },
  });
  return result.data?.insert_thread_adapter_plan?.returning ?? [];
}

export function adapterPlansByModel(
  plans: ThreadAdapterPlan[],
): Record<string, ThreadAdapterPlan[]> {
  return plans.reduce<Record<string, ThreadAdapterPlan[]>>((grouped, plan) => {
    (grouped[plan.thread_model_id] ??= []).push(plan);
    return grouped;
  }, {});
}

export function adapterPlanIsTransformRequired(plan: ThreadAdapterPlan): boolean {
  return plan.status === 'transform_required' || Boolean(plan.adapter_plan_id);
}

export function adapterPlanParameters(plan: ThreadAdapterPlan): UnifiedParameterDefinition[] {
  return plan.plan_json?.parameters ?? [];
}

export function adapterValueText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

export function adapterParameterKey(modelId: string, name: string): string {
  return `${modelId}::adapter::${name}`;
}

export function adapterParametersComplete(plans: ThreadAdapterPlan[]): boolean {
  return plans.every((plan) => {
    if (!adapterPlanIsTransformRequired(plan)) return true;
    return adapterPlanParameters(plan)
      .filter((parameter) => parameter.required)
      .every(
        (parameter) =>
          adapterValueText(plan.parameter_values?.[parameter.name]).trim() !== '' ||
          parameter.default !== undefined,
      );
  });
}
