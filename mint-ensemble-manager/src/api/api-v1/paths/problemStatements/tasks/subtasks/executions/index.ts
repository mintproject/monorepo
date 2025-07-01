import { Router, Request, Response } from "express";
import executionOutputsService from "@/api/api-v1/services/tapis/executionOutputsService";
import { BadRequestError, NotFoundError } from "@/classes/common/errors";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { getSubtask } from "@/classes/graphql/graphql_functions_v2";
import { Thread as GraphQLThread } from "@/classes/graphql/graphql";
import { threadFromGQL } from "@/classes/graphql/graphql_adapter";
import { Thread } from "@/classes/mint/mint-types";

interface ExecutionRequest extends Request {
    params: {
        problemStatementId: string;
        taskId: string;
        subtaskId?: string;
        executionId: string;
    };
    body: {
        datasetId: string;
    };
}
export const executionsRouter = (): Router => {
    const router = Router({ mergeParams: true });
    /**
     * @swagger
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks/{subtaskId}/executions/{executionId}/outputs:
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
     *       - name: problemStatementId
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *       - name: taskId
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *       - name: subtaskId
     *         in: path
     *         required: true
     *         schema:
     *           type: string
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
    router.post("/:executionId/outputs", async (req: ExecutionRequest, res: Response) => {
        const authorizationHeader = req.headers.authorization;
        if (!authorizationHeader) {
            return res.status(401).json({ message: "Authorization header is required" });
        }
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        const { subtaskId, executionId } = req.params;
        try {
            const subtaskRespose: GraphQLThread = await getSubtask(subtaskId, access_token);
            if (!subtaskRespose) {
                return res.status(404).json({ message: "Subtask not found" });
            }
            const subtask: Thread = threadFromGQL(subtaskRespose);

            await executionOutputsService.registerOutputs(
                executionId,
                access_token,
                subtask,
                req.headers.origin
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
};
