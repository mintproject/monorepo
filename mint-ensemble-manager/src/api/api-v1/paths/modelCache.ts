// ./api/api-v1/paths/modelCache.ts

export default function(modelCacheService: any) {
    let operations = {
      DELETE
    };
   
    function DELETE(req: any, res: any, next: any) {
        modelCacheService.deleteModel(req.query.model_id).then((result: any) => {
        if(result.result == "error") {
          res.status(406).json(result);
        }
        else {
          res.status(202).json(result);
        }
      });
    }
   
    // NOTE: We could also use a YAML string here.
    DELETE.apiDoc = {
        summary: 'Delete cached models from graphQL. WARNING: This will also result in deletion of all executions for that model, even from other threads !',
        operationId: 'deleteModel',
        parameters: [
            {
                in: 'query',
                name: 'model_id',
                required: true,
                schema: {
                  type: 'string'
                }
            }
        ],
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