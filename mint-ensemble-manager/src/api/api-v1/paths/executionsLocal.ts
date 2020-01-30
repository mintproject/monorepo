// ./api/api-v1/paths/executionsLocal.ts
                                                                                                                                                                                                                                      
export default function(executionsLocalService: any) {
    let operations = {
      POST,
      DELETE
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

    function DELETE(req: any, res: any, next: any) {
      executionsLocalService.deleteExecutionCache(req.query.scenario_id, req.query.subgoal_id, req.query.thread_id).then((result: any) => {
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
  
    // NOTE: We could also use a YAML string here.
    DELETE.apiDoc = {
      summary: 'Delete cached results, cached models and cached data for local execution.',
      operationId: 'deleteLocalExecutionCache',
      parameters: [
        {
          in: 'query',
          name: 'scenario_id',
          type: 'string'
        },
        {
          in: 'query',
          name: 'subgoal_id',
          type: 'string'
        },
        {
          in: 'query',
          name: 'thread_id',
          type: 'string'
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