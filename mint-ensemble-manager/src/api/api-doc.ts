const apiDoc = {
    swagger: '2.0',
    basePath: '/v1',
    host: 'ensemble.mint.isi.edu',
    info: {
      title: 'Ensemble Manager API',
      version: '2.0.0'
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
      },
      NewModelThread: {
        description: '',
        required:[
          'scenario', 'subgoal', 'thread'
        ],
        type: 'object',
        properties: {
          scenario: {
            $ref: '#/definitions/Scenario'
          },
          subgoal: {
            $ref: '#/definitions/SubGoal'
          },
          thread: {
            $ref: '#/definitions/Thread'
          }
        }
      },
      TimePeriod: {
        type: 'object',
        description: 'A time period',
        properties: {
          from: {
            description: 'From date YYYY-MM-DD format',
            type: 'string'
          },
          to: {
            description: 'to date YYYY-MM-DD format',
            type: 'string'
          }
        }
      },
      Scenario: {
        type: 'object',
        description: 'A Scenario definition',
        properties: {
          id: {
            description: 'The id of the scenario (leave empty if creating a new scenario)',
            type: 'string'
          },
          name: {
            description: 'The name of the scenario',
            type: 'string'
          },
          regionid: {
            description: 'The general region id of the scenario (example south_sudan, ethiopia)',
            type: 'string'
          },
          time_period: {
            $ref: '#/definitions/TimePeriod'
          }
        }
      },
      SubGoal: {
        type: 'object',
        description: 'A Subgoal definition',
        properties: {
          id: {
            description: 'The id of the task/subgoal (leave empty if creating a new task/subgoal)',
            type: 'string'
          },
          name: {
            description: 'The name of the task/subgoal',
            type: 'string'
          },
          "indicatorid": {
            description: 'The SVO label for the indicator/response (link to list upcoming). Example: grain~dry__mass-per-area_yield',
            type: 'string'
          },
          "interventionid": {
            description: 'The SVO label for the intervention (if any). Example: crop__planting_start_time',
            type: 'string'
          },
          regionid: {
            description: 'The specific sub region id for the task/subgoal (browse https://dev.mint.isi.edu/ethiopia/regions to get the ids)',
            type: 'string'
          },
          time_period: {
            $ref: '#/definitions/TimePeriod'
          }
        }
      },
      Thread: {
        type: 'object',
        description: 'A Thread ensemble definition',
        properties: {
          name: {
            description: 'The name of the thread ensemble(optional)',
            type: 'string'
          },
          modelid: {
            description: 'The model id to use (browse here: https://dev.mint.isi.edu/ethiopia/models/explore. Example: cycles-0.10.2-alpha-collection-oromia)',
            type: 'string'
          },
          datasets: {
            description: 'A map of input name and dataset ids. Example { cycles_weather_soil: ac34f01b-1484-4403-98ea-3a380838cab1 }. To browse the datasets, go here: http://localhost:8080/ethiopia/datasets/browse',
            type: 'object'
          },
          parameters: {
            description: 'A map of parameter name and parameter values. Example: { start_planting_day: [100, 107, 114] }',
            type: 'object'
          }
        }
      }
    },
    paths: {}
};

export default apiDoc;