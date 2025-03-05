import { Response } from "express";
import { ExecutionOutputsService } from "@/api/api-v1/services/tapis/executionOutputsService";

export default function (executionOutputsService: ExecutionOutputsService) {
    const exports = {
        POST,
        parameters: [
            {
                in: "path",
                name: "executionId",
                required: true,
                schema: {
                    type: "string"
                }
            }
        ]
    };

    async function POST(req: any, res: Response) {
        try {
            const success = await executionOutputsService.registerOutputs(
                req.params.executionId,
                req.headers.authorization
            );

            if (success) {
                res.status(200).json({
                    message: "Execution outputs registered successfully"
                });
            } else {
                res.status(400).json({
                    message: "Failed to register execution outputs"
                });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({
                message: error.message
            });
        }
    }

    POST.apiDoc = {
        summary: "Register Tapis Execution Outputs",
        description: "Register the outputs of a successful Tapis execution in the data catalog",
        operationId: "registerTapisExecutionOutputs",
        tags: ["Tapis"],
        security: [
            {
                BearerAuth: [],
                oauth2: []
            }
        ],
        responses: {
            "200": {
                description: "Outputs registered successfully"
            },
            "400": {
                description: "Invalid request or registration failed"
            },
            "500": {
                description: "Server error"
            }
        }
    };

    return exports;
}
