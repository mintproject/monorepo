import { Router } from "express";
import executionOutputsService from "@/api/api-v1/services/tapis/executionOutputsService";
import { BadRequestError, NotFoundError } from "@/classes/common/errors";

export default function () {
    const router = Router();
    /**
     * @swagger
     * /tapis/executions/{executionId}/outputs:
     *   post:
     *     summary: Register Tapis Execution Outputs
     *     description: Register the outputs of a successful Tapis execution in the data catalog
     *     operationId: registerTapisExecutionOutputs
     *     tags:
     *       - Tapis
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     parameters:
     *       - name: executionId
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Outputs registered successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *       400:
     *         description: Invalid request or registration failed
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.post("/:executionId/outputs", async (req, res) => {
        try {
            await executionOutputsService.registerOutputs(
                req.params.executionId,
                req.headers.authorization
            );
            res.status(200).json({ message: "Outputs registered successfully" });
        } catch (error) {
            if (error instanceof NotFoundError) {
                res.status(404).json({
                    message: error.message
                });
            } else if (error instanceof BadRequestError) {
                res.status(400).json({
                    message: "Execution is not successful"
                });
            } else {
                res.status(500).json({
                    message: error.message
                });
            }
        }
    });

    return router;
}
