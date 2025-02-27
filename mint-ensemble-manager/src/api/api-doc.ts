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
            },
            ReqSubmitTapisJob: {
                required: ["appId", "appVersion", "name"],
                type: "object",
                properties: {
                    name: {
                        type: "string"
                    },
                    owner: {
                        type: "string"
                    },
                    tenant: {
                        type: "string"
                    },
                    description: {
                        type: "string"
                    },
                    appId: {
                        type: "string"
                    },
                    appVersion: {
                        type: "string"
                    },
                    jobType: {
                        type: "string"
                    },
                    archiveOnAppError: {
                        type: "boolean"
                    },
                    dynamicExecSystem: {
                        type: "boolean"
                    },
                    execSystemId: {
                        type: "string"
                    },
                    execSystemExecDir: {
                        type: "string"
                    },
                    execSystemInputDir: {
                        type: "string"
                    },
                    execSystemOutputDir: {
                        type: "string"
                    },
                    execSystemLogicalQueue: {
                        type: "string"
                    },
                    archiveSystemId: {
                        type: "string"
                    },
                    archiveSystemDir: {
                        type: "string"
                    },
                    dtnSystemInputDir: {
                        type: "string"
                    },
                    dtnSystemOutputDir: {
                        type: "string"
                    },
                    nodeCount: {
                        type: "integer",
                        format: "int32"
                    },
                    coresPerNode: {
                        type: "integer",
                        format: "int32"
                    },
                    memoryMB: {
                        type: "integer",
                        format: "int32"
                    },
                    maxMinutes: {
                        type: "integer",
                        format: "int32"
                    },
                    fileInputs: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/TapisJobFileInput"
                        }
                    },
                    fileInputArrays: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/TapisJobFileInputArray"
                        }
                    },
                    parameterSet: {
                        $ref: "#/components/schemas/TapisJobParameterSet"
                    },
                    execSystemConstraints: {
                        type: "array",
                        items: {
                            type: "string"
                        }
                    },
                    tags: {
                        type: "array",
                        items: {
                            type: "string"
                        }
                    },
                    subscriptions: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/ReqSubscribe"
                        }
                    },
                    isMpi: {
                        type: "boolean"
                    },
                    mpiCmd: {
                        type: "string"
                    },
                    cmdPrefix: {
                        type: "string"
                    },
                    notes: {
                        type: "object"
                    }
                }
            },
            TapisJob: {
                type: "object",
                properties: {
                    id: {
                        type: "integer",
                        format: "int32"
                    },
                    name: {
                        type: "string"
                    },
                    owner: {
                        type: "string"
                    },
                    tenant: {
                        type: "string"
                    },
                    description: {
                        type: "string"
                    },
                    status: {
                        type: "string",
                        enum: [
                            "PENDING",
                            "PROCESSING_INPUTS",
                            "STAGING_INPUTS",
                            "STAGING_JOB",
                            "SUBMITTING_JOB",
                            "QUEUED",
                            "RUNNING",
                            "ARCHIVING",
                            "BLOCKED",
                            "PAUSED",
                            "FINISHED",
                            "CANCELLED",
                            "FAILED"
                        ]
                    },
                    condition: {
                        type: "string",
                        enum: [
                            "CANCELLED_BY_USER",
                            "JOB_ARCHIVING_FAILED",
                            "JOB_DATABASE_ERROR",
                            "JOB_EXECUTION_MONITORING_ERROR",
                            "JOB_EXECUTION_MONITORING_TIMEOUT",
                            "JOB_FILES_SERVICE_ERROR",
                            "JOB_INTERNAL_ERROR",
                            "JOB_INVALID_DEFINITION",
                            "JOB_LAUNCH_FAILURE",
                            "JOB_QUEUE_MONITORING_ERROR",
                            "JOB_RECOVERY_FAILURE",
                            "JOB_RECOVERY_TIMEOUT",
                            "JOB_REMOTE_ACCESS_ERROR",
                            "JOB_REMOTE_OUTCOME_ERROR",
                            "JOB_UNABLE_TO_STAGE_INPUTS",
                            "JOB_UNABLE_TO_STAGE_JOB",
                            "JOB_TRANSFER_FAILED_OR_CANCELLED",
                            "JOB_TRANSFER_MONITORING_TIMEOUT",
                            "NORMAL_COMPLETION",
                            "SCHEDULER_CANCELLED",
                            "SCHEDULER_DEADLINE",
                            "SCHEDULER_OUT_OF_MEMORY",
                            "SCHEDULER_STOPPED",
                            "SCHEDULER_TIMEOUT",
                            "SCHEDULER_TERMINATED"
                        ]
                    },
                    lastMessage: {
                        type: "string"
                    },
                    created: {
                        type: "string"
                    },
                    ended: {
                        type: "string"
                    },
                    lastUpdated: {
                        type: "string"
                    },
                    uuid: {
                        type: "string"
                    },
                    appId: {
                        type: "string"
                    },
                    appVersion: {
                        type: "string"
                    },
                    archiveOnAppError: {
                        type: "boolean"
                    },
                    dynamicExecSystem: {
                        type: "boolean"
                    },
                    execSystemId: {
                        type: "string"
                    },
                    execSystemExecDir: {
                        type: "string"
                    },
                    execSystemInputDir: {
                        type: "string"
                    },
                    execSystemOutputDir: {
                        type: "string"
                    },
                    execSystemLogicalQueue: {
                        type: "string"
                    },
                    archiveSystemId: {
                        type: "string"
                    },
                    archiveSystemDir: {
                        type: "string"
                    },
                    dtnSystemId: {
                        type: "string"
                    },
                    dtnSystemInputDir: {
                        type: "string"
                    },
                    dtnSystemOutputDir: {
                        type: "string"
                    },
                    nodeCount: {
                        type: "integer",
                        format: "int32"
                    },
                    coresPerNode: {
                        type: "integer",
                        format: "int32"
                    },
                    memoryMB: {
                        type: "integer",
                        format: "int32"
                    },
                    maxMinutes: {
                        type: "integer",
                        format: "int32"
                    },
                    fileInputs: {
                        type: "string"
                    },
                    parameterSet: {
                        type: "string"
                    },
                    execSystemConstraints: {
                        type: "string"
                    },
                    subscriptions: {
                        type: "string"
                    },
                    blockedCount: {
                        type: "integer",
                        format: "int32"
                    },
                    remoteTapisJobId: {
                        type: "string"
                    },
                    remoteTapisJobId2: {
                        type: "string"
                    },
                    remoteOutcome: {
                        type: "string",
                        enum: ["FINISHED", "FAILED", "FAILED_SKIP_ARCHIVE"]
                    },
                    remoteResultInfo: {
                        type: "string"
                    },
                    remoteQueue: {
                        type: "string"
                    },
                    remoteSubmitted: {
                        type: "string"
                    },
                    remoteStarted: {
                        type: "string"
                    },
                    remoteEnded: {
                        type: "string"
                    },
                    remoteSubmitRetries: {
                        type: "integer",
                        format: "int32"
                    },
                    remoteChecksSuccess: {
                        type: "integer",
                        format: "int32"
                    },
                    remoteChecksFailed: {
                        type: "integer",
                        format: "int32"
                    },
                    remoteLastStatusCheck: {
                        type: "string"
                    },
                    inputTransactionId: {
                        type: "string"
                    },
                    inputCorrelationId: {
                        type: "string"
                    },
                    archiveTransactionId: {
                        type: "string"
                    },
                    archiveCorrelationId: {
                        type: "string"
                    },
                    stageAppTransactionId: {
                        type: "string"
                    },
                    stageAppCorrelationId: {
                        type: "string"
                    },
                    dtnInputTransactionId: {
                        type: "string"
                    },
                    dtnInputCorrelationId: {
                        type: "string"
                    },
                    dtnOutputTransactionId: {
                        type: "string"
                    },
                    dtnOutputCorrelationId: {
                        type: "string"
                    },
                    tapisQueue: {
                        type: "string"
                    },
                    visible: {
                        type: "boolean"
                    },
                    createdby: {
                        type: "string"
                    },
                    createdbyTenant: {
                        type: "string"
                    },
                    tags: {
                        type: "array",
                        items: {
                            type: "string"
                        }
                    },
                    jobType: {
                        type: "string",
                        enum: ["FORK", "BATCH"]
                    },
                    mpiCmd: {
                        type: "string"
                    },
                    cmdPrefix: {
                        type: "string"
                    },
                    sharedAppCtx: {
                        type: "string"
                    },
                    sharedAppCtxAttribs: {
                        type: "array",
                        items: {
                            type: "string",
                            enum: [
                                "SAC_EXEC_SYSTEM_ID",
                                "SAC_EXEC_SYSTEM_EXEC_DIR",
                                "SAC_EXEC_SYSTEM_INPUT_DIR",
                                "SAC_EXEC_SYSTEM_OUTPUT_DIR",
                                "SAC_ARCHIVE_SYSTEM_ID",
                                "SAC_ARCHIVE_SYSTEM_DIR",
                                "SAC_DTN_SYSTEM_ID",
                                "SAC_DTN_SYSTEM_INPUT_DIR",
                                "SAC_DTN_SYSTEM_OUTPUT_DIR"
                            ]
                        }
                    },
                    trackingId: {
                        type: "string"
                    },
                    notes: {
                        type: "string"
                    },
                    mpi: {
                        type: "boolean"
                    }
                }
            },
            TapisJobFileInput: {
                type: "object",
                properties: {
                    name: {
                        type: "string"
                    },
                    description: {
                        type: "string"
                    },
                    envKey: {
                        type: "string"
                    },
                    autoMountLocal: {
                        type: "boolean"
                    },
                    sourceUrl: {
                        type: "string"
                    },
                    targetPath: {
                        type: "string"
                    },
                    notes: {
                        type: "object"
                    }
                }
            },
            TapisJobFileInputArray: {
                type: "object",
                properties: {
                    name: {
                        type: "string"
                    },
                    description: {
                        type: "string"
                    },
                    envKey: {
                        type: "string"
                    },
                    sourceUrls: {
                        type: "array",
                        items: {
                            type: "string"
                        }
                    },
                    targetDir: {
                        type: "string"
                    },
                    notes: {
                        type: "object"
                    }
                }
            },
            TapisJobParameterSet: {
                type: "object",
                properties: {
                    appArgs: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/TapisJobArgSpec"
                        }
                    },
                    containerArgs: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/TapisJobArgSpec"
                        }
                    },
                    schedulerOptions: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/TapisJobArgSpec"
                        }
                    },
                    envVariables: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/KeyValuePair"
                        }
                    },
                    archiveFilter: {
                        $ref: "#/components/schemas/IncludeExcludeFilter"
                    },
                    logConfig: {
                        $ref: "#/components/schemas/TapisLogConfig"
                    }
                }
            },

            TapisJobArgSpec: {
                type: "object",
                properties: {
                    name: {
                        type: "string"
                    },
                    description: {
                        type: "string"
                    },
                    include: {
                        type: "boolean"
                    },
                    arg: {
                        type: "string"
                    },
                    notes: {
                        type: "object"
                    }
                }
            },
            ReqSubscribe: {
                type: "object",
                properties: {
                    description: {
                        type: "string"
                    },
                    enabled: {
                        type: "boolean"
                    },
                    eventCategoryFilter: {
                        type: "string",
                        enum: [
                            "JOB_NEW_STATUS",
                            "JOB_INPUT_TRANSACTION_ID",
                            "JOB_ARCHIVE_TRANSACTION_ID",
                            "JOB_SUBSCRIPTION",
                            "JOB_SHARE_EVENT",
                            "JOB_ERROR_MESSAGE",
                            "JOB_USER_EVENT",
                            "ALL"
                        ]
                    },
                    deliveryTargets: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/TapisNotifDeliveryTarget"
                        }
                    },
                    ttlminutes: {
                        type: "integer",
                        format: "int32"
                    }
                }
            },

            TapisNotifDeliveryTarget: {
                type: "object",
                properties: {
                    deliveryMethod: {
                        type: "string",
                        enum: ["WEBHOOK", "EMAIL", "QUEUE", "ACTOR"]
                    },
                    deliveryAddress: {
                        type: "string"
                    }
                }
            },
            TapisLogConfig: {
                type: "object",
                properties: {
                    stdoutFilename: {
                        type: "string"
                    },
                    stderrFilename: {
                        type: "string"
                    }
                }
            },
            IncludeExcludeFilter: {
                type: "object",
                properties: {
                    includes: {
                        type: "array",
                        items: {
                            type: "string"
                        }
                    },
                    excludes: {
                        type: "array",
                        items: {
                            type: "string"
                        }
                    },
                    includeLaunchFiles: {
                        type: "boolean"
                    }
                }
            },
            KeyValuePair: {
                type: "object",
                properties: {
                    key: {
                        type: "string"
                    },
                    value: {
                        type: "string"
                    },
                    description: {
                        type: "string"
                    },
                    include: {
                        type: "boolean"
                    },
                    notes: {
                        type: "object"
                    }
                }
            }
        }
    },
    paths: {}
};
