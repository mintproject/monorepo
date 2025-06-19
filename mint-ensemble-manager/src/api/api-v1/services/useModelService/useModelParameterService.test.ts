import useModelParameterService from "./useModelParameterService";
import { BadRequestError, NotFoundError } from "@/classes/common/errors";
import { AddParametersRequest } from "../../paths/problemStatements/tasks/subtasks";
import { Thread } from "@/classes/mint/mint-types";
import {
    fetchCustomModelConfigurationOrSetup,
    convertApiUrlToW3Id
} from "@/classes/mint/model-catalog-functions";
import { ModelConfigurationSetup, Parameter } from "@mintproject/modelcatalog_client/dist";

// Mocks
jest.mock("@/classes/mint/model-catalog-functions", () => ({
    fetchCustomModelConfigurationOrSetup: jest.fn(),
    convertApiUrlToW3Id: jest.fn()
}));

// Fixtures
const bindingRequest: AddParametersRequest = {
    model_id:
        "http://api.models.mint.local/v1.8.0/modelconfigurationsetups/c07a6f98-6339-4033-84b0-6cd7daca6284?username=mint%40isi.edu",
    parameters: [
        {
            id: "https://w3id.org/okn/i/mint/parameter1",
            value: "value1"
        },
        {
            id: "https://w3id.org/okn/i/mint/parameter2",
            value: ["value2a", "value2b"]
        }
    ]
};

const subtask: Thread = {
    id: "IBPfQmxbzJ3GseVKh7Hz",
    task_id: "FEUMjksoMJdsIseM44q4",
    regionid: "texas",
    name: "test2",
    dates: {
        start_date: new Date("2023-12-31T00:00:00.000Z"),
        end_date: new Date("2025-12-31T00:00:00.000Z")
    },
    driving_variables: [],
    response_variables: [],
    execution_summary: {},
    events: [
        {
            event: "CREATE",
            userid: "mosorio",
            timestamp: new Date("2025-06-17T19:48:23.751Z"),
            notes: ""
        },
        {
            event: "SELECT_MODELS",
            userid: "mosorio",
            timestamp: new Date("2025-06-18T14:28:19.320Z"),
            notes: ""
        }
    ],
    models: {
        "https://w3id.org/okn/i/mint/c07a6f98-6339-4033-84b0-6cd7daca6284": {
            id: "https://w3id.org/okn/i/mint/c07a6f98-6339-4033-84b0-6cd7daca6284",
            name: "MODFLOW 2005 setup calibrated for Drought assessment (Recharge file is selected)",
            description: "Modflow configuration ",
            category: "Hydrology",
            region_name: "",
            dimensionality: "3D",
            model_version: "https://w3id.org/okn/i/mint/modflow_2005",
            model_name: "https://w3id.org/okn/i/mint/MODFLOW",
            model_configuration: "https://w3id.org/okn/i/mint/modflow_2005_cfg",
            parameter_assignment: "Calibration",
            parameter_assignment_details: "",
            calibration_target_variable: "",
            spatial_grid_type: "SpatiallyDistributedGrid",
            spatial_grid_resolution: "variable range",
            code_url: "https://portals.tapis.io/v3/apps/modflow-2005/0.0.6",
            software_image: "mintproject/modflow-2005:latest",
            input_files: [],
            output_files: [],
            input_parameters: []
        }
    },
    data: {},
    model_ensembles: {
        "https://w3id.org/okn/i/mint/c07a6f98-6339-4033-84b0-6cd7daca6284": {
            id: "e6681044-dd68-4618-8cc6-fa35db021030",
            bindings: {}
        }
    }
};

const modelW3Id = "https://w3id.org/okn/i/mint/c07a6f98-6339-4033-84b0-6cd7daca6284";

