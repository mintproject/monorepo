// ./api/api-v1/paths/modelCache.ts

import { Router } from "express";
import modelCacheService from "@/api/api-v1/services/modelCacheService";

export default function (service: typeof modelCacheService) {
    const router = Router();

    /**
     * @swagger
     * /modelCache:
     *   delete:
     *     summary: Delete cached models from graphQL. WARNING - This will also result in deletion of all executions for that model, even from other threads !
     *     operationId: deleteModel
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     parameters:
     *       - in: query
     *         name: model_id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       202:
     *         description: Successful response
     *       default:
     *         description: An error occurred
     */
    router.delete("/", async (req, res) => {
        try {
            const modelId = req.query.model_id as string;
            if (!modelId) {
                return res.status(400).json({ result: "error", message: "model_id is required" });
            }
            const result = await service.deleteModel(modelId);
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
