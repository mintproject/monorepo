import request from "supertest";
import express from "express";
import { executionsRouter } from "../index";
import executionOutputsService from "@/api/api-v1/services/tapis/executionOutputsService";
import { getSubtask } from "@/classes/graphql/graphql_functions_v2";
import { threadFromGQL } from "@/classes/graphql/graphql_adapter";
import { BadRequestError, NoOutputsDeclaredError, NotFoundError } from "@/classes/common/errors";

jest.mock("@/api/api-v1/services/tapis/executionOutputsService");
jest.mock("@/classes/graphql/graphql_functions_v2");
jest.mock("@/classes/graphql/graphql_adapter");
jest.mock("@/classes/mint/mint-functions", () => ({
    getConfiguration: jest.fn().mockReturnValue({})
}));

const AUTH = "Bearer test-token";
const URL = "/executions/execution-1/outputs";

describe("POST /executions/:executionId/outputs", () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/executions", executionsRouter());
        (getSubtask as jest.Mock).mockResolvedValue({ id: "subtask-1" });
        (threadFromGQL as jest.Mock).mockReturnValue({
            id: "subtask-1",
            dataset_id: "dataset-1",
            permissions: []
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("answers 422 NO_OUTPUTS_DECLARED when the model configuration declares no output", async () => {
        (executionOutputsService.registerOutputs as jest.Mock).mockRejectedValue(
            new NoOutputsDeclaredError()
        );

        const response = await request(app).post(URL).set("Authorization", AUTH).expect(422);

        expect(response.body).toEqual({
            code: "NO_OUTPUTS_DECLARED",
            message:
                "This model configuration declares no outputs. Promote a file from the execution first."
        });
    });

    it("keeps 404 for an execution that does not exist", async () => {
        (executionOutputsService.registerOutputs as jest.Mock).mockRejectedValue(
            new NotFoundError("Execution not found")
        );

        const response = await request(app).post(URL).set("Authorization", AUTH).expect(404);

        expect(response.body.message).toBe("Execution not found");
    });

    it("keeps 400 for an execution that did not succeed", async () => {
        (executionOutputsService.registerOutputs as jest.Mock).mockRejectedValue(
            new BadRequestError("Execution is not successful")
        );

        const response = await request(app).post(URL).set("Authorization", AUTH).expect(400);

        expect(response.body.message).toBe("Execution is not successful");
    });

    it("answers 200 with the results when the execution publishes", async () => {
        (executionOutputsService.registerOutputs as jest.Mock).mockResolvedValue([
            { resource: { id: "r1" } }
        ]);

        const response = await request(app).post(URL).set("Authorization", AUTH).expect(200);

        expect(response.body).toEqual([{ resource: { id: "r1" } }]);
    });
});
