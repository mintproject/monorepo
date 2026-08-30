import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { Status } from "@/interfaces/IExecutionService";

// Mock the getConfiguration function
jest.mock("@/classes/mint/mint-functions", () => ({
    getConfiguration: jest.fn().mockReturnValue({
        auth: {
            client_id: "test-client-id",
            server: "http://test-server",
            realm: "test-realm"
        },
        graphql: {
            endpoint: "http://test-graphql",
            secret: "test-secret",
            enable_ssl: false
        }
    })
}));

describe("TapisExecutionService", () => {
    describe("mapStatus", () => {
        it("should map waiting statuses correctly", () => {
            const waitingStatuses = [
                "jobs.JOB_NEW_STATUS.PENDING",
                "jobs.JOB_NEW_STATUS.PROCESSING_INPUTS",
                "jobs.JOB_NEW_STATUS.STAGING_INPUTS",
                "jobs.JOB_NEW_STATUS.STAGING_JOB",
                "jobs.JOB_NEW_STATUS.SUBMITTING_JOB",
                "jobs.JOB_NEW_STATUS.QUEUED"
            ];

            waitingStatuses.forEach((status) => {
                expect(TapisExecutionService.mapStatus(status)).toBe(Status.WAITING);
            });
        });

        it("should map running statuses correctly", () => {
            const runningStatuses = [
                "jobs.JOB_NEW_STATUS.RUNNING",
                "jobs.JOB_NEW_STATUS.ARCHIVING"
            ];

            runningStatuses.forEach((status) => {
                expect(TapisExecutionService.mapStatus(status)).toBe(Status.RUNNING);
            });
        });

        it("should map success statuses correctly", () => {
            const successStatuses = [
                "jobs.JOB_NEW_STATUS.FINISHED",
                "jobs.JOB_NEW_STATUS.ARCHIVED",
                "jobs.JOB_NEW_STATUS.SUCCESS"
            ];

            successStatuses.forEach((status) => {
                expect(TapisExecutionService.mapStatus(status)).toBe(Status.SUCCESS);
            });
        });

        it("should map failure statuses correctly", () => {
            const failureStatuses = [
                "jobs.JOB_NEW_STATUS.FAILED",
                "jobs.JOB_NEW_STATUS.CANCELLED",
                "jobs.JOB_NEW_STATUS.PAUSED"
            ];

            failureStatuses.forEach((status) => {
                expect(TapisExecutionService.mapStatus(status)).toBe(Status.FAILURE);
            });
        });

        it("should throw error for unrecognized status", () => {
            expect(() => {
                TapisExecutionService.mapStatus("UNKNOWN_STATUS");
            }).toThrow("Unrecognized Tapis status: UNKNOWN_STATUS");
        });
    });
});
