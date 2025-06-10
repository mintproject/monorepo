// ./api/api-v1/paths/executions.ts

import { Router } from "express";
import executionsService from "@/api/api-v1/services/executionsService";

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

    return router;
}
