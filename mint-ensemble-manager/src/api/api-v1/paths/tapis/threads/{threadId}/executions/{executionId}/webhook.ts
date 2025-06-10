// ./api/api-v1/paths/executionsLocal.ts

import { Response } from "express";
import { JobsService } from "@/api/api-v1/services/tapis/jobsService";
export default function (jobsService: JobsService) {
    const exports = {
        POST
    };

    async function POST(req: any, res: Response) {
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
    }

    POST.apiDoc = {
        summary: "Webhook for Job Status Change.",
        description:
            "Webhook for Job Status Change. TAPIS will send a POST request to this endpoint when a job status changes.",
        operationId: "tapisChangeJobStatus",
        tags: ["Tapis"],
        parameters: [
            {
                name: "threadId",
                in: "path",
                required: true,
                schema: {
                    type: "string"
                },
                description: "Thread ID"
            },
            {
                name: "executionId",
                in: "path",
                required: true,
                schema: { type: "string" },
                description: "Execution ID"
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
