import {
    Model_Input_Arr_Rel_Insert_Input,
    Model_Insert_Input,
    Model_Output_Arr_Rel_Insert_Input,
    Model_Parameter_Arr_Rel_Insert_Input,
    Model_Parameter_Insert_Input
} from "../graphql/types";

const W3_ID_URI_PREFIX = "https://w3id.org/okn/i/mint/";

/**
 * Converts a Model Catalog REST API URL to a W3ID URI.
 * e.g. https://api.models.mint.local/v1.8.0/modelconfigurations/UUID?username=x
 *      -> https://w3id.org/okn/i/mint/UUID
 */
export const convertApiUrlToW3Id = (url: string): string => {
    const baseUrl = url.split("?")[0];
    const urlParts = baseUrl.split("/");
    const id = urlParts.pop();
    return W3_ID_URI_PREFIX + id;
};

/**
 * Converts a W3ID URI back to a Model Catalog REST API URL (string manipulation only, no REST call).
 * e.g. https://w3id.org/okn/i/mint/UUID -> https://api.models.mint.local/v1.8.0/modelconfigurations/UUID
 */
export const convertW3IdToApiUrl = (w3Id: string, baseApiUrl: string, type: "modelconfigurations" | "modelconfigurationsetups" = "modelconfigurations"): string => {
    const uuid = w3Id.replace(W3_ID_URI_PREFIX, "");
    return `${baseApiUrl}/${type}/${uuid}`;
};

// Types matching GraphQL query response shapes (flat scalar fields, not array-wrapped)
export interface CatalogDatasetSpec {
    id: string;
    label?: string;
    description?: string;
    has_format?: string;
    position?: number;
}

export interface CatalogParameter {
    id: string;
    label?: string;
    description?: string;
    has_default_value?: string;
    has_fixed_value?: string;
    has_minimum_accepted_value?: string;
    has_maximum_accepted_value?: string;
    parameter_type?: string;
    position?: number;
    has_accepted_values?: string[] | null;
    has_data_type?: string;
}

// Junction row types matching GraphQL query traversal pattern
export interface CatalogSetupParameterRow {
    parameter: CatalogParameter;
}

export interface CatalogSetupInputRow {
    input: CatalogDatasetSpec;
}

export interface CatalogSetupOutputRow {
    output: CatalogDatasetSpec;
}

export interface CatalogConfigurationParameterRow {
    parameter: CatalogParameter;
}

export interface CatalogConfigurationInputRow {
    input: CatalogDatasetSpec;
}

export interface CatalogConfigurationOutputRow {
    output: CatalogDatasetSpec;
}

export interface CatalogModelConfigurationSetup {
    id: string;
    label?: string;
    description?: string;
    has_software_image?: string;
    has_component_location?: string;
    parameters?: CatalogSetupParameterRow[];
    inputs?: CatalogSetupInputRow[];
    outputs?: CatalogSetupOutputRow[];
}

export interface CatalogModelConfiguration {
    id: string;
    label?: string;
    description?: string;
    has_component_location?: string;
    has_software_image?: string;
    parameters?: CatalogConfigurationParameterRow[];
    inputs?: CatalogConfigurationInputRow[];
    outputs?: CatalogConfigurationOutputRow[];
}

export const modelInputToGraphQL = (
    datasets: CatalogDatasetSpec[]
): Model_Input_Arr_Rel_Insert_Input => {
    return {
        data: datasets.map((dataset) => ({
            position: dataset.position || 0,
            model_io: {
                data: {
                    id: dataset.id,
                    name: dataset.label || "",
                    type: "",
                    description: dataset.description || "",
                    format: dataset.has_format || ""
                }
            }
        }))
    };
};

export const modelOutputToGraphQL = (
    datasets: CatalogDatasetSpec[]
): Model_Output_Arr_Rel_Insert_Input => {
    return {
        data: datasets.map((dataset) => ({
            position: dataset.position || 0,
            model_io: {
                data: {
                    id: dataset.id,
                    name: dataset.label || "",
                    type: "",
                    description: dataset.description || "",
                    format: dataset.has_format || ""
                }
            }
        }))
    };
};

export const modelParameterToGraphQL = (
    parameter: CatalogParameter
): Model_Parameter_Insert_Input => {
    return {
        id: parameter.id,
        name: parameter.label || "",
        description: parameter.description || "",
        default: parameter.has_default_value || "",
        fixed_value: parameter.has_fixed_value || "",
        unit: "",
        min: parameter.has_minimum_accepted_value || "",
        max: parameter.has_maximum_accepted_value || "",
        type: parameter.parameter_type || "",
        accepted_values: parameter.has_accepted_values?.[0] || "",
        position: parameter.position?.[0] || 0,
        datatype: parameter.has_data_type || ""
    };
};

export const modelParametersToGraphQL = (
    parameters: CatalogParameter[]
): Model_Parameter_Arr_Rel_Insert_Input => {
    const data = parameters.map((parameter) => modelParameterToGraphQL(parameter));
    return {
        data: data
    };
};

export const modelConfigurationToGraphQL = (
    modelConfiguration: CatalogModelConfiguration
): Model_Insert_Input => {
    const inputs = (modelConfiguration.inputs || []).map((row) => row.input);
    const outputs = (modelConfiguration.outputs || []).map((row) => row.output);
    const parameters = (modelConfiguration.parameters || []).map((row) => row.parameter);

    return {
        id: modelConfiguration.id || "",
        name: modelConfiguration.label || "",
        description: modelConfiguration.description || "",
        category: "",
        type: "",
        region_name: "",
        dimensionality: "",
        parameter_assignment: "",
        parameter_assignment_details: "",
        calibration_target_variable: "",
        spatial_grid_type: "",
        spatial_grid_resolution: "",
        usage_notes: "",
        code_url: modelConfiguration.has_component_location || "",
        output_time_interval: "",
        model_configuration: modelConfiguration.id || "",
        software_image: modelConfiguration.has_software_image || "",
        model_version: "",
        model_name: "",
        inputs: modelInputToGraphQL(inputs),
        parameters: modelParametersToGraphQL(parameters),
        outputs: modelOutputToGraphQL(outputs)
    };
};

export const modelConfigurationSetupToGraphQL = (
    modelConfigurationSetup: CatalogModelConfigurationSetup
): Model_Insert_Input => {
    const inputs = (modelConfigurationSetup.inputs || []).map((row) => row.input);
    const outputs = (modelConfigurationSetup.outputs || []).map((row) => row.output);
    const parameters = (modelConfigurationSetup.parameters || []).map((row) => row.parameter);

    return {
        id: modelConfigurationSetup.id || "",
        name: modelConfigurationSetup.label || "",
        description: modelConfigurationSetup.description || "",
        category: "",
        type: "",
        region_name: "",
        dimensionality: "",
        parameter_assignment: "",
        parameter_assignment_details: "",
        calibration_target_variable: "",
        spatial_grid_type: "",
        spatial_grid_resolution: "",
        usage_notes: "",
        code_url: modelConfigurationSetup.has_component_location || "",
        output_time_interval: "",
        model_configuration: "",
        software_image: modelConfigurationSetup.has_software_image || "",
        model_version: "",
        model_name: "",
        inputs: modelInputToGraphQL(inputs),
        parameters: modelParametersToGraphQL(parameters),
        outputs: modelOutputToGraphQL(outputs)
    };
};
