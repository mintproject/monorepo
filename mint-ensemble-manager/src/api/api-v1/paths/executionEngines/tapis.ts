// ./api/api-v1/paths/executionsLocal.ts

import { Router } from "express";
import executionsTapisService from "@/api/api-v1/services/executionsTapisService";
import { HttpError } from "@/classes/common/errors";

export default function () {
    const router = Router();

    /**
     * @swagger
     * /executionEngines/tapis:
     *   post:
     *     summary: Submit modeling thread for execution using Tapis.
     *     operationId: submitTapisExecution
     *     tags:
     *       - Execution Engine
     *     requestBody:
     *       description: Modeling thread
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ModelThread'
     *           example:
     *             thread_id: "108bguHTBBNLlZaPMLlM"
     *             model_id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg"
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     responses:
     *       202:
     *         description: Successful response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                   example: "Execution submitted successfully"
     *                 job_ids:
     *                   type: array
     *                   items:
     *                     type: string
     *                     example: "1234567890"
     *                 total_executions:
     *                   type: number
     *                   description: "Total number of executions attempted"
     *                   example: 5
     *                 successful_submissions:
     *                   type: number
     *                   description: "Number of executions successfully submitted"
     *                   example: 4
     *                 failed_submissions:
     *                   type: number
     *                   description: "Number of executions that failed to submit"
     *                   example: 1
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
    router.post("/tapis", async (req, res) => {
        try {
            const response = await executionsTapisService.submitExecution(
                req.body,
                req.headers.authorization
            );
            
            // Determine the appropriate message based on submission results
            let message = "Execution submitted successfully";
            if (response.failedSubmissions > 0 && response.successfulSubmissions > 0) {
                message = `Partial success: ${response.successfulSubmissions} of ${response.totalExecutions} executions submitted successfully`;
            } else if (response.failedSubmissions > 0) {
                message = `All ${response.totalExecutions} executions failed to submit`;
            }
            
            res.status(202).json({
                message,
                job_ids: response.jobIds,
                total_executions: response.totalExecutions,
                successful_submissions: response.successfulSubmissions,
                failed_submissions: response.failedSubmissions
            });
        } catch (error) {
            if (error instanceof HttpError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    });

    return router;
}
