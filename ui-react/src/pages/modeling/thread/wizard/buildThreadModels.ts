import {
  extractModelIO,
  type GetModelTreeWithRegionsQuery,
  type ModelConfigInfo,
  type ModelSetupInfo,
  type Thread,
} from '@/graphql/generated/modeling';
import type { ThreadModel } from '../MintDatasets';

/** Flatten the tree to a map of configuration-id -> config/setup node. */
function indexConfigs(
  data: GetModelTreeWithRegionsQuery,
): Record<string, ModelConfigInfo | ModelSetupInfo> {
  const index: Record<string, ModelConfigInfo | ModelSetupInfo> = {};
  for (const sw of data.modelcatalog_software) {
    for (const ver of sw.versions) {
      for (const cfg of ver.configurations) {
        index[cfg.id] = cfg;
        for (const setup of cfg.child_configurations) index[setup.id] = setup;
      }
    }
  }
  return index;
}

/**
 * Build the per-model input map DatasetsStep consumes, keyed by configuration id,
 * from the thread's selected models and the extended model-tree query.
 */
export function buildThreadModels(
  thread: Thread,
  data: GetModelTreeWithRegionsQuery | undefined,
): Record<string, ThreadModel> {
  if (!data) return {};
  const index = indexConfigs(data);
  const result: Record<string, ThreadModel> = {};

  for (const tm of thread.thread_models ?? []) {
    const cfgId = tm.modelcatalog_configuration_id;
    if (!cfgId) continue;
    const node = index[cfgId];
    if (!node) continue;
    const io = extractModelIO(node);
    result[cfgId] = {
      id: cfgId,
      name: node.label ?? cfgId,
      input_files: io.inputs.map((i) => ({
        id: i.id,
        name: i.name,
        // The data catalog filters by standard-variable NAME (standard_variable_names__in),
        // so pass the variable labels, not the URI ids.
        variables: i.variableLabels,
        isOptional: i.optional,
      })),
    };
  }
  return result;
}
