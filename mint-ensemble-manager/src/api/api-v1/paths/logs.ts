// ./api/api-v1/paths/logs.ts
                                                                                                                                                                                                                                      
export default function(logsService: any) {
    let operations = {
      GET
    };
   
    function GET(req: any, res: any, next: any) {
        logsService.fetchLog(req.query.ensemble_id).then((result: string) => {
            res.status(200).json(result);
        });
    }
   
    // NOTE: We could also use a YAML string here.
    GET.apiDoc = {
      summary: 'Fetch logs for an execution.',
      operationId: 'fetchLog',
      parameters: [
        {
            in: 'query',
            name: 'ensemble_id',
            required: true,
            schema: {
              type: 'string'
            }
        }
      ],
      responses: {
          "200": {
              description: "Log Details"
          },
          default: {
            description: 'An error occurred'
          }
      }
    };
   
    return operations;
}