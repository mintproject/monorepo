// ./api/api-v1/paths/executionsLocal.ts

import { Response } from "express";
import { JobsService } from "../../../services/tapis/jobsService";

export default function (jobsService: JobsService) {
    const exports = {
        POST,
        parameters: [
            {
                in: "path",
                name: "id",
                example: "bae0f0be-6dbe-e791-f184-1c20f9903afc"
            }
        ]
    };

    async function POST(req: any, res: Response) {
        try {
            const execution = await jobsService.webhookJobStatusChange(req.body, req.params.id);
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
            return res.status(500).send({ message: "An error occurred. " + error });
        }
    }

    // NOTE: We could also use a YAML string here.
    POST.apiDoc = {
        summary: "Webhook for Job Status Change.",
        description:
            "Webhook for Job Status Change. TAPIS will send a POST request to this endpoint when a job status changes.",
        operationId: "tapisChangeJobStatus",
        tags: ["Tapis"],
        security: [
            {
                BearerAuth: [],
                oauth2: []
            }
        ],
        requestBody: {
            description: "Job Status",
            required: true,
            content: {
                "application/json": {
                    schema: {
                        $ref: "#/components/schemas/WebHookEvent"
                    }
                }
            }
        },
        responses: {
            "200": {
                description: "Log Details"
            },
            default: {
                description: "An error occurred"
            }
        }
    };

    return exports;
}
