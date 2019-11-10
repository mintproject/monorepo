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
            description: '',
            type: 'string'
          },
          subgoal_id: {
            description: '',
            type: 'string'
          },
          thread_id: {
            description: '',
            type: 'string'
          },
        }
      }
    },
    paths: {}
};

export default apiDoc;