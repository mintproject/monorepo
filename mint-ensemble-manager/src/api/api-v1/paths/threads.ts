// ./api/api-v1/paths/threads.ts

export default function (threadsService: any) {
    let operations = {
        POST
    };

    function POST(req: any, res: any, next: any) {
        threadsService.createThread(req.body).then((result: any) => {
            if (result.result == "error") {
                res.status(406).json(result);
            }
            else {
                res.status(202).json(result);
            }
        });
    }

    // NOTE: We could also use a YAML string here.
    POST.apiDoc = {
        summary: 'Create modeling thread in MINT.',
        operationId: 'createThread',
        requestBody: {
            description: 'New modeling thread details',
            required: true,
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/NewModelThread'
                    }
                }
            }
        },
        responses: {
            "202": {
                description: "Successful response"
            },
            default: {
                description: 'An error occurred'
            }
        }
    };

    return operations;
}
