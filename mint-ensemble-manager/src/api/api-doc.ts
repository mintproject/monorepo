const AUTHORIZATION_URL = process.env.AUTHORIZATION_URL;

module.exports = {
    openapi: "3.0.0",
    info: {
        title: "Ensemble Manager API",
        version: "3.0.0"
    },
    servers: [{ url: "http://localhost:3000/v1" }, { url: "https://ensemble.mint.isi.edu/v1" }],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT"
            },
            oauth2: {
                type: "oauth2",
                flows: {
                    implicit: {
                        authorizationUrl: AUTHORIZATION_URL
                    }
                }
            }
        },
        schemas: {
            WebHookEvent: {
                type: "object",
                example: {
                    uuid: "c664d438-218d-418b-bfe1-7a0b08918f84",
                    tenant: "portals",
                    subscriptionName:
                        "jobs~mosorio~portals~60cfd7b6-746e-416c-bb8c-3cd8c761ab60-007~TSZn",
                    eventUuid: "8b57afe8-16ba-4eee-989c-bb71a8759cf7",
                    event: {
                        source: "https://tapis.io/jobs",
                        type: "jobs.JOB_NEW_STATUS.STAGING_INPUTS",
                        data: {
                            newJobStatus: "STAGING_INPUTS",
                            oldJobStatus: "PROCESSING_INPUTS",
                            jobName: "bae0f0be6dbee791f1841c20f9903afc",
                            jobUuid: "60cfd7b6-746e-416c-bb8c-3cd8c761ab60-007",
                            jobOwner: "mosorio",
                            message:
                                "The job has transitioned to a new status: STAGING_INPUTS. The previous job status was PROCESSING_INPUTS."
                        },
                        seriesId: "60cfd7b6-746e-416c-bb8c-3cd8c761ab60-007",
                        seriesSeqCount: 4,
                        timestamp: "2024-06-12T14:03:21.595939893Z",
                        deleteSubscriptionsMatchingSubject: false,
                        endSeries: false,
                        tenant: "portals",
                        user: "jobs",
                        received: "2024-06-12T14:03:21.615954424Z",
                        uuid: "8b57afe8-16ba-4eee-989c-bb71a8759cf7"
                    },
                    deliveryTarget: {
                        deliveryMethod: "WEBHOOK",
                        deliveryAddress: "https://webhook.site/dbb05bdc-8f00-4315-8b5b-d16b723cb95d"
                    },
                    created: "2024-06-12T14:03:21.635255381Z"
                },
                additionalProperties: true
            },
            ModelThread: {
                description: "",
                required: ["thread_id"],
                type: "object",
                properties: {
                    thread_id: {
                        description: "The Modeling thread id",
                        type: "string"
                    },
                    model_id: {
                        description: "The Model id (optional. Set to null to run all)",
                        type: "string"
                    }
                }
            },
            NewModelThread: {
                description: "",
                required: ["problem_statement", "task", "thread"],
                type: "object",
                properties: {
                    problem_statement: {
                        $ref: "#/components/schemas/ProblemStatement"
                    },
                    task: {
                        $ref: "#/components/schemas/Task"
                    },
                    thread: {
                        $ref: "#/components/schemas/Thread"
                    }
                }
            },
            TimePeriod: {
                type: "object",
                description: "A time period",
                properties: {
                    from: {
                        description: "From date YYYY-MM-DD format",
                        type: "string"
                    },
                    to: {
                        description: "to date YYYY-MM-DD format",
                        type: "string"
                    }
                }
            },
            ProblemStatement: {
                type: "object",
                description: "A Problem Statement definition",
                properties: {
                    id: {
                        description:
                            "The id of the problem statement (leave empty if creating a new problem statement)",
                        type: "string"
                    },
                    name: {
                        description: "The name of the problem statement",
                        type: "string"
                    },
                    regionid: {
                        description:
                            "The top level region id of the problem statement (example south_sudan, ethiopia)",
                        type: "string"
                    },
                    time_period: {
                        $ref: "#/components/schemas/TimePeriod"
                    }
                }
            },
            Task: {
                type: "object",
                description: "A Task definition",
                properties: {
                    id: {
                        description: "The id of the task (leave empty if creating a new task)",
                        type: "string"
                    },
                    name: {
                        description: "The name of the task",
                        type: "string"
                    },
                    indicatorid: {
                        description:
                            "The SVO label for the indicator/response (link to list upcoming). Example: grain~dry__mass-per-area_yield",
                        type: "string"
                    },
                    interventionid: {
                        description:
                            "The SVO label for the intervention (if any). Example: crop__planting_start_time",
                        type: "string"
                    },
                    regionid: {
                        description:
                            "The specific region id for the task (browse https://dev.mint.isi.edu/ethiopia/regions to get the ids)",
                        type: "string"
                    },
                    time_period: {
                        $ref: "#/components/schemas/TimePeriod"
                    }
                }
            },
            Thread: {
                type: "object",
                description: "A Thread definition",
                properties: {
                    name: {
                        description: "The name of the thread (optional)",
                        type: "string"
                    },
                    modelid: {
                        description:
                            "The model id to use (browse here: https://dev.mint.isi.edu/ethiopia/models/explore. Example: cycles-0.10.2-alpha-collection-oromia)",
                        type: "string"
                    },
                    datasets: {
                        description:
                            "A map of input name and dataset ids. Example { cycles_weather_soil: ac34f01b-1484-4403-98ea-3a380838cab1 }. To browse the datasets, go here: http://localhost:8080/ethiopia/datasets/browse",
                        type: "object"
                    },
                    parameters: {
                        description:
                            "A map of parameter name and parameter values. Example: { start_planting_day: [100, 107, 114] }",
                        type: "object"
                    }
                }
            }
        }
    },
    paths: {}
};
