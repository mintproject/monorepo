// ./api/api-v1/paths/monitors.ts
                                                                                                                                                                                                                                      
export default function(monitorsService: any) {
    let operations = {
      POST
    };
   
    function POST(req: any, res: any, next: any) {
        monitorsService.submitMonitor(req.body).then((result: any) => {
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
      summary: 'Submit modeling thread for monitoring.',
      operationId: 'submitMonitor',
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
          "201": {
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