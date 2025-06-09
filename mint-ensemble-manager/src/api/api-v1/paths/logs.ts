// ./api/api-v1/paths/logs.ts

import { Router } from "express";
import logsService from "@/api/api-v1/services/logsService";

export default function (service: typeof logsService) {
    const router = Router();

    /**
     * @swagger
     * /logs:
     *   get:
     *     summary: Fetch logs for an execution.
     *     operationId: fetchLog
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     parameters:
     *       - in: query
     *         name: ensemble_id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Log Details
     *       default:
     *         description: An error occurred
     */
    router.get("/", async (req, res) => {
        try {
            const ensembleId = req.query.ensemble_id as string;
            if (!ensembleId) {
                return res
                    .status(400)
                    .json({ result: "error", message: "ensemble_id is required" });
            }
            const result = await service.fetchLog(ensembleId, req.headers.authorization);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ result: "error", message: error.message });
        }
    });

    return router;
}
