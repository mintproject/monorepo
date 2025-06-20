// ./api/api-v1/paths/logs.ts

import { Router } from "express";
import logsService from "@/api/api-v1/services/logsService";
import { HttpError } from "@/classes/common/errors";

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
     *         content:
     *           text/plain:
     *             schema:
     *               type: string
     *               example: "Log fetched successfully"
     *       default:
     *         description: Default error response
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
            if (error instanceof HttpError) {
                res.status(error.statusCode).json({ result: "error", message: error.message });
            } else {
                res.status(500).json({ result: "error", message: error.message });
            }
        }
    });

    return router;
}
