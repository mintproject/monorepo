// ./api/api-v1/paths/executionsLocal.ts

import { JobsService } from "@/api/api-v1/services/tapis/jobsService";
import { Response } from "express";

export default function (jobsService: JobsService) {
    const exports = {
        GET,
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

    return exports;
}
