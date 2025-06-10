// ./api/api-v1/paths/registration.ts

import { Router } from "express";
import registrationService from "@/api/api-v1/services/registrationService";

export default function (service: typeof registrationService) {
    const router = Router();

    /**
     * @swagger
     * /registration:
     *   post:
     *     summary: Register outputs of modeling thread in data catalog
     *     operationId: registerExecutionOutputs
     *     tags: [Registration]
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
            const result = await service.registerExecutionOutputs(req.body);
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
