// ./api/api-v1/paths/executions.ts

export default function (executionsService: any) {
    const operations = {
        POST
    };

    function POST(req: any, res: any, next: any) {
        executionsService.submitExecution(req.body).then((result: any) => {
            if (result.result == "error") {
                res.status(406).json(result);
            } else {
                res.status(202).json(result);
            }
        });
    }

    // NOTE: We could also use a YAML string here.
    POST.apiDoc = {
        summary: "Submit modeling thread for execution.",
        operationId: "submitExecution",
        requestBody: {
            description: "Modeling thread scenario/subgoal/id",
            required: true,
            content: {
                "application/json": {
                    schema: {
                        $ref: "#/components/schemas/ModelThread"
                    }
                }
            }
        },
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
