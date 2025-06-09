import { Router } from "express";
import modelEnsemblesOutputsService from "@/api/api-v1/services/tapis/modelEnsembles/outputs/modelEnsemblesOutputsService";

export default function () {
    const router = Router();

    /**
     * @swagger
     * /tapis/modelEnsembles/{id}/outputs:
     *   post:
     *     summary: Register Model Ensemble Execution Outputs
     *     description: Register all execution outputs for a model ensemble in the data catalog asynchronously
     *     operationId: registerModelEnsembleExecutionOutputs
     *     tags:
     *       - Tapis
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
     *       202:
     *         description: Registration process started
     *       500:
     *         description: Server error
     */
    router.post("/:id/outputs", async (req, res) => {
        try {
            // Start the registration process asynchronously
            modelEnsemblesOutputsService.registerOutputs(req.params.id, req.headers.authorization);

            // Return immediate acknowledgment
            res.status(202).json({
                message: "Model ensemble outputs registration process started"
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                message: error.message
            });
        }
    });

    return router;
}
