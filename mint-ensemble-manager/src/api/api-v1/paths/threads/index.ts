// ./api/api-v1/paths/threads.ts

import { Router } from "express";
import { ThreadsService } from "@/api/api-v1/services/threadsService";
import { RunHistoryService } from "@/api/api-v1/services/runHistoryService";
import { HttpError } from "@/classes/common/errors";

export default function (threadsService: ThreadsService, runHistoryService?: RunHistoryService) {
    const router = Router();

    /**
     * @openapi
     * /threads/{id}/runs:
     *   get:
     *     summary: List the authorized run history for a modeling subtask.
     *     operationId: listThreadRunHistory
     *     tags: [Threads]
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *       - in: query
     *         name: model_id
     *         required: false
     *         schema: { type: string }
     *       - in: query
     *         name: limit
     *         required: false
     *         schema: { type: integer, minimum: 1, maximum: 100 }
     *       - in: query
     *         name: cursor
     *         required: false
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Normalized legacy and workflow run summaries.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               additionalProperties: true
     *       401:
     *         description: Authorization required.
     *         content:
     *           application/json:
     *             schema: { type: object, additionalProperties: true }
     *       404:
     *         description: Subtask not found or not accessible.
     *         content:
     *           application/json:
     *             schema: { type: object, additionalProperties: true }
     */
    router.get("/:id/runs", async (req, res) => {
        try {
            if (!runHistoryService) return res.status(404).send();
            const result = await runHistoryService.list(req.params.id, req.headers.authorization, {
                modelId: typeof req.query.model_id === "string" ? req.query.model_id : undefined,
                limit: req.query.limit,
                cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined
            });
            res.setHeader("Cache-Control", "private, no-store");
            return res.status(200).json(result);
        } catch (error) {
            if (error instanceof HttpError) {
                return res
                    .status(error.statusCode)
                    .json({ message: error.message, code: error.code });
            }
            return res
                .status(500)
                .json({ message: error instanceof Error ? error.message : String(error) });
        }
    });

    /**
     * @openapi
     * /threads/{id}/runs/{runKey}:
     *   get:
     *     summary: Get one authorized run provenance packet.
     *     operationId: getThreadRunHistoryDetail
     *     tags: [Threads]
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *       - in: path
     *         name: runKey
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Normalized run provenance packet.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               additionalProperties: true
     *       401:
     *         description: Authorization required.
     *         content:
     *           application/json:
     *             schema: { type: object, additionalProperties: true }
     *       404:
     *         description: Run not found or not accessible.
     *         content:
     *           application/json:
     *             schema: { type: object, additionalProperties: true }
     */
    router.get("/:id/runs/:runKey", async (req, res) => {
        try {
            if (!runHistoryService) return res.status(404).send();
            const result = await runHistoryService.detail(
                req.params.id,
                req.params.runKey,
                req.headers.authorization
            );
            res.setHeader("Cache-Control", "private, no-store");
            return res.status(200).json(result);
        } catch (error) {
            if (error instanceof HttpError) {
                return res
                    .status(error.statusCode)
                    .json({ message: error.message, code: error.code });
            }
            return res
                .status(500)
                .json({ message: error instanceof Error ? error.message : String(error) });
        }
    });

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
