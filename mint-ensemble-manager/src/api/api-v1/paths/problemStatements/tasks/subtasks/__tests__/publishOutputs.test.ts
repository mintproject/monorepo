import request from "supertest";
import express from "express";
import subtasksRouter from "../index";
import executionOutputsService from "@/api/api-v1/services/tapis/executionOutputsService";
import { getThread } from "@/classes/graphql/graphql_functions_v2";
import { threadFromGQL } from "@/classes/graphql/graphql_adapter";
import { NoOutputsDeclaredError, NotFoundError } from "@/classes/common/errors";

jest.mock("@/api/api-v1/services/subTasksService");
jest.mock("@/api/api-v1/services/tapis/executionOutputsService");
jest.mock("@/classes/graphql/graphql_functions_v2");
jest.mock("@/classes/graphql/graphql_adapter");
jest.mock("../executions", () => ({
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    executionsRouter: () => require("express").Router({ mergeParams: true })
}));
jest.mock("@/classes/mint/mint-functions", () => ({
    getConfiguration: jest.fn().mockReturnValue({})
}));

const AUTH = "Bearer test-token";
const SUBTASK_ID = "subtask-1";
const URL = `/subtasks/${SUBTASK_ID}/outputs`;

const threadWithExecutions = (executionIds: string[]) => ({
    thread_models: [
        {
            executions: executionIds.map((id) => ({ execution: { id } }))
        }
    ]
});

describe("POST /subtasks/:subtaskId/outputs", () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/subtasks", subtasksRouter());
        (threadFromGQL as jest.Mock).mockReturnValue({
            id: SUBTASK_ID,
            dataset_id: "dataset-1",
            permissions: []
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("reports the cause of every failed execution, and still publishes the others", async () => {
        (getThread as jest.Mock).mockResolvedValue(
            threadWithExecutions(["execution-ok", "execution-bad"])
        );
        (executionOutputsService.registerOutputs as jest.Mock)
            .mockResolvedValueOnce([{ resource: { id: "r1" } }])
            .mockRejectedValueOnce(
                new NotFoundError("No mint outputs found for model configuration-1")
            );

        const response = await request(app).post(URL).set("Authorization", AUTH).expect(200);

        expect(response.body.published).toBe(1);
        expect(response.body.errors).toEqual([
            {
                executionId: "execution-bad",
                name: "NotFoundError",
                message: "No mint outputs found for model configuration-1",
                statusCode: 404
            }
        ]);
    });

    it("does not answer 'No executions found' when every execution fails", async () => {
        (getThread as jest.Mock).mockResolvedValue(
            threadWithExecutions(["execution-1", "execution-2"])
        );
        (executionOutputsService.registerOutputs as jest.Mock)
            .mockRejectedValueOnce(
                new NotFoundError("No mint outputs found for model configuration-1")
            )
            .mockRejectedValueOnce(new Error("Hasura returned an error: permission denied"));

        const response = await request(app).post(URL).set("Authorization", AUTH).expect(400);

        expect(response.body.message).toBe("Failed to publish 2 of 2 executions");
        expect(response.body.errors).toEqual([
            {
                executionId: "execution-1",
                name: "NotFoundError",
                message: "No mint outputs found for model configuration-1",
                statusCode: 404
            },
            {
                executionId: "execution-2",
                name: "Error",
                message: "Hasura returned an error: permission denied"
            }
        ]);
    });

    it("answers 422 NO_OUTPUTS_DECLARED when every execution shares that cause", async () => {
        (getThread as jest.Mock).mockResolvedValue(
            threadWithExecutions(["execution-1", "execution-2"])
        );
        (executionOutputsService.registerOutputs as jest.Mock).mockRejectedValue(
            new NoOutputsDeclaredError()
        );

        const response = await request(app).post(URL).set("Authorization", AUTH).expect(422);

        expect(response.body.code).toBe("NO_OUTPUTS_DECLARED");
        expect(response.body.message).toBe(
            "This model configuration declares no outputs. Promote a file from the execution first."
        );
        expect(response.body.errors).toEqual([
            {
                executionId: "execution-1",
                name: "NoOutputsDeclaredError",
                message:
                    "This model configuration declares no outputs. Promote a file from the execution first.",
                statusCode: 422,
                code: "NO_OUTPUTS_DECLARED"
            },
            {
                executionId: "execution-2",
                name: "NoOutputsDeclaredError",
                message:
                    "This model configuration declares no outputs. Promote a file from the execution first.",
                statusCode: 422,
                code: "NO_OUTPUTS_DECLARED"
            }
        ]);
    });

    it("keeps 400 when the executions fail for different reasons", async () => {
        (getThread as jest.Mock).mockResolvedValue(
            threadWithExecutions(["execution-1", "execution-2"])
        );
        (executionOutputsService.registerOutputs as jest.Mock)
            .mockRejectedValueOnce(new NoOutputsDeclaredError())
            .mockRejectedValueOnce(new NotFoundError("No files found for model configuration-1"));

        const response = await request(app).post(URL).set("Authorization", AUTH).expect(400);

        expect(response.body.message).toBe("Failed to publish 2 of 2 executions");
        expect(response.body.code).toBeUndefined();
    });

    it("keeps 200 when one execution declares no output and another publishes", async () => {
        (getThread as jest.Mock).mockResolvedValue(
            threadWithExecutions(["execution-ok", "execution-bad"])
        );
        (executionOutputsService.registerOutputs as jest.Mock)
            .mockResolvedValueOnce([{ resource: { id: "r1" } }])
            .mockRejectedValueOnce(new NoOutputsDeclaredError());

        const response = await request(app).post(URL).set("Authorization", AUTH).expect(200);

        expect(response.body.published).toBe(1);
        expect(response.body.errors[0].code).toBe("NO_OUTPUTS_DECLARED");
    });

    it("answers 'No executions found to publish' only when the subtask has no execution", async () => {
        (getThread as jest.Mock).mockResolvedValue(threadWithExecutions([]));

        const response = await request(app).post(URL).set("Authorization", AUTH).expect(400);

        expect(response.body).toEqual({
            message: "No executions found to publish",
            errors: []
        });
        expect(executionOutputsService.registerOutputs).not.toHaveBeenCalled();
    });

    it("answers 200 with no error when every execution publishes", async () => {
        (getThread as jest.Mock).mockResolvedValue(
            threadWithExecutions(["execution-1", "execution-2"])
        );
        (executionOutputsService.registerOutputs as jest.Mock).mockResolvedValue([
            { resource: { id: "r1" } }
        ]);

        const response = await request(app).post(URL).set("Authorization", AUTH).expect(200);

        expect(response.body).toEqual({
            message: "Outputs registered successfully",
            published: 2,
            errors: []
        });
    });

    it("answers 404 when the subtask does not exist", async () => {
        (getThread as jest.Mock).mockResolvedValue(null);

        const response = await request(app).post(URL).set("Authorization", AUTH).expect(404);

        expect(response.body.message).toBe("Subtask not found");
    });
});