describe("useModelParameterService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (convertApiUrlToW3Id as jest.Mock).mockReturnValue(modelW3Id);
    });

    it("should check if parameter has fixed value", () => {
        const parameterWithFixed = { id: "test", hasFixedValue: ["fixed-value"] } as Parameter;
        const parameterWithoutFixed = { id: "test", hasFixedValue: [] } as Parameter;

        expect(useModelParameterService.hasParameterHasFixedValue(parameterWithFixed)).toBe(true);
        expect(useModelParameterService.hasParameterHasFixedValue(parameterWithoutFixed)).toBe(
            false
        );
    });

    it("should get model parameters excluding fixed values", async () => {
        const modelConfigSetup = {
            id: bindingRequest.model_id,
            hasParameter: [
                { id: "https://w3id.org/okn/i/mint/parameter1", hasFixedValue: [] },
                { id: "https://w3id.org/okn/i/mint/parameter2", hasFixedValue: [] },
                { id: "https://w3id.org/okn/i/mint/parameter3", hasFixedValue: ["fixed-value"] }
            ]
        } as ModelConfigurationSetup;

        const parameters = await useModelParameterService.getModelParameters(modelConfigSetup);
        expect(parameters).toHaveLength(2);
        expect(parameters.map((p: Parameter) => p.id)).toEqual([
            "https://w3id.org/okn/i/mint/parameter1",
            "https://w3id.org/okn/i/mint/parameter2"
        ]);
    });

    it("should get model parameters by model id", async () => {
        const modelConfigSetup = {
            id: bindingRequest.model_id,
            hasParameter: [
                { id: "https://w3id.org/okn/i/mint/parameter1", hasFixedValue: [] },
                { id: "https://w3id.org/okn/i/mint/parameter2", hasFixedValue: [] }
            ]
        } as ModelConfigurationSetup;

        (fetchCustomModelConfigurationOrSetup as jest.Mock).mockResolvedValue(modelConfigSetup);

        const parameters = await useModelParameterService.getModelParametersByModelId(
            bindingRequest.model_id
        );
        expect(parameters).toHaveLength(2);
        expect(parameters.map((p: Parameter) => p.id)).toEqual([
            "https://w3id.org/okn/i/mint/parameter1",
            "https://w3id.org/okn/i/mint/parameter2"
        ]);
    });

    it("should throw NotFoundError when model is not found", async () => {
        (fetchCustomModelConfigurationOrSetup as jest.Mock).mockResolvedValue(null);
        await expect(
            useModelParameterService.getModelParametersByModelId("invalid-id")
        ).rejects.toThrow(NotFoundError);
    });

    it("should match parameters correctly", async () => {
        const modelConfigSetup = {
            id: bindingRequest.model_id,
            hasParameter: [
                { id: "https://w3id.org/okn/i/mint/parameter1", hasFixedValue: [] },
                { id: "https://w3id.org/okn/i/mint/parameter2", hasFixedValue: [] }
            ]
        } as ModelConfigurationSetup;

        const subtaskCopy = JSON.parse(JSON.stringify(subtask));
        await useModelParameterService.matchParameters(
            modelConfigSetup,
            bindingRequest,
            subtaskCopy
        );

        expect(
            subtaskCopy.model_ensembles[modelW3Id].bindings[
                "https://w3id.org/okn/i/mint/parameter1"
            ]
        ).toEqual(["value1"]);
        expect(
            subtaskCopy.model_ensembles[modelW3Id].bindings[
                "https://w3id.org/okn/i/mint/parameter2"
            ]
        ).toEqual(["value2a", "value2b"]);
    });

    it("should throw BadRequestError if parameter is not provided", async () => {
        const incompleteData = {
            ...bindingRequest,
            parameters: bindingRequest.parameters.slice(0, 1) // Remove the second parameter
        };
        const modelConfigSetup = {
            id: bindingRequest.model_id,
            hasParameter: [
                { id: "https://w3id.org/okn/i/mint/parameter1", hasFixedValue: [] },
                { id: "https://w3id.org/okn/i/mint/parameter2", hasFixedValue: [] }
            ]
        } as ModelConfigurationSetup;

        const subtaskCopy = JSON.parse(JSON.stringify(subtask));

        await expect(
            useModelParameterService.matchParameters(modelConfigSetup, incompleteData, subtaskCopy)
        ).rejects.toThrow(BadRequestError);
    });

    it("should set parameter bindings successfully", async () => {
        const modelConfigSetup = {
            id: bindingRequest.model_id,
            hasParameter: [
                { id: "https://w3id.org/okn/i/mint/parameter1", hasFixedValue: [] },
                { id: "https://w3id.org/okn/i/mint/parameter2", hasFixedValue: [] }
            ]
        } as ModelConfigurationSetup;

        (fetchCustomModelConfigurationOrSetup as jest.Mock).mockResolvedValue(modelConfigSetup);

        const subtaskCopy = JSON.parse(JSON.stringify(subtask));
        await useModelParameterService.setParameterBindings(bindingRequest, subtaskCopy);

        expect(
            subtaskCopy.model_ensembles[modelW3Id].bindings[
                "https://w3id.org/okn/i/mint/parameter1"
            ]
        ).toEqual(["value1"]);
        expect(
            subtaskCopy.model_ensembles[modelW3Id].bindings[
                "https://w3id.org/okn/i/mint/parameter2"
            ]
        ).toEqual(["value2a", "value2b"]);
    });

    it("should throw NotFoundError if model is not found in thread", async () => {
        const subtaskCopy = JSON.parse(JSON.stringify(subtask));
        subtaskCopy.model_ensembles = {};
        await expect(
            useModelParameterService.setParameterBindings(bindingRequest, subtaskCopy)
        ).rejects.toThrow(NotFoundError);
    });
});
