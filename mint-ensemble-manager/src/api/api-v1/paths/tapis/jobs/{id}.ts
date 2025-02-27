// ./api/api-v1/paths/executionsLocal.ts

import { Response } from "express";
import { JobsService } from "../../../services/tapis/jobsService";

export default function (jobsService: JobsService) {
    const exports = {
        GET,
        POST,
        parameters: [
            {
                in: "path",
                name: "id",
                example: "9bc5bbfb-d76c-4d0b-87cc-f89e945a062e-007"
            }
        ]
    };

    async function GET(req: any, res: Response) {
        try {
            const job = await jobsService.get(req.params.id, req.headers.authorization);
            res.status(200).send({
                message: "Job Status",
                status: job
            });
        } catch (error) {
            console.error(error);
            return res.status(500).send({ message: error.message });
        }
    }

    /* submit a job to the queue */
    async function POST(req: any, res: Response) {
        try {
            const job = await jobsService.submit(req.body, req.headers.authorization);
        } catch (error) {
            console.error(error);
            return res.status(500).send({ message: error.message });
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
        summary: "Submit Job",
        description: "Submit a job to the queue.",
        operationId: "tapisSubmitJob",
        tags: ["Tapis"],
        security: [
            {
                BearerAuth: [],
                oauth2: []
            }
        ],
        requestBody: {
            description: "Job",
            required: true,
            content: {
                "application/json": {
                    schema: {
                        $ref: "#/components/schemas/ReqSubmitTapisJob"
                    }
                }
            }
        },
        responses: {
            "200": {
                description: "Job Submitted"
            },
            default: {
                description: "An error occurred"
            }
        }
    };

    return exports;
}
