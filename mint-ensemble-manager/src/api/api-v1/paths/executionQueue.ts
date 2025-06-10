// ./api/api-v1/paths/executionsLocal.ts

import executionQueueService from "../services/executionQueueService";

export default function (executionsLocalService: any) {
    const operations = {
        GET,
        DELETE
    };

    function GET(req: any, res: any, next: any) {
        executionQueueService.getExecutionQueue(req.body).then((result: any) => {
            if (result.result == "error") {
                res.status(406).json(result);
            } else {
                res.status(202).json(result);
            }
        });
    }

    function DELETE(req: any, res: any, next: any) {
        executionQueueService.emptyExecutionQueue().then((result: any) => {
            if (result.result == "error") {
                res.status(406).json(result);
            } else {
                res.status(202).json(result);
            }
        });
    }

    // NOTE: We could also use a YAML string here.
    GET.apiDoc = {
        summary: "Get execution queue information",
        operationId: "getExecutionQueue",
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

    // NOTE: We could also use a YAML string here.
    DELETE.apiDoc = {
        summary: "Empty Local Execution Queue.",
        operationId: "emptyExecutionQueue",
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
