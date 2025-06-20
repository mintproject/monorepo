import { Request, Router } from "express";
import { Response } from "express";
import subTasksService from "../services/subTasksService";

export const modelBindingsRouter = (): Router => {
    const router = Router();

    /**
     * @openapi
     * /modelBindings/data:
     *   get:
     *     summary: Get model bindings
     *     description: Returns the model bindings
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Model Bindings
     *     parameters:
     *       - in: query
     *         name: model_id
     *         required: true
     *         schema:
     *           type: string
     *         description: The model id to use format http://api.models.mint.local/v1.8.0/modelconfigurations/modflow_2005_BartonSprings_avg?username=mint@isi.edu
     *         example: http://api.models.mint.local/v1.8.0/modelconfigurations/modflow_2005_BartonSprings_avg?username=mint@isi.edu
     *     responses:
     *       200:
     *         description: Model bindings
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/DatasetSpecification'
     *       default:
     *         description: Default error response
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
     *                   example: "Model bindings fetched successfully"
     */
    router.get(
        "/data",
        async (req: Request<unknown, unknown, unknown, { model_id: string }>, res: Response) => {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }
            const { model_id } = req.query;
            if (!model_id) {
                return res.status(400).json({ message: "model_id is required" });
            }
            try {
                const dataBindings = await subTasksService.getModelDataBindings(
                    model_id,
                    authorizationHeader
                );
                res.status(200).json(dataBindings);
            } catch (error) {
                res.status(500).json({ message: "Internal server error" });
            }
        }
    );

    /**
     * @openapi
     * /modelBindings/parameters:
     *   get:
     *     summary: Get model parameters
     *     description: Returns the model parameters
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Model Bindings
     *     parameters:
     *       - in: query
     *         name: model_id
     *         required: true
     *         schema:
     *           type: string
     *         description: The model id to use format http://api.models.mint.local/v1.8.0/modelconfigurations/modflow_2005_BartonSprings_avg?username=mint@isi.edu
     *         example: http://api.models.mint.local/v1.8.0/modelconfigurations/modflow_2005_BartonSprings_avg?username=mint@isi.edu
     *     responses:
     *       200:
     *         description: Model parameters
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Parameter'
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
    router.get(
        "/parameters",
        async (req: Request<unknown, unknown, unknown, { model_id: string }>, res: Response) => {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }
            const { model_id } = req.query;
            if (!model_id) {
                return res.status(400).json({ message: "model_id is required" });
            }
            try {
                const parameters = await subTasksService.getModelParameters(
                    model_id,
                    authorizationHeader
                );
                res.status(200).json(parameters);
            } catch (error) {
                res.status(500).json({ message: "Internal server error" });
            }
        }
    );
    return router;
};
