// ./api/api-v1/paths/executions.ts

import { Router } from "express";
import executionsService from "@/api/api-v1/services/executionsService";
import logsService from "../services/logsService";
import { HttpError } from "@/classes/common/errors";

export default function (service: typeof executionsService) {
    const router = Router();

    /**
     * @swagger
     * /executions:
     *   post:
     *     summary: Submit modeling thread for execution.
     *     operationId: submitExecution
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     requestBody:
     *       description: Modeling thread scenario/subgoal/id
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ModelThread'
     *     responses:
     *       202:
     *         description: Successful response
     *       default:
     *         description: An error occurred
     */
    router.post("/", async (req, res) => {
        try {
            const result = await service.submitExecution(req.body);
            if (result.result === "error") {
                res.status(406).json(result);
            } else {
                res.status(202).json(result);
            }
        } catch (error) {
            res.status(500).json({ result: "error", message: error.message });
        }
    });

    /**
     * @swagger
     * /executions/{executionId}/logs:
     *   get:
     *     summary: Get Execution Logs
     *     description: Get the logs of an execution.
     *     tags: [Executions]
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     parameters:
     *       - in: path
     *         name: executionId
     *         required: true
     *         schema:
     *           type: string
     *         example: "9bc5bbfb-d76c-4d0b-87cc-f89e945a062e-007"
     *     responses:
     *       200:
     *         description: Execution Logs
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 result:
     *                   type: string
     *                   example: "success"
     *                 message:
     *                   type: string
     *                   description: "The log content or success message"
     *                   example: "Execution logs fetched successfully"
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 result:
     *                   type: string
     *                   example: "error"
     *                 message:
     *                   type: string
     *                   example: "Unauthorized access"
     *       404:
     *         description: Execution not found
     *         content:
     *           text/plain:
     *             schema:
     *               type: string
     *               example: "Running..."
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 result:
     *                   type: string
     *                   example: "error"
     *                 message:
     *                   type: string
     *                   example: "Execution not found"
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 result:
     *                   type: string
     *                   example: "error"
     *                 message:
     *                   type: string
     *                   example: "Internal server error"
     */
    router.get("/:executionId/logs", async (req, res) => {
        try {
            const log = await logsService.fetchLog(
                req.params.executionId,
                req.headers.authorization
            );
            res.status(200).send(log);
        } catch (error) {
            if (error instanceof HttpError) {
                res.status(error.statusCode).json({ result: "error", message: error.message });
            } else {
                res.status(500).json({ result: "error", message: error.message });
            }
        }
    });

    return router;
}
