// ./api/api-v1/paths/executionsLocal.ts

import { Router } from "express";
import { ExecutionQueueService } from "@/api/api-v1/services/executionQueueService";

export default function (executionQueueService: ExecutionQueueService) {
    const router = Router();

    /**
     * @swagger
     * /executionQueue:
     *   get:
     *     summary: Get the current execution queue
     *     description: Retrieves the current state of the execution queue
     *     tags: [Execution Queue]
     *     responses:
     *       202:
     *         description: Successfully retrieved execution queue
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 result:
     *                   type: string
     *                   example: success
     *       406:
     *         description: Error retrieving execution queue
     *       500:
     *         description: Server error
     */
    router.get("/", async (req, res) => {
        try {
            const result = await executionQueueService.getExecutionQueue(req.body);
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
     * /executionQueue:
     *   delete:
     *     summary: Empty the execution queue
     *     description: Removes all items from the execution queue
     *     tags: [Execution Queue]
     *     responses:
     *       202:
     *         description: Successfully emptied execution queue
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 result:
     *                   type: string
     *                   example: success
     *       406:
     *         description: Error emptying execution queue
     *       500:
     *         description: Server error
     */
    router.delete("/", async (req, res) => {
        try {
            const result = await executionQueueService.emptyExecutionQueue();
            if (result.result === "error") {
                res.status(406).json(result);
            } else {
                res.status(202).json(result);
            }
        } catch (error) {
            res.status(500).json({ result: "error", message: error.message });
        }
    });

    return router;
}
