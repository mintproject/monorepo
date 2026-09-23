import { getConfiguration } from "@/classes/mint/mint-functions";

export interface UnifiedExecutionRecord {
    id: string;
    plan_id: string;
    thread_id: string;
    model_id: string;
    execution_engine: string;
    status: string;
    idempotency_key: string;
    plan_hash: string;
    adapter_steps: unknown[];
    adapter_run_ids: unknown[];
    parameter_values: Record<string, unknown>;
    parameter_values_hash?: string;
    schema_version?: number;
    state_revision?: number;
    model_child_id?: string | null;
    model_output_id?: string | null;
    output_handoff?: unknown;
    failure_code?: string | null;
    model_result?: unknown;
    error_message?: string | null;
}

export interface UnifiedExecutionStore {
    getByPlanId(planId: string): Promise<UnifiedExecutionRecord | null>;
    getById(id: string): Promise<UnifiedExecutionRecord | null>;
    insert(input: Omit<UnifiedExecutionRecord, "id">): Promise<UnifiedExecutionRecord>;
    update(id: string, set: Record<string, unknown>): Promise<UnifiedExecutionRecord | null>;
    compareAndSet(
        id: string,
        expectedRevision: number,
        set: Record<string, unknown>
    ): Promise<UnifiedExecutionRecord | null>;
}

const GET_BY_PLAN = `
query GetUnifiedExecutionByPlan($planId: String!) {
  unified_execution(where: {plan_id: {_eq: $planId}}, limit: 1) {
    id plan_id thread_id model_id execution_engine status idempotency_key plan_hash
    adapter_steps adapter_run_ids parameter_values parameter_values_hash
    schema_version state_revision model_child_id model_output_id output_handoff
    failure_code model_result error_message
  }
}`;

const GET_BY_ID = `
query GetUnifiedExecutionById($id: uuid!) {
  unified_execution_by_pk(id: $id) {
    id plan_id thread_id model_id execution_engine status idempotency_key plan_hash
    adapter_steps adapter_run_ids parameter_values parameter_values_hash
    schema_version state_revision model_child_id model_output_id output_handoff
    failure_code model_result error_message
  }
}`;

const INSERT = `
mutation InsertUnifiedExecution($object: unified_execution_insert_input!) {
  insert_unified_execution_one(
    object: $object
    on_conflict: {constraint: unified_execution_plan_id_key, update_columns: []}
  ) {
    id plan_id thread_id model_id execution_engine status idempotency_key plan_hash
    adapter_steps adapter_run_ids parameter_values parameter_values_hash
    schema_version state_revision model_child_id model_output_id output_handoff
    failure_code model_result error_message
  }
}`;

const UPDATE = `
mutation UpdateUnifiedExecution($id: uuid!, $set: unified_execution_set_input!) {
  update_unified_execution_by_pk(pk_columns: {id: $id}, _set: $set) {
    id plan_id thread_id model_id execution_engine status idempotency_key plan_hash
    adapter_steps adapter_run_ids parameter_values parameter_values_hash
    schema_version state_revision model_child_id model_output_id output_handoff
    failure_code model_result error_message
  }
}`;

const COMPARE_AND_SET = `
mutation CompareAndSetUnifiedExecution(
  $id: uuid!
  $expectedRevision: Int!
  $set: unified_execution_set_input!
) {
  update_unified_execution(
    where: {id: {_eq: $id}, state_revision: {_eq: $expectedRevision}}
    _set: $set
    _inc: {state_revision: 1}
  ) {
    returning {
      id plan_id thread_id model_id execution_engine status idempotency_key plan_hash
      adapter_steps adapter_run_ids parameter_values parameter_values_hash
      schema_version state_revision model_child_id model_output_id output_handoff
      failure_code model_result error_message
    }
  }
}`;

function graphqlEndpoint(): string {
    const prefs = getConfiguration();
    const endpoint = prefs.graphql?.endpoint?.trim() || "";
    if (/^https?:\/\//i.test(endpoint)) return endpoint;
    return `${prefs.graphql?.enable_ssl ? "https" : "http"}://${endpoint}`;
}

async function hasuraRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const prefs = getConfiguration();
    if (!prefs.graphql?.secret || !prefs.graphql.endpoint) {
        throw new Error("Hasura admin configuration is required for unified execution state");
    }
    const response = await fetch(graphqlEndpoint(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Hasura-Admin-Secret": prefs.graphql.secret
        },
        body: JSON.stringify({ query, variables })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.errors?.length) {
        throw new Error(body.errors?.[0]?.message || `Hasura returned ${response.status}`);
    }
    return body.data as T;
}

export function createHasuraUnifiedExecutionStore(): UnifiedExecutionStore {
    return {
        async getByPlanId(planId) {
            const data = await hasuraRequest<{ unified_execution: UnifiedExecutionRecord[] }>(
                GET_BY_PLAN,
                { planId }
            );
            return data.unified_execution[0] || null;
        },
        async getById(id) {
            const data = await hasuraRequest<{ unified_execution_by_pk: UnifiedExecutionRecord | null }>(
                GET_BY_ID,
                { id }
            );
            return data.unified_execution_by_pk;
        },
        async insert(input) {
            const data = await hasuraRequest<{ insert_unified_execution_one: UnifiedExecutionRecord }>(
                INSERT,
                { object: input }
            );
            return data.insert_unified_execution_one;
        },
        async update(id, set) {
            const data = await hasuraRequest<{ update_unified_execution_by_pk: UnifiedExecutionRecord | null }>(
                UPDATE,
                { id, set }
            );
            return data.update_unified_execution_by_pk;
        },
        async compareAndSet(id, expectedRevision, set) {
            const data = await hasuraRequest<{
                update_unified_execution: { returning: UnifiedExecutionRecord[] };
            }>(
                COMPARE_AND_SET,
                { id, expectedRevision, set }
            );
            return data.update_unified_execution.returning[0] || null;
        }
    };
}
