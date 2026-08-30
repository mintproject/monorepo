// ./api/api-v1/paths/tapis/jobs/index.ts

import { Router } from "express";
import jobsService from "@/api/api-v1/services/tapis/jobsService";
import { HttpError } from "@/classes/common/errors";

export default function () {
    const router = Router();

    /**
     * @swagger
     * /tapis/jobs:
     *   post:
     *     summary: Submit Job
     *     description: Submit a job to the queue.
     *     operationId: tapisSubmitJob
     *     tags: [Tapis]
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     requestBody:
     *       description: Job
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ReqSubmitTapisJob'
     *     responses:
     *       200:
     *         description: Job Submitted
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 job_id:
     *                   type: string
     *                   example: "9bc5bbfb-d76c-4d0b-87cc-f89e945a062e-007"
     *                 message:
     *                   type: string
     *       default:
     *         description: An error occurred
     */
    /* submit a job to the queue */
    router.post("/", async (req, res) => {
        try {
            const job = await jobsService.submitJob(req.body, req.headers.authorization);
            return res.status(200).send({ message: "Job submitted", job_id: job });
        } catch (error) {
            return res.status(500).send({ message: error.message });
        }
    });

    /**
     * @swagger
     * /tapis/jobs/{id}:
     *   get:
     *     summary: Get Job Status
     *     description: Get the status of a job.
     *     operationId: tapisGetJobStatus
     *     tags: [Tapis]
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         example: "9bc5bbfb-d76c-4d0b-87cc-f89e945a062e-007"
     *     responses:
     *       200:
     *         description: Job Status
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                 status:
     *                   type: string
     *                   example: "RUNNING"
     *       default:
     *         description: An error occurred
     */
    router.get("/:id", async (req, res) => {
        try {
            const job = await jobsService.get(req.params.id, req.headers.authorization);
            res.status(200).send({
                message: "Job Status",
                status: job.status
            });
        } catch (error) {
            return res.status(500).send({ message: error.message });
        }
    });

    /**
     * @swagger
     * /tapis/jobs/{id}/logs:
     *   get:
     *     summary: Get Job Logs
     *     description: Get the logs of a job.
     *     operationId: tapisGetJobLogs
     *     tags: [Tapis]
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         example: "9bc5bbfb-d76c-4d0b-87cc-f89e945a062e-007"
     *     responses:
     *       200:
     *         description: Job Logs
     *         content:
     *           text/plain:
     *             schema:
     *               type: string
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *       default:
     *         description: An error occurred
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.get("/:id/logs", async (req, res) => {
        try {
            const log = await jobsService.getLogs(req.params.id, req.headers.authorization);
            res.status(200).send(log);
        } catch (error) {
            if (error instanceof HttpError) {
                return res.status(error.statusCode).send({ message: error.message });
            } else {
                return res.status(500).send({ message: error.message });
            }
        }
    });

    return router;
}
