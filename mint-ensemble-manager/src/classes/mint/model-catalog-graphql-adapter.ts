import {
    DatasetSpecification,
    ModelConfiguration,
    ModelConfigurationSetup,
    Parameter
} from "@mintproject/modelcatalog_client/dist";
import {
    Model_Input_Arr_Rel_Insert_Input,
    Model_Insert_Input,
    Model_Output_Arr_Rel_Insert_Input,
    Model_Parameter_Arr_Rel_Insert_Input,
    Model_Parameter_Insert_Input
} from "../graphql/types";

export const modelInputToGraphQL = (
    dataset: DatasetSpecification[]
): Model_Input_Arr_Rel_Insert_Input => {
    return {
        data: dataset.map((dataset) => ({
            position: dataset.position?.[0] || 0,
            model_io: {
                data: {
                    id: dataset.id,
                    name: dataset.label?.[0] || "",
                    type: dataset.type?.[0] || "",
                    description: dataset.description?.[0] || "",
                    format: dataset.hasFormat?.[0] || ""
                }
            }
        }))
    };
};

export const modelOutputToGraphQL = (
    dataset: DatasetSpecification[]
): Model_Output_Arr_Rel_Insert_Input => {
    return {
        data: dataset.map((dataset) => ({
            position: dataset.position?.[0] || 0,
            model_io: {
                data: {
                    id: dataset.id,
                    name: dataset.label?.[0] || "",
                    type: dataset.type?.[0] || "",
                    description: dataset.description?.[0] || "",
                    format: dataset.hasFormat?.[0] || ""
                }
            }
        }))
    };
};

export const modelParameterToGraphQL = (parameter: Parameter): Model_Parameter_Insert_Input => {
    return {
        id: parameter.id,
        name: parameter.label?.[0] || "",
        description: parameter.description?.[0] || "",
        default: parameter.hasDefaultValue?.[0] || "",
        fixed_value: parameter.hasFixedValue?.[0] || "",
        unit: parameter.hasPresentation?.[0]?.usesUnit?.[0]?.id || "",
        min: parameter.hasMinimumAcceptedValue?.[0] || "",
        max: parameter.hasMaximumAcceptedValue?.[0] || "",
        type: parameter.type?.[0] || "",
        accepted_values: parameter.hasAcceptedValues?.[0] || "",
        position: parameter.position?.[0] || 0,
        datatype: parameter.hasDataType?.[0] || ""
    };
};

export const modelParametersToGraphQL = (
    parameter: Parameter[]
): Model_Parameter_Arr_Rel_Insert_Input => {
    const data = parameter.map((parameter) => modelParameterToGraphQL(parameter));
    return {
        data: data
    };
};

export const modelConfigurationToGraphQL = (
    modelConfiguration: ModelConfiguration
): Model_Insert_Input => {
    return {
        id: modelConfiguration.id || "",
        name: modelConfiguration.label?.[0] || "",
        description: modelConfiguration.description?.[0] || "",
        category: modelConfiguration.hasModelCategory?.[0]?.label?.[0] || "",
        type: modelConfiguration.type?.[0] || "",
        region_name: modelConfiguration.hasRegion?.[0]?.label?.[0] || "",
        dimensionality: modelConfiguration.hasDownloadInstructions?.[0] || "",
        parameter_assignment: modelConfiguration.parameterization?.[0] || "",
        parameter_assignment_details: modelConfiguration.hasAssumption?.[0] || "",
        calibration_target_variable: modelConfiguration.hasOutputVariable?.[0]?.id || "",
        spatial_grid_type: modelConfiguration.hasGrid?.[0]?.label?.[0] || "",
        spatial_grid_resolution: modelConfiguration.hasGrid?.[0]?.label?.[0] || "",
        usage_notes: modelConfiguration.hasUsageNotes?.[0] || "",
        code_url: modelConfiguration.hasComponentLocation?.[0] || "",
        output_time_interval: modelConfiguration.hasOutputTimeInterval?.[0]?.id || "",
        model_configuration: modelConfiguration.id || "",
        software_image: modelConfiguration.hasSoftwareImage?.[0]?.label?.[0] || "",
        model_version: modelConfiguration.hasVersion?.[0]?.id || "",
        model_name: "",
        inputs: modelInputToGraphQL(modelConfiguration.hasInput || []),
        parameters: modelParametersToGraphQL(modelConfiguration.hasParameter || []),
        outputs: modelOutputToGraphQL(modelConfiguration.hasOutput || [])
    };
};

export const modelConfigurationSetupToGraphQL = (
    modelConfigurationSetup: ModelConfigurationSetup
): Model_Insert_Input => {
    return {
        id: modelConfigurationSetup.id || "",
        name: modelConfigurationSetup.label?.[0] || "",
        description: modelConfigurationSetup.description?.[0] || "",
        category: modelConfigurationSetup.hasModelCategory?.[0]?.label?.[0] || "",
        type: modelConfigurationSetup.type?.[0] || "",
        region_name: modelConfigurationSetup.hasRegion?.[0]?.label?.[0] || "",
        dimensionality: modelConfigurationSetup.hasDownloadInstructions?.[0] || "",
        parameter_assignment: modelConfigurationSetup.parameterization?.[0] || "",
        parameter_assignment_details: modelConfigurationSetup.hasAssumption?.[0] || "",
        calibration_target_variable: modelConfigurationSetup.hasOutputVariable?.[0]?.id || "",
        spatial_grid_type: modelConfigurationSetup.hasGrid?.[0]?.label?.[0] || "",
        spatial_grid_resolution: modelConfigurationSetup.hasGrid?.[0]?.label?.[0] || "",
        usage_notes: modelConfigurationSetup.hasUsageNotes?.[0] || "",
        code_url: modelConfigurationSetup.hasComponentLocation?.[0] || "",
        output_time_interval: modelConfigurationSetup.hasOutputTimeInterval?.[0]?.id || "",
        // model_configuration: modelConfigurationSetup.id || "",
        software_image: modelConfigurationSetup.hasSoftwareImage?.[0]?.label?.[0] || "",
        model_version: modelConfigurationSetup.hasVersion?.[0]?.id || "",
        model_name: "",
        model_configuration: "",
        inputs: modelInputToGraphQL(modelConfigurationSetup.hasInput || []),
        parameters: modelParametersToGraphQL(modelConfigurationSetup.hasParameter || []),
        outputs: modelOutputToGraphQL(modelConfigurationSetup.hasOutput || [])
    };
};
