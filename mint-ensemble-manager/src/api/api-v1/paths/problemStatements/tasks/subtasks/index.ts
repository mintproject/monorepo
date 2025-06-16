import { Router, Request, Response } from "express";
import subTasksService from "@/api/api-v1/services/subTasksService";

interface SubtaskRequest extends Request {
    params: {
        problemStatementId: string;
        taskId: string;
        subtaskId?: string;
    };
}

const subtasksRouter = (): Router => {
    const router = Router({ mergeParams: true });

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks:
     *   get:
     *     summary: Get all subtasks for a task
     *     description: Returns a list of all subtasks associated with a specific task
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *     responses:
     *       200:
     *         description: A list of subtasks
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 subtasks:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/Subtask'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden
     *       404:
     *         description: Task not found
     *       500:
     *         description: Internal server error
     */
    router.get("/", async (req: SubtaskRequest, res: Response) => {
        try {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }

            const { problemStatementId, taskId } = req.params;
            const subtasks = await subTasksService.getSubtasksByTaskId(
                problemStatementId,
                taskId,
                authorizationHeader
            );
            res.status(200).json(subtasks);
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ message: error.message });
            }
            res.status(500).json({ message: error.message });
        }
    });

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks/{subtaskId}:
     *   get:
     *     summary: Get a specific subtask
     *     description: Returns details of a specific subtask
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *       - in: path
     *         name: subtaskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The subtask ID
     *     responses:
     *       200:
     *         description: Subtask details
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Subtask'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden
     *       404:
     *         description: Subtask not found
     *       500:
     *         description: Internal server error
     */
    router.get("/:subtaskId", async (req: SubtaskRequest, res: Response) => {
        try {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }

            const { problemStatementId, taskId, subtaskId } = req.params;
            const subtask = await subTasksService.getSubtaskById(
                problemStatementId,
                taskId,
                subtaskId,
                authorizationHeader
            );
            res.status(200).json(subtask);
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ message: error.message });
            }
            res.status(500).json({ message: error.message });
        }
    });

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks:
     *   post:
     *     summary: Create a new subtask
     *     description: Creates a new subtask for a specific task
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateSubtaskRequest'
     *     responses:
     *       200:
     *         description: Subtask created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Subtask'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden
     *       404:
     *         description: Task not found
     *       500:
     *         description: Internal server error
     */
    router.post("/", async (req: SubtaskRequest, res: Response) => {
        try {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }

            const { problemStatementId, taskId } = req.params;
            const subtask = await subTasksService.createSubtask(
                problemStatementId,
                taskId,
                req.body,
                authorizationHeader
            );
            res.status(200).json(subtask);
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ message: error.message });
            }
            res.status(500).json({ message: error.message });
        }
    });

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks/{subtaskId}/models:
     *   post:
     *     summary: Add models to a subtask
     *     description: Adds models to a subtask
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *       - in: path
     *         name: subtaskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The subtask ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/AddModelsRequest'
     *     responses:
     *       200:
     *         description: Models added successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Thread'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden
     *       404:
     *         description: Subtask not found
     *       500:
     *         description: Internal server error
     */
    router.post(
        "/:subtaskId/models",
        async (
            req: Request<
                { problemStatementId: string; taskId: string; subtaskId: string },
                unknown,
                { modelIds: string[] }
            >,
            res: Response
        ) => {
            try {
                const authorizationHeader = req.headers.authorization;
                if (!authorizationHeader) {
                    return res.status(401).json({ message: "Authorization header is required" });
                }
                const { subtaskId } = req.params;
                const { modelIds } = req.body;
                const subtask = await subTasksService.addModels(
                    subtaskId,
                    modelIds,
                    authorizationHeader
                );
                res.status(200).json(subtask);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    );
    return router;
};

export default subtasksRouter;
