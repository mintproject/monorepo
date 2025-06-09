import request from "supertest";
import express from "express";
import jobsRouter from "../../tapis/jobs";
import jobsService from "@/api/api-v1/services/tapis/jobsService";

// Mock the jobsService
jest.mock("@/api/api-v1/services/tapis/jobsService");

// Mock getConfiguration
jest.mock("@/classes/mint/mint-functions", () => ({
    getConfiguration: jest.fn().mockReturnValue({
        tapis: {
            baseUrl: "https://test.tapis.io",
            tenant: "test-tenant"
        }
    })
}));

describe("Tapis Jobs Router", () => {
    let app: express.Application;

    beforeEach(() => {
        // Create a fresh app instance for each test
        app = express();
        app.use(express.json());

        // Mount the router
        app.use("/tapis/jobs", jobsRouter());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("POST /tapis/jobs", () => {
        it("should return 200 with success message when job is submitted successfully", async () => {
            // Arrange
            const mockJob = { id: "test-job-id", status: "PENDING" };
            const mockAuth = "Bearer test-token";
            const mockJobData = { name: "test-job" };

            (jobsService.submitJob as jest.Mock).mockResolvedValue(mockJob);

            // Act
            const response = await request(app)
                .post("/tapis/jobs")
                .set("Authorization", mockAuth)
                .send(mockJobData)
                .expect(200);

            // Assert
            expect(response.body).toEqual({
                message: "Job submitted",
                job: mockJob
            });
            expect(jobsService.submitJob).toHaveBeenCalledTimes(1);
            expect(jobsService.submitJob).toHaveBeenCalledWith(mockJobData, mockAuth);
        });

        it("should return 500 when service throws an exception", async () => {
            // Arrange
            const errorMessage = "Failed to submit job";
            (jobsService.submitJob as jest.Mock).mockRejectedValue(new Error(errorMessage));

            // Act
            const response = await request(app).post("/tapis/jobs").send({}).expect(500);

            // Assert
            expect(response.body).toEqual({
                message: errorMessage
            });
            expect(jobsService.submitJob).toHaveBeenCalledTimes(1);
        });
    });

    describe("GET /tapis/jobs/:id", () => {
        it("should return 200 with job status when job is found", async () => {
            // Arrange
            const mockJobStatus = { status: "RUNNING", progress: 50 };
            const mockAuth = "Bearer test-token";
            const jobId = "test-job-id";

            (jobsService.get as jest.Mock).mockResolvedValue(mockJobStatus);

            // Act
            const response = await request(app)
                .get(`/tapis/jobs/${jobId}`)
                .set("Authorization", mockAuth)
                .expect(200);

            // Assert
            expect(response.body).toEqual({
                message: "Job Status",
                status: mockJobStatus
            });
            expect(jobsService.get).toHaveBeenCalledTimes(1);
            expect(jobsService.get).toHaveBeenCalledWith(jobId, mockAuth);
        });

        it("should return 500 when service throws an exception", async () => {
            // Arrange
            const errorMessage = "Failed to get job status";

            (jobsService.get as jest.Mock).mockRejectedValue(new Error(errorMessage));

            // Act
            const response = await request(app).get("/tapis/jobs/test-job-id").expect(500);

            // Assert
            expect(response.body).toEqual({
                message: errorMessage
            });
            expect(jobsService.get).toHaveBeenCalledTimes(1);
        });
    });

    describe("Router Integration", () => {
        it("should handle invalid routes with 404", async () => {
            // Act & Assert
            await request(app).get("/tapis/jobs").expect(404);
            await request(app).put("/tapis/jobs/test-id").expect(404);
        });
    });
});
