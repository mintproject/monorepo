// ./api/api-v1/paths/registration.ts
                                                                                                                                                                                                                                      
export default function(registrationService: any) {
    let operations = {
      POST
    };
   
    function POST(req: any, res: any, next: any) {
        registrationService.registerExecutionOutputs(req.body).then((result: any) => {
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
      summary: 'Register outputs of modeling thread in data catalog.',
      operationId: 'registerExecutionOutputs',
      requestBody: {
        description: 'Modeling thread scenario/subgoal/id',
        required: true,
        content: {
          'application/json': {
            schema: {
                $ref: '#/components/schemas/ModelThread'
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