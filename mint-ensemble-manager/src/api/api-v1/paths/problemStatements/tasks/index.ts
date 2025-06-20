import { Router, Request, Response } from "express";
import tasksService from "@/api/api-v1/services/tasksService";
import subtasksRouter from "./subtasks";

interface TaskRequest extends Request {
    params: {
        problemStatementId: string;
    };
}

const tasksRouter = (): Router => {
    const router = Router({ mergeParams: true });

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks:
     *   get:
     *     summary: Get all tasks for a problem statement
     *     description: Returns a list of all tasks associated with a specific problem statement
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Tasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *     responses:
     *       200:
     *         description: A list of tasks
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Task'
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
    router.get("/", async (req: TaskRequest, res: Response) => {
        try {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }

            const { problemStatementId } = req.params;
            const tasks = await tasksService.getTasksByProblemStatementId(
                problemStatementId,
                authorizationHeader
            );
            return res.status(200).json(tasks);
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ message: error.message });
            }
            res.status(500).json({ message: error.message });
        }
    });

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks:
     *   post:
     *     summary: Create a new task
     *     description: Creates a new task for a specific problem statement
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Tasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateTaskRequest'
     *     responses:
     *       200:
     *         description: Task created successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               $ref: '#/components/schemas/Task'
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
    router.post("/", async (req: TaskRequest, res) => {
        try {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }
            const { problemStatementId } = req.params;

            const task_id = await tasksService.createTask(
                problemStatementId,
                req.body,
                authorizationHeader
            );

            res.status(200).json({ id: task_id });
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ message: error.message });
            }
            res.status(500).json({ message: error.message });
        }
    });

    // Mount subtasks router
    router.use("/:taskId/subtasks", subtasksRouter());

    return router;
};

export default tasksRouter;
