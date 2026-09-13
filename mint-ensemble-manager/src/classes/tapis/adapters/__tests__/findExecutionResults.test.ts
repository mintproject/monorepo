import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { NoOutputsDeclaredError, NotFoundError } from "@/classes/common/errors";
import { getModelOutputsByModelId } from "@/classes/graphql/graphql_functions";
import { Execution } from "@/classes/mint/mint-types";

jest.mock("@/classes/mint/mint-functions", () => ({
    getConfiguration: jest.fn().mockReturnValue({})
}));

jest.mock("@/classes/graphql/graphql_functions", () => ({
    getExecution: jest.fn(),
    getModelOutputsByModelId: jest.fn(),
    incrementThreadModelSuccessfulRuns: jest.fn(),
    incrementThreadModelFailedRuns: jest.fn(),
    updateExecutionStatus: jest.fn(),
    updateExecutionStatusAndResultsv2: jest.fn(),
    getThreadModelByThreadIdExecutionId: jest.fn(),
    updateExecutionRunId: jest.fn(),
    decrementThreadModelSubmittedRuns: jest.fn(),
    handleFailedConnectionEnsemble: jest.fn()
}));

const MODEL_ID = "https://w3id.org/okn/i/mint/configuration-1";

const execution = { id: "execution-1", runid: "job-1", modelid: MODEL_ID } as Execution;

const serviceWithFiles = (files: { name: string; url: string }[]) => {
    const service = new TapisExecutionService("test-token", "http://tapis.test");
    // The adapter scans a list of folder names. Answer the first one, and let
    // every other lookup fail the way Tapis fails for a folder that is absent.
    let answered = false;
    service.getJobOutputList = jest.fn().mockImplementation(async () => {
        if (answered) {
            throw new Error("No such folder");
        }
        answered = true;
        return { result: files };
    });
    return service;
};

describe("TapisExecutionService.findExecutionResults", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("throws NO_OUTPUTS_DECLARED when the model configuration declares no output", async () => {
        (getModelOutputsByModelId as jest.Mock).mockResolvedValue([]);
        const service = serviceWithFiles([{ name: "result.nc", url: "tapis://job-1/result.nc" }]);

        const error = await service.findExecutionResults(execution, false).catch((e) => e);

        expect(error).toBeInstanceOf(NoOutputsDeclaredError);
        expect(error.statusCode).toBe(422);
        expect(error.code).toBe("NO_OUTPUTS_DECLARED");
        expect(error.message).toBe(
            "This model configuration declares no outputs. Promote a file from the execution first."
        );
    });

    it("throws NO_OUTPUTS_DECLARED even when the job archived no file", async () => {
        (getModelOutputsByModelId as jest.Mock).mockResolvedValue([]);
        const service = serviceWithFiles([]);

        const error = await service.findExecutionResults(execution, false).catch((e) => e);

        expect(error).toBeInstanceOf(NoOutputsDeclaredError);
        expect(error.code).toBe("NO_OUTPUTS_DECLARED");
    });

    it("still throws NotFoundError when outputs exist and the job archived no file", async () => {
        (getModelOutputsByModelId as jest.Mock).mockResolvedValue([
            { position: 1, model_io: { id: "output-1", name: "result", variables: [] } }
        ]);
        const service = serviceWithFiles([]);

        const error = await service.findExecutionResults(execution, false).catch((e) => e);

        expect(error).toBeInstanceOf(NotFoundError);
        expect(error.statusCode).toBe(404);
        expect(error.code).toBeUndefined();
    });
});
