const apiDoc = {
    swagger: '2.0',
    basePath: '/v1',
    info: {
      title: 'A getting started API.',
      version: '1.0.0'
    },
    definitions: {
      ModelThread: {
        description: '',
        required:[
          'scenario_id', 'subgoal_id', 'thread_id'
        ],
        type: 'object',
        properties: {
          scenario_id: {
            description: 'The Problem Statement (Scenario) id',
            type: 'string'
          },
          subgoal_id: {
            description: 'The Task (Subgoal) id',
            type: 'string'
          },
          thread_id: {
            description: 'The Modeling thread id',
            type: 'string'
          },
          model_id: {
            description: 'The Model id (optional. Set to null to run all)',
            type: 'string'
          }
        }
      }
    },
    paths: {}
};

export default apiDoc;