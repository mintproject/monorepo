import request from "supertest";
import express from "express";
import executionsRouter from "../executions";
import executionsService from "@/api/api-v1/services/executionsService";
import executionFilesService from "@/api/api-v1/services/executionFilesService";
import { BadRequestError, NotFoundError, UnauthorizedError } from "@/classes/common/errors";

jest.mock("@/api/api-v1/services/executionsService");
jest.mock("@/api/api-v1/services/executionFilesService");
// The Keycloak adapter reads the configuration when it loads. It reaches this
// module through logsService, so the mock answers an object from the start.
jest.mock("@/classes/mint/mint-functions", () => ({
    getConfiguration: jest.fn().mockReturnValue({}),
    fetchMintConfig: jest.fn().mockResolvedValue({})
}));

const AUTH = "Bearer test-token";
const URL = "/executions/execution-1/files";

describe("GET /executions/:executionId/files", () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/executions", executionsRouter(executionsService));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("answers 200 with the archived files", async () => {
        const files = [
            {
                name: "output.nc",
                path: "/work/01234/user/ls6/archive/output.nc",
                size: 2048,
                url: "tapis://ls6/archive/output.nc"
            }
        ];
        (executionFilesService.listFiles as jest.Mock).mockResolvedValue(files);

        const response = await request(app).get(URL).set("Authorization", AUTH).expect(200);

        expect(response.body).toEqual({ files });
    });

    it("answers 200 with an empty list when the archive holds no file", async () => {
        (executionFilesService.listFiles as jest.Mock).mockResolvedValue([]);

        const response = await request(app).get(URL).set("Authorization", AUTH).expect(200);

        expect(response.body).toEqual({ files: [] });
    });

    it("forwards the execution id and the authorization header to the service", async () => {
        (executionFilesService.listFiles as jest.Mock).mockResolvedValue([]);

        await request(app).get(URL).set("Authorization", AUTH).expect(200);

        expect(executionFilesService.listFiles).toHaveBeenCalledWith("execution-1", AUTH);
    });

    it("answers 404 when the execution does not exist", async () => {
        (executionFilesService.listFiles as jest.Mock).mockRejectedValue(
            new NotFoundError("Execution not found")
        );

        const response = await request(app).get(URL).set("Authorization", AUTH).expect(404);

        expect(response.body.message).toBe("Execution not found");
    });

    it("answers 401 when the authorization header is absent", async () => {
        (executionFilesService.listFiles as jest.Mock).mockRejectedValue(
            new UnauthorizedError("Invalid authorization header")
        );

        await request(app).get(URL).expect(401);
    });

    it("answers 400 when the instance does not run Tapis", async () => {
        (executionFilesService.listFiles as jest.Mock).mockRejectedValue(
            new BadRequestError("Only a Tapis execution archives files")
        );

        await request(app).get(URL).set("Authorization", AUTH).expect(400);
    });

    it("answers 500 when Tapis fails", async () => {
        (executionFilesService.listFiles as jest.Mock).mockRejectedValue(
            new Error("Tapis is down")
        );

        const response = await request(app).get(URL).set("Authorization", AUTH).expect(500);

        expect(response.body).toEqual({ result: "error", message: "Tapis is down" });
    });
});
