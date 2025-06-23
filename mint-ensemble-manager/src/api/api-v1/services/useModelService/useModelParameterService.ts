import { Thread } from "@/classes/mint/mint-types";
import { AddParametersRequest } from "../../paths/problemStatements/tasks/subtasks";
import {
    Parameter,
    ModelConfiguration,
    ModelConfigurationSetup
} from "@mintproject/modelcatalog_client/dist";
import { BadRequestError, NotFoundError } from "@/classes/common/errors";
import {
    convertApiUrlToW3Id,
    fetchCustomModelConfigurationOrSetup
} from "@/classes/mint/model-catalog-functions";
// import { setThreadParameters } from "@/classes/graphql/graphql_functions";

const hasParameterHasFixedValue = (parameter: Parameter) => {
    return parameter.hasFixedValue && parameter.hasFixedValue.length > 0;
};

const getModelParameters = async (model: ModelConfiguration | ModelConfigurationSetup) => {
    const parameters: Parameter[] = [];
    const modelParameters = model.hasParameter;
    for (const parameter of modelParameters) {
        if (!hasParameterHasFixedValue(parameter)) {
            parameters.push(parameter);
        }
    }
    return parameters;
};

const matchParameters = async (
    model: ModelConfiguration | ModelConfigurationSetup,
    data: AddParametersRequest,
    thread: Thread
) => {
    const w3id = convertApiUrlToW3Id(model.id);
    if (model.hasParameter && model.hasParameter.length > 0) {
        for (const parameter of model.hasParameter) {
            if (!hasParameterHasFixedValue(parameter)) {
                const parameterInput = data.parameters.find((p) => p.id === parameter.id);
                if (!parameterInput) {
                    throw new BadRequestError(`Parameter ${parameter.id} is not provided`);
                }
                if (parameterInput.value instanceof Array) {
                    thread.model_ensembles[w3id].bindings[parameter.id] =
                        parameterInput.value as string[];
                } else {
                    thread.model_ensembles[w3id].bindings[parameter.id] = [
                        parameterInput.value
                    ] as string[];
                }
            }
        }
    }
};

const validateThatAllParametersAreBound = (
    model: ModelConfiguration | ModelConfigurationSetup,
    thread: Thread
) => {
    const modelParameters = model.hasParameter;
    const w3id = convertApiUrlToW3Id(model.id);
    for (const parameter of modelParameters) {
        if (!hasParameterHasFixedValue(parameter)) {
            if (thread.model_ensembles[w3id].bindings[parameter.id].length === 0) {
                throw new BadRequestError(`Parameter ${parameter.id} is not bound`);
            }
        }
    }
};

const setParameterBindings = async (data: AddParametersRequest, subtask: Thread) => {
    let match = false;
    for (const [modelW3Id] of Object.entries(subtask.model_ensembles)) {
        if (modelW3Id === convertApiUrlToW3Id(data.model_id)) {
            match = true;
            const model = await fetchCustomModelConfigurationOrSetup(data.model_id);
            if (!model) {
                throw new NotFoundError("Model not found");
            }
            await matchParameters(model, data, subtask);
            validateThatAllParametersAreBound(model, subtask);
        }
    }
    if (!match) {
        throw new NotFoundError("Model not found");
    }
};

const getModelParametersByModelId = async (model_id: string) => {
    const model = await fetchCustomModelConfigurationOrSetup(model_id);
    if (!model) {
        throw new NotFoundError("Model not found");
    }
    return await getModelParameters(model);
};

const useModelParameterService = {
    matchParameters,
    setParameterBindings,
    getModelParametersByModelId,
    getModelParameters,
    hasParameterHasFixedValue
};

export default useModelParameterService;
