import { Router, Request, Response } from "express";
import problemStatementsService from "@/api/api-v1/services/problemStatementsService";
import tasksService from "@/api/api-v1/services/tasksService";
import {
    ProblemStatementInfo,
    ProblemStatement,
    Task,
    ThreadInfo
} from "@/classes/mint/mint-types";
import tasksRouter from "./tasks";
import { HttpError } from "@/classes/common/errors";

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

interface ErrorResponse {
    message: string;
}

/**
 * Interface for creating a task and subtask request
 */
interface CreateTaskAndSubtaskRequest {
    task: {
        name: string;
        response_variables: string[];
        driving_variables: string[];
        regionid?: string;
        dates?: {
            start_date: string; // ISO format date-time
            end_date: string; // ISO format date-time
        };
    };
    subtask: {
        name: string;
        driving_variables: string[];
        response_variables: string[];
        dates?: {
            start_date: string; // ISO format date-time
            end_date: string; // ISO format date-time
        };
    };
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
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.get("/", async (req: Request, res: Response<ProblemStatement[] | ErrorResponse>) => {
        try {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }
            const problemStatements =
                await problemStatementsService.getProblemStatements(authorizationHeader);
            res.status(200).json(problemStatements);
        } catch (error) {
            if (error instanceof HttpError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
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
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.post(
        "/",
        async (
            req: Request<{ id: string }, unknown, CreateProblemStatementRequest>,
            res: Response<{ id: string } | ErrorResponse>
        ) => {
            try {
                const authorizationHeader = req.headers.authorization;
                if (!authorizationHeader) {
                    return res.status(401).json({ message: "Authorization header is required" });
                }

                const problemStatement = req.body;

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
                if (error instanceof HttpError) {
                    return res.status(error.statusCode).json({ message: error.message });
                }
                res.status(500).json({ message: error.message });
            }
        }
    );

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
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
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
            if (error instanceof HttpError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            if (error.message.includes("not found")) {
                return res.status(404).json({ message: error.message });
            }
            res.status(500).json({ message: error.message });
        }
    });

    /**
     * @openapi
     * /problemStatements/{id}/taskAndSubtask:
     *   post:
     *     summary: Create a task and subtask together
     *     description: Creates both a task and its associated subtask in a single operation
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
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateTaskAndSubtaskRequest'
     *     responses:
     *       200:
     *         description: Task and subtask created successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 taskId:
     *                   type: string
     *                   description: The ID of the created task
     *                 subtaskId:
     *                   type: string
     *                   description: The ID of the created subtask
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.post(
        "/:id/taskAndSubtask",
        async (
            req: Request<{ id: string }, unknown, CreateTaskAndSubtaskRequest>,
            res: Response<{ taskId: string; subtaskId: string } | ErrorResponse>
        ) => {
            try {
                const authorizationHeader = req.headers.authorization;
                if (!authorizationHeader) {
                    return res.status(401).json({ message: "Authorization header is required" });
                }

                const { id: problemStatementId } = req.params;
                const { task: taskData, subtask: subtaskData } = req.body;

                // Validate that problem statement exists
                const problemStatement = await problemStatementsService.getProblemStatementById(
                    problemStatementId,
                    authorizationHeader
                );

                if (!problemStatement) {
                    return res.status(404).json({ message: "Problem statement not found" });
                }

                // Create Task object
                const task: Task = {
                    id: "", // Will be generated
                    name: taskData.name,
                    problem_statement_id: problemStatementId,
                    response_variables: taskData.response_variables,
                    driving_variables: taskData.driving_variables,
                    regionid: taskData.regionid,
                    dates: taskData.dates
                        ? {
                              start_date: new Date(taskData.dates.start_date),
                              end_date: new Date(taskData.dates.end_date)
                          }
                        : undefined,
                    events: [],
                    permissions: []
                };

                // Create ThreadInfo object
                const subtask: ThreadInfo = {
                    id: "", // Will be generated
                    name: subtaskData.name,
                    task_id: "", // Will be set by the service
                    driving_variables: subtaskData.driving_variables,
                    response_variables: subtaskData.response_variables,
                    dates: subtaskData.dates
                        ? {
                              start_date: new Date(subtaskData.dates.start_date),
                              end_date: new Date(subtaskData.dates.end_date)
                          }
                        : undefined,
                    events: [],
                    permissions: []
                };

                // Create task and subtask together
                const [taskId, subtaskId] = await tasksService.createTaskWithThread(
                    problemStatementId,
                    task,
                    subtask,
                    authorizationHeader
                );

                res.status(200).json({ taskId: taskId, subtaskId: subtaskId });
            } catch (error) {
                if (error instanceof HttpError) {
                    return res.status(error.statusCode).json({ message: error.message });
                }
                res.status(500).json({ message: error.message });
            }
        }
    );

    return router;
};

export default problemStatementsRouter;
