import { ExecutionCreation } from "../ExecutionCreation";
import { ModelIOBindings } from "../../mint/mint-types";
import { ThreadModelMap } from "../../mint/mint-types";
import { Thread } from "../../mint/mint-types";
import { ModelIO } from "../../mint/mint-types";
import { getRegionMockTexas } from "./mocks/getRegionMockTexas";
describe("ExecutionCreation", () => {
    describe("getInputBindingsAndTotalProducts", () => {
        it("should return correct input bindings and total products", () => {
            // Sample data for testing
            const dataBindings: ModelIOBindings = {
                input1: ["value1", "value2"],
                input2: ["valueA", "valueB"],
                input3: ["valueX"]
            };
            const inputIds = ["input1", "input2", "input3"];

            // Expected output
            const expectedInputBindings = [["value1", "value2"], ["valueA", "valueB"], ["valueX"]];
            const expectedTotalProducts = 4; // 2 (input1) * 2 (input2) * 1 (input3)

            // Call the method
            const { inputBindings, totalproducts } =
                ExecutionCreation.getInputBindingsAndTotalProducts(dataBindings, inputIds);

            // Assertions
            expect(inputBindings).toEqual(expectedInputBindings);
            expect(totalproducts).toBe(expectedTotalProducts);
        });

        it("should handle empty inputIds", () => {
            const dataBindings: ModelIOBindings = {};
            const inputIds: string[] = [];

            const { inputBindings, totalproducts } =
                ExecutionCreation.getInputBindingsAndTotalProducts(dataBindings, inputIds);

            expect(inputBindings).toEqual([]);
            expect(totalproducts).toBe(1); // No inputs means 1 combination (the empty product)
        });

        it("should handle missing dataBindings", () => {
            const dataBindings: ModelIOBindings = {
                input1: ["value1"],
                input2: [] // Simulating missing data
            };
            const inputIds = ["input1", "input2"];

            const { inputBindings, totalproducts } =
                ExecutionCreation.getInputBindingsAndTotalProducts(dataBindings, inputIds);

            expect(inputBindings).toEqual([["value1"], []]);
            expect(totalproducts).toBe(0); // Since input2 is undefined, total products should be 0
        });
    });

    describe("processInputParameter", () => {
        let threadModel: ThreadModelMap;

        beforeEach(() => {
            // Reset test objects before each test
            threadModel = {
                id: "test-model",
                bindings: {}
            };
        });

        it("should handle parameter with fixed value", () => {
            const param = {
                id: "param1",
                name: "Parameter 1",
                value: "fixed-value",
                position: 1,
                type: "string"
            };

            const inputIds = ExecutionCreation.processInputParameters(
                [param],
                threadModel,
                getRegionMockTexas
            );

            expect(inputIds).toContain("param1");
            expect(threadModel.bindings["param1"]).toEqual(["fixed-value"]);
        });

        it("should handle __region_geojson parameter", () => {
            const param = {
                id: "region_param",
                name: "Region Parameter",
                position: 1,
                type: "string"
            };
            threadModel.bindings["region_param"] = ["__region_geojson"];

            const inputIds = ExecutionCreation.processInputParameters(
                [param],
                threadModel,
                getRegionMockTexas
            );

            expect(inputIds).toContain("region_param");
            expect(threadModel.bindings["region_param"]).toEqual(["__region_geojson:texas"]);
        });

        it("should not modify bindings for parameter without value or special case", () => {
            const param = {
                id: "param2",
                name: "Parameter 2",
                position: 2,
                type: "string"
            };
            threadModel.bindings["param2"] = ["existing-value"];

            const inputIds = ExecutionCreation.processInputParameters(
                [param],
                threadModel,
                getRegionMockTexas
            );

            expect(inputIds).toContain("param2");
            expect(threadModel.bindings["param2"]).toEqual(["existing-value"]);
        });

        it("should handle parameter with no existing bindings", () => {
            const param = {
                id: "param3",
                name: "Parameter 3",
                position: 3,
                type: "string"
            };

            const inputIds = ExecutionCreation.processInputParameters(
                [param],
                threadModel,
                getRegionMockTexas
            );

            expect(inputIds).toContain("param3");
            expect(threadModel.bindings["param3"]).toBeUndefined();
        });
    });

    describe("processInputFile", () => {
        let modelEnsemble: ThreadModelMap;
        let thread: Thread;
        let modelInputs: ModelIO[];

        beforeEach(() => {
            // Reset test objects before each test
            modelEnsemble = {
                id: "test-model",
                bindings: {}
            };
            thread = {
                id: "test-thread",
                data: {
                    datasetType2: {
                        id: "datasetType2",
                        name: "Dataset Type 2",
                        total_resources: 2,
                        selected_resources: 2,
                        dataset: {
                            id: "datasetType2",
                            name: "Dataset Type 2"
                        },
                        resources: [
                            {
                                id: "datasetType2-res1",
                                name: "DataSetType2 Resource 1",
                                selected: true,
                                url: "https://example.com/datasetType2-res1",
                                spatial_coverage: {
                                    type: "Polygon",
                                    coordinates: [
                                        [
                                            [1, 2],
                                            [3, 4],
                                            [5, 6],
                                            [1, 2]
                                        ]
                                    ]
                                },
                                time_period: {
                                    start_date: new Date("2021-01-01"),
                                    end_date: new Date("2021-01-02")
                                }
                            },
                            {
                                id: "datasetType2-res2",
                                name: "DataSetType2 Resource 2",
                                selected: true,
                                url: "https://example.com/datasetType2-res2",
                                spatial_coverage: {
                                    type: "Polygon",
                                    coordinates: [
                                        [
                                            [1, 2],
                                            [3, 4],
                                            [5, 6],
                                            [1, 2]
                                        ]
                                    ]
                                },
                                time_period: {
                                    start_date: new Date("2021-01-01"),
                                    end_date: new Date("2021-01-02")
                                }
                            }
                        ]
                    }
                }
            } as unknown as Thread;
            modelInputs = [
                {
                    id: "file1",
                    name: "File 1",
                    value: {
                        resources: [
                            {
                                id: "datasetType1-res1",
                                selected: true,
                                url: "https://example.com/datasetType1-res1"
                            }
                        ]
                    },
                    position: 1,
                    type: "file",
                    variables: []
                }
            ];
        });

        it("should handle input file with predefined value", () => {
            const inputIds = ExecutionCreation.processInputFiles(
                modelInputs,
                modelEnsemble,
                thread
            );
            expect(inputIds).toContain("file1");
            expect(modelEnsemble.bindings["file1"]).toEqual([
                {
                    id: "datasetType1-res1",
                    selected: true,
                    url: "https://example.com/datasetType1-res1"
                }
            ]);
        });

        it("should handle input file with dataset bindings and selected resources", () => {
            modelInputs.push({
                id: "file2",
                name: "File 2",
                position: 2,
                type: "file",
                variables: []
            });

            modelEnsemble.bindings["file2"] = ["datasetType2"];
            const inputIds = ExecutionCreation.processInputFiles(
                modelInputs,
                modelEnsemble,
                thread
            );
            expect(inputIds).toContain("file2");
            expect(modelEnsemble.bindings["file2"].length).toBe(2);
        });

        it("should handle input file with dataset bindings and selected one unselected resource", () => {
            modelInputs.push({
                id: "file2",
                name: "File 2",
                position: 2,
                type: "file",
                variables: []
            });

            thread.data["datasetType2"].resources[0].selected = false;

            modelEnsemble.bindings["file2"] = ["datasetType2"];
            const inputIds = ExecutionCreation.processInputFiles(
                modelInputs,
                modelEnsemble,
                thread
            );
            expect(inputIds).toContain("file2");
            expect(modelEnsemble.bindings["file2"].length).toBe(1);
        });
    });

    describe("processInputParameterCollection", () => {
        let threadModel: ThreadModelMap;

        beforeEach(() => {
            // Reset test objects before each test
            threadModel = {
                id: "test-model",
                bindings: {}
            };
        });

        it("should not modify bindings for parameter without value or special case", () => {
            const param = {
                id: "param2",
                name: "Parameter 2",
                position: 2,
                type: "string"
            };
            threadModel.bindings["param2"] = ["value1", "value2"];

            const inputIds = ExecutionCreation.processInputParameters(
                [param],
                threadModel,
                getRegionMockTexas
            );

            expect(inputIds).toContain("param2");
            expect(threadModel.bindings["param2"]).toEqual(["value1", "value2"]);
        });

        it("should handle parameter with no existing bindings", () => {
            const param = {
                id: "param3",
                name: "Parameter 3",
                position: 3,
                type: "string"
            };

            const inputIds = ExecutionCreation.processInputParameters(
                [param],
                threadModel,
                getRegionMockTexas
            );

            expect(inputIds).toContain("param3");
            expect(threadModel.bindings["param3"]).toBeUndefined();
        });
    });
});
