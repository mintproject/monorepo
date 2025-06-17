import { ModelConfiguration, ModelConfigurationSetup } from "@mintproject/modelcatalog_client/dist";
import { Model_Insert_Input } from "../graphql/graph_typing";

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
        model_name: ""
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
        model_configuration: ""
    };
};
