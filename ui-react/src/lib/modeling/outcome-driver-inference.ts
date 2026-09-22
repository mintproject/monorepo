export interface InferenceVariable {
  id: string;
  label?: string | null;
  description?: string | null;
  format?: string | null;
}

/** A catalog or adapter contract can be identified by an SVO, a file format, or both. */
export interface InferenceContract extends InferenceVariable {
  format?: string | null;
}

/** A transform whose outputs may be produced from its inputs. */
export interface VariableTransform {
  outputs: ReadonlyArray<InferenceVariable>;
  inputs: ReadonlyArray<InferenceVariable>;
  kind?: InferenceTransformKind;
}

export interface ContractTransform {
  outputs: ReadonlyArray<InferenceContract>;
  inputs: ReadonlyArray<InferenceContract>;
  kind?: InferenceTransformKind;
}

export type InferenceTransformKind = 'model' | 'etl' | 'adapter';

export interface InferenceModelOutput {
  configurationId: string;
  output: InferenceContract;
}

export type OutcomeReference = string | Pick<InferenceVariable, 'id' | 'label'>;

export const DEFAULT_MAX_INFERRED_DRIVERS = 1000;

function contractKeys(contract: InferenceContract): string[] {
  const id = contract.id.trim();
  const keys: string[] = [];
  if (id) keys.push(`svo:${id}`);

  // Catalog SVOs use UUID or named MINT identifiers, while adapter contracts
  // commonly use the trailing SVO slug. Match both forms by their shared
  // semantic name when it is available. Exact IDs remain in the key set so
  // unrelated URI namespaces do not get collapsed accidentally.
  const label = contract.label?.trim().toLowerCase();
  if (label?.includes('__')) keys.push(`svo-name:${label}`);

  const lastSegment = id.split('/').pop();
  const slug = lastSegment ? lastSegment.trim().toLowerCase() : '';
  if (slug?.includes('__')) keys.push(`svo-name:${slug}`);

  const format = contract.format?.trim();
  // Keep the format key even when an SVO is present. A model output can carry
  // both an SVO and a file format, while an adapter contract may constrain
  // only that format (for example, a MODFLOW CBC file). Both contracts must
  // therefore meet on the format edge.
  if (format) keys.push(`format:${format}`);
  return [...new Set(keys)];
}

function outcomeContract(outcome: OutcomeReference): InferenceContract {
  return typeof outcome === 'string' ? { id: outcome } : outcome;
}

function semanticContractKeys(contract: InferenceContract): string[] {
  return contractKeys(contract).filter(
    (key) => key.startsWith('svo:') || key.startsWith('svo-name:'),
  );
}

/**
 * Match semantic SVOs exactly, using format only to bridge a format-only
 * contract. A format must not connect two unrelated SVO-bearing contracts.
 */
function contractsCanConnect(
  produced: InferenceContract,
  transformOutput: InferenceContract,
  allowFormatBridge = true,
): boolean {
  const producedSemanticKeys = semanticContractKeys(produced);
  const outputSemanticKeys = semanticContractKeys(transformOutput);
  if (producedSemanticKeys.some((key) => outputSemanticKeys.includes(key))) {
    return true;
  }

  if (!allowFormatBridge || (producedSemanticKeys.length > 0 && outputSemanticKeys.length > 0)) {
    return false;
  }

  const producedFormat = produced.format?.trim();
  const outputFormat = transformOutput.format?.trim();
  return Boolean(producedFormat && outputFormat && producedFormat === outputFormat);
}

function contractSignature(contract: InferenceContract): string {
  return contractKeys(contract).sort().join('|');
}

function inferReachableInputContracts(
  outcome: OutcomeReference,
  transforms: ReadonlyArray<ContractTransform>,
): InferenceContract[] {
  const outcomeContractValue = outcomeContract(outcome);
  if (contractKeys(outcomeContractValue).length === 0) return [];

  const reachable: InferenceContract[] = [];
  const queued = new Set<string>([contractSignature(outcomeContractValue)]);
  const queue: InferenceContract[] = [outcomeContractValue];

  while (queue.length > 0) {
    const produced = queue.shift()!;
    for (const transform of transforms) {
      if (
        transform.inputs.length === 0 ||
        !transform.outputs.some((output) =>
          contractsCanConnect(produced, output, transform.kind !== 'adapter'),
        )
      ) {
        continue;
      }

      for (const input of transform.inputs) {
        if (contractKeys(input).length === 0) continue;
        reachable.push(input);

        const signature = contractSignature(input);
        if (!queued.has(signature)) {
          queued.add(signature);
          queue.push(input);
        }
      }
    }
  }

  return reachable;
}

