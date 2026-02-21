import { Thread } from "@/classes/mint/mint-types";
import { AddParametersRequest } from "../../paths/problemStatements/tasks/subtasks";
import { BadRequestError, NotFoundError } from "@/classes/common/errors";
import { convertApiUrlToW3Id, CatalogParameter, CatalogModelConfigurationSetup, CatalogModelConfiguration } from "@/classes/mint/model-catalog-graphql-adapter";
import { GraphQL } from "@/config/graphql";
import { KeycloakAdapter } from "@/config/keycloak-adapter";
import getModelcatalogConfigurationGQL from "@/classes/graphql/queries/model/get-modelcatalog-configuration.graphql";
import getModelcatalogSetupGQL from "@/classes/graphql/queries/model/get-modelcatalog-setup.graphql";

// Inline interface for parameter with fixed value (new flat shape from Hasura)
interface ModelParameter {
    id: string;
    has_fixed_value?: string;
}

// Inline interface for model with parameters
interface ModelWithParameters {
    id: string;
    hasParameter: ModelParameter[];
}

const fetchModelByW3Id = async (
    w3Id: string,
    accessToken?: string
): Promise<CatalogModelConfiguration | CatalogModelConfigurationSetup> => {
    const apolloClient = accessToken
        ? GraphQL.instanceUsingAccessToken(accessToken)
        : GraphQL.instance(KeycloakAdapter.getUser());

    // Try configuration first
    const configResult = await apolloClient.query({
        query: getModelcatalogConfigurationGQL,
        variables: { id: w3Id },
        fetchPolicy: "no-cache"
    });
    const catalogConfig = configResult.data?.modelcatalog_model_configuration_by_pk;
    if (catalogConfig) {
        return catalogConfig as CatalogModelConfiguration;
    }

    // Fall back to setup
    const setupResult = await apolloClient.query({
        query: getModelcatalogSetupGQL,
        variables: { id: w3Id },
        fetchPolicy: "no-cache"
    });
    const catalogSetup = setupResult.data?.modelcatalog_model_configuration_setup_by_pk;
    if (catalogSetup) {
        return catalogSetup as CatalogModelConfigurationSetup;
    }

    return null;
};

/**
 * Converts a GraphQL catalog model (new shape) to the ModelWithParameters shape.
 * New shape: model.parameters = [{parameter: {id, has_fixed_value, ...}}]
 */
const catalogModelToModelWithParameters = (
    model: CatalogModelConfiguration | CatalogModelConfigurationSetup
): ModelWithParameters => {
    const parameters = ((model as any).parameters || []).map((row: any) => ({
        id: row.parameter.id,
        has_fixed_value: row.parameter.has_fixed_value
    }));
    return {
        id: model.id,
        hasParameter: parameters
    };
};

const hasParameterHasFixedValue = (parameter: ModelParameter) => {
    return !!parameter.has_fixed_value;
};

const getModelParameters = async (model: ModelWithParameters): Promise<CatalogParameter[]> => {
    const parameters: CatalogParameter[] = [];
    const modelParameters = model.hasParameter;
    for (const parameter of modelParameters) {
        if (!hasParameterHasFixedValue(parameter)) {
            parameters.push({ id: parameter.id } as CatalogParameter);
        }
    }
    return parameters;
};

const matchParameters = async (
    model: ModelWithParameters,
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

const validateThatAllParametersAreBound = (model: ModelWithParameters, thread: Thread) => {
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
            const catalogModel = await fetchModelByW3Id(modelW3Id);
            if (!catalogModel) {
                throw new NotFoundError("Model not found");
            }
            const model = catalogModelToModelWithParameters(catalogModel);
            await matchParameters(model, data, subtask);
            validateThatAllParametersAreBound(model, subtask);
        }
    }
    if (!match) {
        throw new NotFoundError("Model not found");
    }
};

const getModelParametersByModelId = async (model_id: string) => {
    const w3Id = convertApiUrlToW3Id(model_id);
    const catalogModel = await fetchModelByW3Id(w3Id);
    if (!catalogModel) {
        throw new NotFoundError("Model not found");
    }
    const model = catalogModelToModelWithParameters(catalogModel);
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
