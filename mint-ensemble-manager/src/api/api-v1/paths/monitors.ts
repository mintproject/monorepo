// ./api/api-v1/paths/monitors.ts

import { Router } from "express";
import monitorsService from "@/api/api-v1/services/monitorsService";

export default function (service: typeof monitorsService) {
    const router = Router();

    /**
     * @swagger
     * /monitors:
     *   post:
     *     summary: Submit modeling thread for monitoring
     *     operationId: submitMonitor
     *     tags: [Monitors]
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
     *       201:
     *         description: Successful response
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
     *                   example: "Monitoring thread submitted successfully"
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
    router.post("/", async (req, res) => {
        try {
            const result = await service.submitMonitor(req.body);
            if (result.result === "error") {
                res.status(406).json(result);
            } else {
                res.status(201).json(result);
            }
        } catch (error) {
            res.status(500).json({ result: "error", message: error.message });
        }
    });

    /**
     * @swagger
     * /monitors:
     *   get:
     *     summary: Fetch execution status of modeling thread
     *     operationId: fetchRunStatus
     *     tags: [Monitors]
     *     parameters:
     *       - in: query
     *         name: scenario_id
     *         required: true
     *         schema:
     *           type: string
     *         description: The ID of the scenario
     *       - in: query
     *         name: thread_id
     *         required: true
     *         schema:
     *           type: string
     *         description: The ID of the thread to check status for
     *     responses:
     *       200:
     *         description: Thread Details
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
     *                   example: "Thread details fetched successfully"
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
            const { scenario_id, thread_id } = req.query;
            if (!scenario_id || !thread_id) {
                return res.status(400).json({
                    result: "error",
                    message: "scenario_id and thread_id are required"
                });
            }
            const result = await service.fetchRunStatus(thread_id as string);
            if (result.result === "error") {
                res.status(406).json(result);
            } else {
                res.status(200).json(result);
            }
        } catch (error) {
            res.status(500).json({ result: "error", message: error.message });
        }
    });

    return router;
}