/**
 * Walk registered transforms backwards from an outcome. Exact SVO ids are
 * preferred; format-only contracts (for example a MODFLOW CBC file) are
 * matched by their exact format.
 */
export function inferReachableContractKeys(
  outcome: OutcomeReference,
  transforms: ReadonlyArray<ContractTransform>,
): Set<string> {
  const outcomeKeys = contractKeys(outcomeContract(outcome));
  const reachable = new Set<string>();
  for (const input of inferReachableInputContracts(outcome, transforms)) {
    for (const key of contractKeys(input)) {
      if (!outcomeKeys.includes(key)) reachable.add(key);
    }
  }
  return reachable;
}

/** Return model configurations whose output can satisfy an outcome directly or through ETLs. */
export function inferReachableModelConfigurationIds(
  outcome: OutcomeReference,
  modelOutputs: ReadonlyArray<InferenceModelOutput>,
  transforms: ReadonlyArray<ContractTransform>,
): Set<string> {
  const outcomeValue = outcomeContract(outcome);
  const reachableInputs = inferReachableInputContracts(outcome, transforms);

  return new Set(
    modelOutputs
      .filter((candidate) => {
        return (
          contractsCanConnect(candidate.output, outcomeValue) ||
          reachableInputs.some((input) => contractsCanConnect(candidate.output, input, true))
        );
      })
      .map((candidate) => candidate.configurationId),
  );
}

/**
 * Return the variables that can feed an outcome through one or more
 * transforms. The graph is intentionally existential: the UI is offering
 * possible drivers, not claiming that every returned variable is sufficient
 * on its own to execute a complete model chain.
 */
export function inferOutcomeDriverOptions(
  outcome: OutcomeReference,
  transforms: ReadonlyArray<VariableTransform>,
  maxDrivers = DEFAULT_MAX_INFERRED_DRIVERS,
): InferenceVariable[] {
  const variables = new Map<string, InferenceVariable>();

  const rememberInput = (variable: InferenceVariable) => {
    const keys = contractKeys(variable);
    if (keys.length === 0) return;
    for (const key of keys) {
      if (!variables.has(key)) {
        variables.set(key, {
          ...variable,
          id: variable.id.trim(),
          label: variable.label?.trim() || variable.id.trim() || variable.format?.trim() || key,
          description: variable.description?.trim() || null,
        });
      }
    }
  };

  for (const transform of transforms) {
    for (const input of transform.inputs) rememberInput(input);
  }

  const outcomeKeys = contractKeys(outcomeContract(outcome));
  if (outcomeKeys.length === 0) return [];
  const reachableInputs = inferReachableInputContracts(outcome, transforms);

  const uniqueVariables = new Map<string, InferenceVariable>();
  for (const input of reachableInputs) {
    // Use semantic keys to look up a concrete input variable. In particular,
    // do not look up by format: that would re-introduce every SVO-bearing
    // variable that happens to share a format with a format-only adapter.
    const variable = semanticContractKeys(input)
      .map((key) => variables.get(key))
      .find(Boolean);
    if (!variable?.id.trim()) continue;
    const variableKeys = contractKeys(variable);
    // A single semantic SVO can arrive through multiple URI aliases. If any
    // alias identifies the selected outcome, exclude the whole variable rather
    // than leaking another URI for the outcome back into the driver list.
    if (variableKeys.some((candidate) => outcomeKeys.includes(candidate))) continue;
    const semanticKey = variableKeys.find((candidate) => candidate.startsWith('svo-name:'));
    const dedupeKey = semanticKey ?? variableKeys[0];
    if (!dedupeKey) continue;
    if (!uniqueVariables.has(dedupeKey)) uniqueVariables.set(dedupeKey, variable);
    if (uniqueVariables.size >= maxDrivers) break;
  }

  return [...uniqueVariables.values()]
    .sort((a, b) => (a.label || a.id).localeCompare(b.label || b.id))
    .slice(0, maxDrivers);
}
