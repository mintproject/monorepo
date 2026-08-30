import threadsExecutionsService from "@/api/api-v1/services/tapis/threads/executions/threadsExecutionsService";
import { Router, Request, Response } from "express";
import { Status } from "@/interfaces/IExecutionService";
import jobsService from "@/api/api-v1/services/tapis/jobsService";

export default function () {
    const router = Router();

    /**
     * @swagger
     * /tapis/threads/{threadId}/executions/{executionId}/status:
     *   put:
     *     summary: Update Execution Status
     *     description: Update the status of an execution.
     *     operationId: updateExecutionStatus
     *     tags:
     *       - Tapis
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     parameters:
     *       - name: threadId
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *         description: Thread ID
     *       - name: executionId
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *         description: Execution ID
     *     requestBody:
     *       description: Status Update
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ReqUpdateExecutionStatus'
     *     responses:
     *       200:
     *         description: Status Updated Successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *       default:
     *         description: An error occurred
     */
    router.put(
        "/:threadId/executions/:executionId/status",
        async (
            req: Request<{ threadId: string; executionId: string }, unknown, { status: Status }>,
            res: Response
        ) => {
            try {
                const { threadId, executionId } = req.params;
                const { status } = req.body;

                await threadsExecutionsService.updateStatus(threadId, executionId, status);
                return res.status(200).send({ message: "Execution status updated" });
            } catch (error) {
                console.error(error);
                return res.status(500).send({ message: error.message });
            }
        }
    );

    /**
     * @swagger
     * /tapis/threads/{threadId}/executions/{executionId}/webhook:
     *   post:
     *     summary: Webhook for Job Status Change
     *     description: Webhook for Job Status Change. TAPIS will send a POST request to this endpoint when a job status changes.
     *     operationId: tapisChangeJobStatus
     *     tags: [Tapis]
     *     parameters:
     *       - name: threadId
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *         description: Thread ID
     *       - name: executionId
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *         description: Execution ID
     *     requestBody:
     *       description: Job Status
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/WebHookEvent'
     *     responses:
     *       200:
     *         description: Log Details
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                 newStatus:
     *                   type: string
     *                   example: "RUNNING"
     *                 id:
     *                   type: string
     *                   example: "9bc5bbfb-d76c-4d0b-87cc-f89e945a062e-007"
     *       default:
     *         description: An error occurred
     */
    router.post("/:threadId/executions/:executionId/webhook", async (req, res) => {
        try {
            console.log("Received webhook event", JSON.stringify(req.body));
            const execution = await jobsService.webhookJobStatusChange(
                req.body,
                req.params.executionId,
                req.params.threadId
            );
            if (execution == undefined) {
                return res.status(404).send({ message: "Execution not found." });
            }
            res.status(200).send({
                message: "Job Status Change",
                newStatus: execution.status,
                id: execution.id
            });
        } catch (error) {
            console.error(error);
            return res.status(500).send({ message: "An error occurred. " + error.message });
        }
    });
    return router;
}
