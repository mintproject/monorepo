import { Router } from "express";
import problemStatementsService from "@/api/api-v1/services/problemStatementsService";
import { ProblemStatementInfo } from "@/classes/mint/mint-types";
import tasksRouter from "./tasks";

/**
 * Interface for creating a new problem statement request
 * Based on the OpenAPI/Swagger documentation
 */
interface CreateProblemStatementRequest {
    name: string;
    regionid: string;
    dates: {
        start_date: string; // ISO format date-time
        end_date: string; // ISO format date-time
    };
    events?: Array<{
        event: "CREATE" | "UPDATE" | "ADD_TASK" | "DELETE_TASK";
        userid: string;
        timestamp: string; // ISO format date-time
        notes: string;
    }>;
    permissions?: Array<{
        userid: string;
        read: boolean;
        write: boolean;
        execute: boolean;
        owner: boolean;
    }>;
    preview?: string[];
}

const problemStatementsRouter = (): Router => {
    const router = Router();

    // Mount the tasks router
    router.use("/:problemStatementId/tasks", tasksRouter());

    /**
     * @openapi
     * /problemStatements:
     *   get:
     *     summary: Get all problem statements
     *     description: Returns a list of all problem statements
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Problem Statements
     *     responses:
     *       200:
     *         description: A list of problem statements
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/ProblemStatement'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden
     *       500:
     *         description: Internal server error
     */
    router.get("/", async (req, res) => {
        try {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }
            const problemStatements =
                await problemStatementsService.getProblemStatements(authorizationHeader);
            res.status(200).json(problemStatements);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

    /**
     * @openapi
     * /problemStatements:
     *   post:
     *     summary: Create a new problem statement
     *     description: Creates a new problem statement with the provided information
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Problem Statements
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateProblemStatementRequest'
     *     responses:
     *       201:
     *         description: Problem statement created successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 id:
     *                   type: string
     *                   description: The ID of the created problem statement
     *       400:
     *         description: Invalid request body
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden
     *       500:
     *         description: Internal server error
     */
    router.post("/", async (req, res) => {
        try {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }

            const problemStatement = req.body as CreateProblemStatementRequest;

            // Convert the request to ProblemStatementInfo
            const problemStatementInfo: ProblemStatementInfo = {
                name: problemStatement.name,
                regionid: problemStatement.regionid,
                dates: {
                    start_date: new Date(problemStatement.dates.start_date),
                    end_date: new Date(problemStatement.dates.end_date)
                },
                events:
                    problemStatement.events?.map((event) => ({
                        ...event,
                        timestamp: new Date(event.timestamp)
                    })) || [],
                permissions: problemStatement.permissions || [],
                preview: problemStatement.preview
            };

            const id = await problemStatementsService.createProblemStatement(
                problemStatementInfo,
                authorizationHeader
            );
            res.status(201).json({ id });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

    /**
     * @openapi
     * /problemStatements/{id}:
     *   get:
     *     summary: Get a specific problem statement
     *     description: Returns a specific problem statement by ID
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Problem Statements
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *     responses:
     *       200:
     *         description: The problem statement
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ProblemStatement'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden
     *       404:
     *         description: Problem statement not found
     *       500:
     *         description: Internal server error
     */
    router.get("/:id", async (req, res) => {
        try {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }
            const { id } = req.params;
            const problemStatement = await problemStatementsService.getProblemStatementById(
                id,
                authorizationHeader
            );
            res.status(200).json(problemStatement);
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ message: error.message });
            }
            res.status(500).json({ message: error.message });
        }
    });

    return router;
};

export default problemStatementsRouter;
