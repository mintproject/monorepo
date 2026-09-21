export interface InferenceVariable {
  id: string;
  label?: string | null;
  description?: string | null;
}

/** A transform whose outputs may be produced from its inputs. */
export interface VariableTransform {
  outputs: ReadonlyArray<InferenceVariable>;
  inputs: ReadonlyArray<InferenceVariable>;
}

export const DEFAULT_MAX_INFERRED_DRIVERS = 1000;

/**
 * Return the variables that can feed an outcome through one or more
 * transforms. The graph is intentionally existential: the UI is offering
 * possible drivers, not claiming that every returned variable is sufficient
 * on its own to execute a complete model chain.
 */
export function inferOutcomeDriverOptions(
  outcomeId: string,
  transforms: ReadonlyArray<VariableTransform>,
  maxDrivers = DEFAULT_MAX_INFERRED_DRIVERS,
): InferenceVariable[] {
  const variables = new Map<string, InferenceVariable>();
  const upstreamByOutput = new Map<string, Set<string>>();

  const remember = (variable: InferenceVariable) => {
    const id = variable.id.trim();
    if (!id) return;
    if (!variables.has(id)) {
      variables.set(id, {
        ...variable,
        id,
        label: variable.label?.trim() || id,
        description: variable.description?.trim() || null,
      });
    }
  };

  for (const transform of transforms) {
    for (const output of transform.outputs) remember(output);
    for (const input of transform.inputs) remember(input);

    const inputIds = transform.inputs.map((input) => input.id.trim()).filter(Boolean);
    for (const output of transform.outputs) {
      const outputId = output.id.trim();
      if (!outputId || inputIds.length === 0) continue;
      const upstream = upstreamByOutput.get(outputId) ?? new Set<string>();
      for (const inputId of inputIds) upstream.add(inputId);
      upstreamByOutput.set(outputId, upstream);
    }
  }

  const normalizedOutcomeId = outcomeId.trim();
  if (!normalizedOutcomeId) return [];

  const reachable = new Set<string>();
  const visited = new Set<string>([normalizedOutcomeId]);
  const queue = [normalizedOutcomeId];

  while (queue.length > 0 && reachable.size < maxDrivers) {
    const producedId = queue.shift()!;
    for (const inputId of upstreamByOutput.get(producedId) ?? []) {
      if (inputId === normalizedOutcomeId) continue;
      if (reachable.size >= maxDrivers) break;
      reachable.add(inputId);
      if (!visited.has(inputId)) {
        visited.add(inputId);
        queue.push(inputId);
      }
    }
  }

  return [...reachable]
    .map((id) => variables.get(id) ?? { id, label: id, description: null })
    .sort((a, b) => (a.label || a.id).localeCompare(b.label || b.id));
}
