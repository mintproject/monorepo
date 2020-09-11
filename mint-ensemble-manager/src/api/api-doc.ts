module.exports = {
    openapi: '3.0.0',
    info: {
      title: 'Ensemble Manager API',
      version: '3.0.0'
    },
    servers: [
      { url: 'http://localhost:3000/v1' },
      { url: 'https://ensemble.mint.isi.edu/v1' }
    ],
    components:{
      schemas: {
        ModelThread: {
          description: '',
          required:[
            'thread_id'
          ],
          type: 'object',
          properties: {
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
    },
    paths: {}
};