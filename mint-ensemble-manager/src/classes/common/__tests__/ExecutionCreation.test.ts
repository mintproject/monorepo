import { ExecutionCreation } from "@/classes/common/ExecutionCreation";
import { getRegionDetails, listSuccessfulExecutionIds } from "@/classes/graphql/graphql_functions";
import { getThreadMock } from "@/classes/common/__tests__/mocks/getThreadMock";
import { getRegionMockTexas } from "@/classes/common/__tests__/mocks/getRegionMockTexas";
import { threadFromGQL } from "@/classes/graphql/graphql_adapter";
import { Region } from "@/classes/mint/mint-types";
import { MockExecutionService } from "./mocks/MockExecutionService";
// Mock all the imported functions
jest.mock("@/classes/graphql/graphql_functions");

describe("ExecutionCreation", () => {
    let executionCreation: ExecutionCreation;

    beforeEach(() => {
        // Setup mock thread data
        const mockExecutionService = new MockExecutionService(["mock-job-1", "mock-job-2"]);
        // Setup mock responses
        (getRegionDetails as jest.Mock).mockResolvedValue(getRegionMockTexas as unknown as Region);
        (listSuccessfulExecutionIds as jest.Mock).mockResolvedValue([]);

        const thread = threadFromGQL(getThreadMock.data.thread_by_pk);
        executionCreation = new ExecutionCreation(
            thread,
            "https://w3id.org/okn/i/mint/d2792424-fb9d-461c-9470-4bc87ca2f05f",
            mockExecutionService
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("prepareExecutions", () => {
        it("should prepare executions successfully", async () => {
            // Mock fetch for component loading
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                text: () =>
                    Promise.resolve(
                        JSON.stringify({
                            id: "comp-1",
                            version: "1.0"
                        })
                    )
            });

            const executionDetails = ExecutionCreation.getModelInputBindings(
                executionCreation.thread.models[
                    "https://w3id.org/okn/i/mint/d2792424-fb9d-461c-9470-4bc87ca2f05f"
                ],
                executionCreation.thread,
                executionCreation.threadRegion
            );
            const [threadModel, inputIds] = executionDetails;
            expect(threadModel).toBeDefined();
            expect(inputIds).toBeDefined();
        });
    });
});
