// ./api/api-v1/paths/executionsLocal.ts
                                                                                                                                                                                                                                      
export default function(executionsLocalService: any) {
    let operations = {
      POST
    };
   
    function POST(req: any, res: any, next: any) {
        executionsLocalService.submitExecution(req.body).then((result: any) => {
          if(result.result == "error") {
            res.status(406).json(result);
          }
          else {
            res.status(202).json(result);
          }
        });
    }
   
    // NOTE: We could also use a YAML string here.
    POST.apiDoc = {
      summary: 'Submit modeling thread for local execution.',
      operationId: 'submitLocalExecution',
      parameters: [
        {
            in: 'body',
            name: 'thread',
            required: true,
            schema: {
                $ref: '#/definitions/ModelThread'
            }
        }
      ],
      responses: {
          "202": {
              description: "Successful response"
          },
          default: {
            description: 'An error occurred',
            schema: {
              additionalProperties: true
            }
          }
      }
    };
   
    return operations;
  }