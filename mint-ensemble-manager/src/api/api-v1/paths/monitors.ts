// ./api/api-v1/paths/monitors.ts
                                                                                                                                                                                                                                      
export default function(monitorsService: any) {
    let operations = {
      POST,
      GET
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

    function GET(req: any, res: any, next: any) {
      monitorsService.fetchRunStatus(req.query.scenario_id, req.query.thread_id).then((result: any) => {
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
          "201": {
              description: "Successful response"
          },
          default: {
            description: 'An error occurred'
          }
      }
    };

    GET.apiDoc = {
      summary: 'Fetch execution status of modeling thread',
      operationId: 'fetchRunStatus',
      parameters: [
        {
          in: 'query',
          name: 'scenario_id',
          required: true,
          schema: {
            type: 'string'
          }
        },
        {
            in: 'query',
            name: 'thread_id',
            required: true,
            schema: {
              type: 'string'
            }
        }
      ],
      responses: {
          "200": {
              description: "Thread Details"
          },
          default: {
            description: 'An error occurred'
          }
      }
    };
   
    return operations;
  }