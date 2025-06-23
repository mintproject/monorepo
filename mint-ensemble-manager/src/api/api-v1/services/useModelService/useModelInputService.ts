import { DataMap, Dataslice, Thread } from "@/classes/mint/mint-types";
import { AddDataRequest, DataInput } from "../../paths/problemStatements/tasks/subtasks";
import { uuidv4 } from "@/classes/graphql/graphql_adapter";
import {
    DatasetSpecification,
    ModelConfiguration,
    ModelConfigurationSetup
} from "@mintproject/modelcatalog_client/dist";
import { BadRequestError, NotFoundError } from "@/classes/common/errors";
import {
    convertApiUrlToW3Id,
    fetchCustomModelConfigurationOrSetup
} from "@/classes/mint/model-catalog-functions";

const createDataSlice = (dataInput: DataInput, thread: Thread) => {
    const sliceid = uuidv4();
    const dataslice = {
        id: sliceid,
        total_resources: dataInput.dataset.resources.length,
        selected_resources: dataInput.dataset.resources.length,
        resources: dataInput.dataset.resources.map((r) => ({
            ...r,
            time_period: {
                start_date: thread.dates.start_date,
                end_date: thread.dates.end_date
            },
            name: r.id,
            selected: true
        })),
        time_period: thread.dates,
        name: dataInput.dataset.id,
        resources_loaded: true,
        dataset: {
            ...dataInput.dataset,
            resource_count: dataInput.dataset.resources.length
        }
    } as Dataslice;
    return dataslice;
};

const hasInputHasFixedResource = (input: DatasetSpecification) => {
    return input.hasFixedResource && input.hasFixedResource.length > 0;
};

const findDataSpecificationByRequest = (input: DatasetSpecification, data: AddDataRequest) => {
    const dataInput = data.data.find((d) => d.id === input.id);
    if (!dataInput) {
        throw new BadRequestError(`Data input ${input.id} has not been provided`);
    }
    return dataInput;
};

const createBinding = (
    input: DatasetSpecification,
    data: AddDataRequest,
    thread: Thread
): Dataslice => {
    const dataInput = findDataSpecificationByRequest(input, data);
    return createDataSlice(dataInput, thread);
};

const validateThatAllInputsAreBound = (
    model: ModelConfiguration | ModelConfigurationSetup,
    thread: Thread
) => {
    const modelInputs = model.hasInput;
    const w3id = convertApiUrlToW3Id(model.id);
    for (const input of modelInputs) {
        if (
            !hasInputHasFixedResource(input) &&
            thread.model_ensembles[w3id].bindings[input.id].length === 0
        ) {
            throw new BadRequestError(`Input ${input.id} is not bound`);
        }
    }
};

const getDataBindings = async (
    model: ModelConfiguration | ModelConfigurationSetup
): Promise<DatasetSpecification[]> => {
    const inputs: DatasetSpecification[] = [];
    const modelInputs = model.hasInput;
    for (const input of modelInputs) {
        if (!hasInputHasFixedResource(input)) {
            inputs.push(input);
        }
    }
    return inputs;
};

const matchInputs = async (
    model: ModelConfiguration | ModelConfigurationSetup,
    data: AddDataRequest,
    thread: Thread
) => {
    const dataMap: DataMap = {};
    const modelInputs = model.hasInput;
    const w3id = convertApiUrlToW3Id(model.id);
    if (modelInputs && modelInputs.length > 0) {
        for (const input of modelInputs) {
            if (!hasInputHasFixedResource(input)) {
                const dataslice = createBinding(input, data, thread);
                dataMap[dataslice.id] = dataslice;
                if (thread.model_ensembles[w3id].bindings[input.id]) {
                    thread.model_ensembles[w3id].bindings[input.id].push(dataslice.id);
                } else {
                    thread.model_ensembles[w3id].bindings[input.id] = [dataslice.id];
                }
            }
        }
    }
    return dataMap;
};

const setInputBindings = async (data: AddDataRequest, subtask: Thread) => {
    let match = false;
    for (const [modelW3Id] of Object.entries(subtask.model_ensembles)) {
        if (modelW3Id === convertApiUrlToW3Id(data.model_id)) {
            match = true;
            const model = await fetchCustomModelConfigurationOrSetup(data.model_id);
            if (!model) {
                throw new NotFoundError("Model not found");
            }
            const dataMap = await matchInputs(model, data, subtask);
            validateThatAllInputsAreBound(model, subtask);
            return dataMap;
        }
    }
    if (!match) {
        throw new NotFoundError("Model not found");
    }
};

const getDataBindingsByModelId = async (model_id: string) => {
    const model = await fetchCustomModelConfigurationOrSetup(model_id);
    if (!model) {
        throw new NotFoundError("Model not found");
    }
    return await getDataBindings(model);
};

const useModelInputService = {
    getDataBindingsByModelId,
    matchInputs,
    createDataSlice,
    hasInputHasFixedResource,
    findDataSpecificationByRequest,
    createBinding,
    validateThatAllInputsAreBound,
    getDataBindings,
    setInputBindings
};

export default useModelInputService;
