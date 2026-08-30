// ./api/api-v1/paths/threads.ts

import { Router } from "express";
import { ThreadsService } from "@/api/api-v1/services/threadsService";

export default function (threadsService: ThreadsService) {
    const router = Router();

    /**
     * @swagger
     * /threads/{id}:
     *   get:
     *     summary: Get modeling thread in MINT.
     *     operationId: getThread
     *     tags: [Threads]
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     *       default:
     *         description: An error occurred
     */
    router.get("/:id", async (req, res) => {
        try {
            const response = await threadsService.getThread(req.params.id);
            if (response === undefined) res.status(404).send();
            else res.status(200).send(response);
        } catch (error) {
            res.status(500).send(error);
        }
    });

    /**
     * @swagger
     * /threads:
     *   post:
     *     summary: Create modeling thread in MINT
     *     operationId: createThread
     *     tags: [Threads]
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     requestBody:
     *       description: New modeling thread details
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/NewModelThread'
     *     responses:
     *       202:
     *         description: Successful response
     *       default:
     *         description: An error occurred
     */
    router.post("/", async (req, res) => {
        try {
            const result = await threadsService.createThread(req.body);
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
