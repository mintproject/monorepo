// ./api/api-v1/paths/threads.ts

export default function (threadsService: any) {
    const operations = {
        GET
    };

    //threads/:id
    async function GET(req: any, res: any, next: any) {
        try {
            const response = await threadsService.getThread(req.params.id);
            if (response === undefined) res.status(404).send();
            else res.status(200).send(response);
        } catch (error) {
            res.status(500).send(error);
        }
    }

    GET.apiDoc = {
        summary: "Get modeling thread in MINT.",
        operationId: "getThread",
        security: [
            {
                BearerAuth: [],
                oauth2: []
            }
        ],
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: {
                    type: "string"
                }
            }
        ],
        responses: {
            "200": {
                description: "Successful response"
            },
            default: {
                description: "An error occurred"
            }
        }
    };

    return operations;
}
