import { DataResource, Dataslice, Thread } from "@/classes/mint/mint-types";

export interface ExecutionInputOverride {
    model_io_id: string;
    resource_id: string;
    name?: string;
    url: string;
}

/**
 * Overlay adapter-produced resources onto one in-memory thread before the
 * existing execution builders expand its input bindings.  The overlay is
 * intentionally not persisted as thread data: it belongs to this unified run
 * and the generated execution records retain the actual resource URL.
 */
export function applyExecutionInputOverrides(
    thread: Thread,
    modelId: string,
    overrides: ExecutionInputOverride[]
): void {
    if (!overrides.length) return;

    const model = thread.models[modelId];
    const ensemble = thread.model_ensembles[modelId];
    if (!model || !ensemble) {
        throw new Error(`Model '${modelId}' is not selected on thread '${thread.id}'`);
    }

    const validInputs = new Set(model.input_files.map((input) => input.id));
    const byInput = new Map<string, string[]>();

    for (const override of overrides) {
        if (!validInputs.has(override.model_io_id)) {
            throw new Error(
                `Adapter output targets '${override.model_io_id}', which is not an input of model '${modelId}'`
            );
        }
        if (!override.resource_id || !override.url) {
            throw new Error("Adapter output must include a resource_id and url");
        }

        const sliceId = [
            "__unified_adapter_output",
            thread.id,
            modelId,
            override.model_io_id,
            override.resource_id
        ]
            .join(":")
            .replace(/[^A-Za-z0-9:_-]/g, "_");
        const resource: DataResource = {
            id: override.resource_id,
            name: override.name || override.resource_id,
            url: override.url,
            selected: true
        };
        const slice: Dataslice = {
            id: sliceId,
            name: `Adapter output ${override.name || override.resource_id}`,
            resources: [resource],
            selected_resources: 1,
            total_resources: 1,
            resources_loaded: true
        };
        thread.data[sliceId] = slice;
        const ids = byInput.get(override.model_io_id) || [];
        if (!ids.includes(sliceId)) ids.push(sliceId);
        byInput.set(override.model_io_id, ids);
    }

    for (const [modelIoId, sliceIds] of byInput) {
        ensemble.bindings[modelIoId] = sliceIds;
    }
}
