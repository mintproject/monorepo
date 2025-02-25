// ./api/api-v1/paths/executionsLocal.ts

import { Response } from "express";
import { JobsService } from "../../../services/tapis/jobsService";

export default function (jobsService: JobsService) {
    const exports = {
        POST,
        GET,
        parameters: [
            {
                in: "path",
                name: "id",
                example: "d0cd5bb7-922e-46b1-9f9b-331e2cf1e73b-007"
            }
        ]
    };

    async function GET(req: any, res: Response) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return false;
        }

        const access_token = authHeader.split(" ")[1];
        try {
            const job = await jobsService.get(req.params.id, access_token);
            res.status(200).send({
                message: "Job Status",
                status: job
            });
        } catch (error) {
            console.error(error);
            return res.status(500).send({ message: error.message });
        }
    }

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
            return res.status(500).send({ message: "An error occurred. " + error.message });
        }
    }

    // NOTE: We could also use a YAML string here.
    GET.apiDoc = {
        summary: "Get Job Status",
        description: "Get the status of a job.",
        operationId: "tapisGetJobStatus",
        tags: ["Tapis"],
        security: [
            {
                BearerAuth: [],
                oauth2: []
            }
        ],
        responses: {
            "200": {
                description: "Job Status"
            },
            default: {
                description: "An error occurred"
            }
        }
    };

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
