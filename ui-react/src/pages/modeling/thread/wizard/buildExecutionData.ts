import type {
  GetConfigurationParametersQuery,
  GetModelTreeWithRegionsQuery,
} from '@/graphql/generated/modeling';
import { extractModelIO } from '@/graphql/generated/modeling';
import type {
  ModelParameter,
  ThreadExecutionData,
  ThreadModel,
} from '@/graphql/generated/execution';
import type { Thread } from '@/graphql/generated/modeling';

function parseAcceptedValues(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  // Could be comma-separated or JSON array
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // fall through
  }
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function paramRefToModelParameter(
  p: GetConfigurationParametersQuery['modelcatalog_configuration'][number]['parameters'][number],
): ModelParameter {
  const pr = p.parameter;
  return {
    id: pr.id,
    name: pr.label ?? pr.id,
    description: pr.description ?? undefined,
    type: pr.has_data_type ?? undefined,
    min: pr.has_minimum_accepted_value ?? undefined,
    max: pr.has_maximum_accepted_value ?? undefined,
    default: pr.has_default_value ?? undefined,
    accepted_values: parseAcceptedValues(pr.has_accepted_values) ?? undefined,
    position: pr.position ?? undefined,
    value: pr.has_fixed_value ?? undefined,
  };
}

/**
 * Build the ThreadExecutionData.models map from the selected thread models,
 * the model tree (for I/O), and the separately-fetched parameters.
 */
export function buildExecutionData(
  thread: Thread,
  modelTree: GetModelTreeWithRegionsQuery | undefined,
  parametersData: GetConfigurationParametersQuery | undefined,
): ThreadExecutionData {
  const base: ThreadExecutionData = {
    id: thread.id,
    models: {},
    model_ensembles: {},
    execution_summary: {},
    data: {},
    response_variables: thread.response_variable_id ? [thread.response_variable_id] : [],
  };

  if (!modelTree || !thread.thread_models?.length) return base;

  // Index configurations by id for quick lookup
  const configIndex = new Map<
    string,
    GetModelTreeWithRegionsQuery['modelcatalog_software'][number]['versions'][number]['configurations'][number]
  >();
  const parentIndex = new Map<
    string,
    GetModelTreeWithRegionsQuery['modelcatalog_software'][number]['versions'][number]['configurations'][number]
  >();
  for (const sw of modelTree.modelcatalog_software) {
    for (const ver of sw.versions) {
      for (const cfg of ver.configurations) {
        configIndex.set(cfg.id, cfg);
        for (const setup of cfg.child_configurations) {
          configIndex.set(setup.id, setup as unknown as typeof cfg);
          parentIndex.set(setup.id, cfg);
        }
      }
    }
  }

  // Index parameters by configuration id
  const paramIndex = new Map<
    string,
    GetConfigurationParametersQuery['modelcatalog_configuration'][number]['parameters']
  >();
  if (parametersData) {
    for (const cfg of parametersData.modelcatalog_configuration) {
      paramIndex.set(cfg.id, cfg.parameters);
    }
  }

  for (const tm of thread.thread_models ?? []) {
    const cfgId = tm.modelcatalog_configuration_id;
    if (!cfgId) continue;

    const node = configIndex.get(cfgId);
    if (!node) continue;

    const parent = parentIndex.get(cfgId);
    const io = extractModelIO(node);
    const parentIo = parent ? extractModelIO(parent) : null;
    const inputs = io.inputs.length > 0 ? io.inputs : (parentIo?.inputs ?? []);
    const outputs = io.outputs.length > 0 ? io.outputs : (parentIo?.outputs ?? []);

    // Get parameters — prefer setup's own parameters, fall back to parent's
    const rawParams =
      paramIndex.get(cfgId) ?? (parent ? paramIndex.get(parent.id) : undefined) ?? [];
    const parameters: ModelParameter[] = rawParams.map(paramRefToModelParameter);

    const threadModel: ThreadModel = {
      id: cfgId,
      name: node.label ?? cfgId,
      input_parameters: parameters,
      input_files: inputs.map((i) => ({
        id: i.id,
        name: i.name,
        variables: i.variableLabels,
      })),
      output_files: outputs.map((o) => ({
        id: o.id,
        name: o.name,
        variables: o.variableLabels,
      })),
    };

    base.models[cfgId] = threadModel;
    base.model_ensembles[cfgId] = { id: tm.id, bindings: {} };
  }

  return base;
}
