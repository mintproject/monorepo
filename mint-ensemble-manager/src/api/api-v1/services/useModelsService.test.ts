import useModelsService from "./useModelsService";
import { BadRequestError, NotFoundError } from "@/classes/common/errors";
import { AddDataRequest } from "../paths/problemStatements/tasks/subtasks";
import { Thread } from "@/classes/mint/mint-types";
import {
    fetchCustomModelConfigurationOrSetup,
    convertApiUrlToW3Id
} from "@/classes/mint/model-catalog-functions";
import { uuidv4 } from "@/classes/graphql/graphql_adapter";

// Mocks
jest.mock("@/classes/mint/model-catalog-functions", () => ({
    fetchCustomModelConfigurationOrSetup: jest.fn(),
    convertApiUrlToW3Id: jest.fn()
}));
jest.mock("@/classes/graphql/graphql_adapter", () => ({
    uuidv4: jest.fn()
}));

// Fixtures
const data: AddDataRequest = {
    model_id:
        "http://api.models.mint.local/v1.8.0/modelconfigurationsetups/c07a6f98-6339-4033-84b0-6cd7daca6284?username=mint%40isi.edu",
    data: [
        {
            id: "https://w3id.org/okn/i/mint/modflow_2005_Well",
            dataset: {
                id: "18400624-423c-42b5-ad56-6c73322584bd",
                resources: [
                    {
                        id: "9c7b25c4-8cea-4965-a07a-d9b3867f18a9",
                        url: "https://ckan.tacc.utexas.edu/dataset/18400624-423c-42b5-ad56-6c73322584bd/resource/9c7b25c4-8cea-4965-a07a-d9b3867f18a9/download/barton_springs_2001_2010average.wel"
                    }
                ]
            }
        },
        {
            id: "https://w3id.org/okn/i/mint/modflow_2005_Bas",
            dataset: {
                id: "18400624-423c-42b5-ad56-6c73322584bd",
                resources: [
                    {
                        id: "a36147f9-d141-46a9-a87c-633854c646f0",
                        url: "https://ckan.tacc.utexas.edu/dataset/18400624-423c-42b5-ad56-6c73322584bd/resource/a36147f9-d141-46a9-a87c-633854c646f0/download/barton_springs_2001_2010average.bas"
                    }
                ]
            }
        },
        {
            id: "https://w3id.org/okn/i/mint/modflow_2005_Dis",
            dataset: {
                id: "18400624-423c-42b5-ad56-6c73322584bd",
                resources: [
                    {
                        id: "685e34e6-f47c-4475-b918-7121108c63e1",
                        url: "https://ckan.tacc.utexas.edu/dataset/18400624-423c-42b5-ad56-6c73322584bd/resource/685e34e6-f47c-4475-b918-7121108c63e1/download/barton_springs_2001_2010average.dis"
                    }
                ]
            }
        },
        {
            id: "https://w3id.org/okn/i/mint/modflow_2005_Bcf",
            dataset: {
                id: "18400624-423c-42b5-ad56-6c73322584bd",
                resources: [
                    {
                        id: "6ea387f5-c5f6-43a6-b3cd-f4aa2235f81a",
                        url: "https://ckan.tacc.utexas.edu/dataset/18400624-423c-42b5-ad56-6c73322584bd/resource/6ea387f5-c5f6-43a6-b3cd-f4aa2235f81a/download/barton_springs_2001_2010average.bc6"
                    }
                ]
            }
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
const inputSpecs = [
    { id: "https://w3id.org/okn/i/mint/modflow_2005_Well", hasFixedResource: [] },
    { id: "https://w3id.org/okn/i/mint/modflow_2005_Bas", hasFixedResource: [] },
    { id: "https://w3id.org/okn/i/mint/modflow_2005_Dis", hasFixedResource: [] },
    { id: "https://w3id.org/okn/i/mint/modflow_2005_Bcf", hasFixedResource: [] }
];

const modelConfigSetup = {
    id: data.model_id,
    hasInput: inputSpecs
};

describe("useModelsService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fetchCustomModelConfigurationOrSetup as jest.Mock).mockResolvedValue(modelConfigSetup);
        (convertApiUrlToW3Id as jest.Mock).mockReturnValue(modelW3Id);
        let uuidCount = 0;
        (uuidv4 as jest.Mock).mockImplementation(() => `uuid-mock-${++uuidCount}`);
    });

    it("should bind dataslices to model inputs for matchModel", async () => {
        // Prepare a deep copy of subtask to avoid mutation between tests
        const subtaskCopy = JSON.parse(JSON.stringify(subtask));
        // Add empty arrays for bindings
        for (const input of inputSpecs) {
            subtaskCopy.model_ensembles[modelW3Id].bindings[input.id] = [];
        }
        await useModelsService.matchModel(data, subtaskCopy);
        for (const input of inputSpecs) {
            expect(subtaskCopy.model_ensembles[modelW3Id].bindings[input.id]).toHaveLength(1);
            expect(subtaskCopy.model_ensembles[modelW3Id].bindings[input.id][0]).toMatch(
                /^uuid-mock-/
            );
        }
    });

    it("should throw NotFoundError if model is not found in thread", async () => {
        const subtaskCopy = JSON.parse(JSON.stringify(subtask));
        subtaskCopy.model_ensembles = {};
        await expect(useModelsService.matchModel(data, subtaskCopy)).rejects.toThrow(NotFoundError);
    });

    it("should throw BadRequestError if data input is missing", () => {
        const model = { id: data.model_id, hasInput: [{ id: "missing", hasFixedResource: [] }] };
        const subtaskCopy = JSON.parse(JSON.stringify(subtask));
        expect(() => useModelsService.matchInputs(model, data, subtaskCopy)).toThrow(
            BadRequestError
        );
    });

    it("should throw BadRequestError if any input is left unbound after matching", async () => {
        // Remove one input from the data fixture so it cannot be bound
        const incompleteData = {
            ...data,
            data: data.data.slice(0, 3) // Remove the last input
        };
        const subtaskCopy = JSON.parse(JSON.stringify(subtask));
        for (const input of inputSpecs) {
            subtaskCopy.model_ensembles[modelW3Id].bindings[input.id] = [];
        }
        await expect(useModelsService.matchModel(incompleteData, subtaskCopy)).rejects.toThrow(
            BadRequestError
        );
    });
});
