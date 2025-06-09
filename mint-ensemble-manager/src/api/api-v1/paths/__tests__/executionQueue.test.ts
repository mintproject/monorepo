import request from "supertest";
import express from "express";
import executionQueueRouter from "../executionQueue";
import { ExecutionQueueService } from "@/api/api-v1/services/executionQueueService";

// Mock the ExecutionQueueService
jest.mock("@/api/api-v1/services/executionQueueService");

describe("Execution Queue Router", () => {
    let app: express.Application;
    let mockExecutionQueueService: jest.Mocked<ExecutionQueueService>;

    beforeEach(() => {
        // Create a fresh app instance for each test
        app = express();
        app.use(express.json());

        // Create mock service with all required methods
        mockExecutionQueueService = {
            getExecutionQueue: jest.fn(),
            emptyExecutionQueue: jest.fn()
        } as jest.Mocked<ExecutionQueueService>;

        // Mount the router
        app.use("/executionQueue", executionQueueRouter(mockExecutionQueueService));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("GET /executionQueue", () => {
        it("should return 202 with success result when service returns success", async () => {
            // Arrange
            const mockResult = { result: "success", data: { queue: [] } };
            mockExecutionQueueService.getExecutionQueue.mockResolvedValue(mockResult);

            // Act
            const response = await request(app).get("/executionQueue").expect(202);

            // Assert
            expect(response.body).toEqual(mockResult);
            expect(mockExecutionQueueService.getExecutionQueue).toHaveBeenCalledTimes(1);
            expect(mockExecutionQueueService.getExecutionQueue).toHaveBeenCalledWith({});
        });

        it("should return 406 when service returns error result", async () => {
            // Arrange
            const mockErrorResult = { result: "error", message: "Queue not found" };
            mockExecutionQueueService.getExecutionQueue.mockResolvedValue(mockErrorResult);

            // Act
            const response = await request(app).get("/executionQueue").expect(406);

            // Assert
            expect(response.body).toEqual(mockErrorResult);
            expect(mockExecutionQueueService.getExecutionQueue).toHaveBeenCalledTimes(1);
        });

        it("should return 500 when service throws an exception", async () => {
            // Arrange
            const errorMessage = "Database connection failed";
            mockExecutionQueueService.getExecutionQueue.mockRejectedValue(new Error(errorMessage));

            // Act
            const response = await request(app).get("/executionQueue").expect(500);

            // Assert
            expect(response.body).toEqual({
                result: "error",
                message: errorMessage
            });
            expect(mockExecutionQueueService.getExecutionQueue).toHaveBeenCalledTimes(1);
        });

        it("should pass request body to service method", async () => {
            // Arrange
            const requestBody = { filter: "active" };
            const mockResult = { result: "success", data: { queue: [] } };
            mockExecutionQueueService.getExecutionQueue.mockResolvedValue(mockResult);

            // Act
            await request(app).get("/executionQueue").send(requestBody).expect(202);

            // Assert
            expect(mockExecutionQueueService.getExecutionQueue).toHaveBeenCalledWith(requestBody);
        });
    });

    describe("DELETE /executionQueue", () => {
        it("should return 202 with success result when service returns success", async () => {
            // Arrange
            const mockResult = { result: "success", message: "Queue emptied successfully" };
            mockExecutionQueueService.emptyExecutionQueue.mockResolvedValue(mockResult);

            // Act
            const response = await request(app).delete("/executionQueue").expect(202);

            // Assert
            expect(response.body).toEqual(mockResult);
            expect(mockExecutionQueueService.emptyExecutionQueue).toHaveBeenCalledTimes(1);
        });

        it("should return 406 when service returns error result", async () => {
            // Arrange
            const mockErrorResult = { result: "error", message: "Failed to empty queue" };
            mockExecutionQueueService.emptyExecutionQueue.mockResolvedValue(mockErrorResult);

            // Act
            const response = await request(app).delete("/executionQueue").expect(406);

            // Assert
            expect(response.body).toEqual(mockErrorResult);
            expect(mockExecutionQueueService.emptyExecutionQueue).toHaveBeenCalledTimes(1);
        });

        it("should return 500 when service throws an exception", async () => {
            // Arrange
            const errorMessage = "Queue service unavailable";
            mockExecutionQueueService.emptyExecutionQueue.mockRejectedValue(
                new Error(errorMessage)
            );

            // Act
            const response = await request(app).delete("/executionQueue").expect(500);

            // Assert
            expect(response.body).toEqual({
                result: "error",
                message: errorMessage
            });
            expect(mockExecutionQueueService.emptyExecutionQueue).toHaveBeenCalledTimes(1);
        });
    });

    describe("Router Integration", () => {
        it("should handle multiple requests independently", async () => {
            // Arrange
            const successResult = { result: "success", data: { queue: [] } };
            const errorResult = { result: "error", message: "Some error" };

            mockExecutionQueueService.getExecutionQueue
                .mockResolvedValueOnce(successResult)
                .mockResolvedValueOnce(errorResult);

            // Act & Assert
            await request(app).get("/executionQueue").expect(202).expect(successResult);

            await request(app).get("/executionQueue").expect(406).expect(errorResult);

            expect(mockExecutionQueueService.getExecutionQueue).toHaveBeenCalledTimes(2);
        });

        it("should handle invalid routes with 404", async () => {
            // Act & Assert
            await request(app).get("/executionQueue/invalid").expect(404);

            await request(app).post("/executionQueue").expect(404);
        });
    });
});
