// ./api/api-v1/paths/executionsLocal.ts

import { ExecutionsTapisService } from "@/api/api-v1/services/executionsTapisService";
import { Response } from "express";
export default function (executionsTapisService: ExecutionsTapisService) {
    const operations = {
        POST
    };

    async function POST(req: any, res: Response) {
        const threadmodel = req.body;
        try {
            const response = await executionsTapisService.submitExecution(
                threadmodel,
                req.headers.authorization
            );
            if (response) {
                res.status(202).json(response);
            } else {
                res.status(404).json({ error: "Thread not found" });
            }
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: error.message });
        }
    }

    // NOTE: We could also use a YAML string here.
    POST.apiDoc = {
        summary: "Submit modeling thread for execution using Tapis.",
        operationId: "submitTapisExecution",
        tags: ["Execution Engine"],
        requestBody: {
            description: "Modeling thread",
            required: true,
            content: {
                "application/json": {
                    schema: {
                        $ref: "#/components/schemas/ModelThread"
                    },
                    example: {
                        thread_id: "108bguHTBBNLlZaPMLlM",
                        model_id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg"
                    }
                }
            }
        },
        security: [
            {
                BearerAuth: [],
                oauth2: []
            }
        ],
        responses: {
            "202": {
                description: "Successful response"
            },
            default: {
                description: "An error occurred"
            }
        }
    };

    return operations;
}
