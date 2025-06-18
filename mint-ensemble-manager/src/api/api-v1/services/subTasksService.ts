import { Thread, ThreadInfo } from "@/classes/mint/mint-types";
import {
    addThread,
    insertModel,
    getModel,
    getTask,
    getThread,
    setThreadModels
} from "@/classes/graphql/graphql_functions";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import {
    UnauthorizedError,
    InternalServerError,
    NotFoundError,
    BadRequestError
} from "@/classes/common/errors";
import problemStatementsService from "./problemStatementsService";
import {
    convertApiUrlToW3Id,
    fetchModelConfiguration,
    fetchModelConfigurationSetup
} from "@/classes/mint/model-catalog-functions";
import {
    modelConfigurationSetupToGraphQL,
    modelConfigurationToGraphQL
} from "@/classes/mint/model-catalog-graphql-adapter";
import { Model_Insert_Input } from "@/classes/graphql/graph_typing";
import { AddDataRequest } from "../paths/problemStatements/tasks/subtasks";
import useModelsService from "./useModelsService";
import { IExecutionService } from "@/interfaces/IExecutionService";
import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { getConfiguration } from "@/classes/mint/mint-functions";
import { MockExecutionService } from "@/classes/common/__tests__/mocks/MockExecutionService";
import { ExecutionCreation } from "@/classes/common/ExecutionCreation";

function getExecutionEngineService(
    executionEngine: string,
    authorizationHeader: string
): IExecutionService {
    const config = getConfiguration();
    const token = getTokenFromAuthorizationHeader(authorizationHeader);
    if (!token) {
        throw new UnauthorizedError("Invalid authorization header");
    }

    switch (executionEngine.toLowerCase()) {
        case "tapis":
            return new TapisExecutionService(token, config.tapis.basePath);
        case "localex":
            // For local execution, we can use a mock service for now
            // TODO: Implement proper local execution service
            return new MockExecutionService();
        case "wings":
            // TODO: Implement Wings execution service
            throw new Error("Wings execution engine not implemented yet");
        default:
            throw new Error(`Unsupported execution engine: ${executionEngine}`);
    }
}

export interface SubTasksService {
    submitSubtask(
        subtaskId: string,
        model_id: string,
        authorizationHeader: string
    ): Promise<string[]>;
    getSubtasksByTaskId(
        problemStatementId: string,
        taskId: string,
        authorizationHeader: string
    ): Promise<ThreadInfo[]>;
    getSubtaskById(
        problemStatementId: string,
        taskId: string,
        subtaskId: string,
        authorizationHeader: string
    ): Promise<ThreadInfo>;
    createSubtask(
        problemStatementId: string,
        taskId: string,
        subtask: ThreadInfo,
        authorizationHeader: string
    ): Promise<string>;
    addModels(subtaskId: string, modelIds: string[], authorizationHeader: string): Promise<Thread>;
    addData(subtaskId: string, data: AddDataRequest, authorizationHeader: string): Promise<Thread>;
    // addDataSets(
    //     subtaskId: string,
    //     dataSetIds: string[],
    //     authorizationHeader: string
    // ): Promise<Thread>;
}

const subTasksService: SubTasksService = {
    async getSubtasksByTaskId(
        problemStatementId: string,
        taskId: string,
        authorizationHeader: string
    ) {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }

        const task = await getTask(taskId);
        if (!task) {
            throw new NotFoundError("Task not found");
        }

        if (task.problem_statement_id !== problemStatementId) {
            throw new NotFoundError("Task not found in the specified problem statement");
        }

        return Object.values(task.threads || {});
    },

    async getSubtaskById(
        problemStatementId: string,
        taskId: string,
        subtaskId: string,
        authorizationHeader: string
    ) {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }

        const task = await getTask(taskId);
        if (!task) {
            throw new NotFoundError("Task not found");
        }

        if (task.problem_statement_id !== problemStatementId) {
            throw new NotFoundError("Task not found in the specified problem statement");
        }

        const subtask = task.threads?.[subtaskId];
        if (!subtask) {
            throw new NotFoundError("Subtask not found");
        }

        return subtask;
    },

    async createSubtask(
        problemStatementId: string,
        taskId: string,
        subtask: ThreadInfo,
        authorizationHeader: string
    ) {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }

        const problemStatement = await problemStatementsService.getProblemStatementById(
            problemStatementId,
            authorizationHeader
        );

        if (!problemStatement) {
            throw new NotFoundError("Problem statement not found");
        }

        const task = await getTask(taskId);
        if (!task) {
            throw new NotFoundError("Task not found");
        }
        if (task.driving_variables) {
            subtask.driving_variables = task.driving_variables;
        }
        if (task.response_variables) {
            subtask.response_variables = task.response_variables;
        }
        if (!subtask.driving_variables || !subtask.response_variables) {
            throw new BadRequestError(
                "Driving variables and response variables must be set in subtask"
            );
        }

        if (task.problem_statement_id !== problemStatementId) {
            throw new NotFoundError("Task not found in the specified problem statement");
        }

        try {
            const taskid = await addThread(task, subtask);
            if (!taskid) {
                throw new InternalServerError("Failed to create subtask");
            }
            return taskid; // Return the thread ID
        } catch (error) {
            console.error("Error creating subtask:", error);
            throw new InternalServerError("Error creating subtask: " + error.message);
        }
    },
    async addModels(subtaskId: string, modelIds: string[], authorizationHeader: string) {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }

        const subtask = await getThread(subtaskId);
        if (!subtask) {
            throw new NotFoundError("Subtask not found");
        }
        for (const modelId of modelIds) {
            const w3Id = convertApiUrlToW3Id(modelId);
            if (!(await getModel(w3Id))) {
                let modelConfigurationGraphQL: Model_Insert_Input;
                try {
                    const modelConfiguration = await fetchModelConfiguration(w3Id);
                    modelConfigurationGraphQL = modelConfigurationToGraphQL(modelConfiguration);
                } catch (error) {
                    const modelConfigurationSetup = await fetchModelConfigurationSetup(modelId);
                    modelConfigurationGraphQL =
                        modelConfigurationSetupToGraphQL(modelConfigurationSetup);
                }
                await insertModel([modelConfigurationGraphQL]);
            }
            await setThreadModels([{ id: w3Id }], "Added models", subtask);
        }
        return await getThread(subtaskId);
    },

    async addData(subtaskId: string, data: AddDataRequest, authorizationHeader: string) {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }
        const subtask = await getThread(subtaskId);
        if (!subtask) {
            throw new NotFoundError("Subtask not found");
        }
        await useModelsService.matchModel(data, subtask);
        return subtask;
    },

    async submitSubtask(subtaskId: string, model_id: string, authorizationHeader: string) {
        const executionEngine = getConfiguration().execution_engine;
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }
        const subtask = await getThread(subtaskId);
        if (!subtask) {
            throw new NotFoundError("Subtask not found");
        }
        const executionService = getExecutionEngineService(executionEngine, authorizationHeader);
        const executionCreation = new ExecutionCreation(
            subtask,
            model_id,
            executionService,
            access_token
        );
        await executionCreation.prepareExecutions();
        return await executionService.submitExecutions(
            executionCreation.executionToBeRun,
            executionCreation.model,
            executionCreation.threadRegion,
            executionCreation.component,
            subtask.id,
            subtaskId
        );
    }

    //     async findRequiredResources(subtaskId: string, authorizationHeader: string) {
    //         const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
    //         if (!access_token) {
    //             throw new UnauthorizedError("Invalid authorization header");
    //         }
    //         const subtask = await getThread(subtaskId);
    //         if (!subtask) {
    //             throw new NotFoundError("Subtask not found");
    //         }
    //         const requiredResources = [];
    //         for (const model of Object.values(subtask.models)) {
    //             const model_ensemble = subtask.model_ensembles[model.id];
    //             for (const input of model.hasInput) {
    //                 if (input.hasResource) {
    //                     requiredResources.push(input.hasResource.id);
    //                 }
    //             }
    //             for (const parameter of model.hasParameter) {
    //         }
    //         return requiredResources;
    //     }
};

export default subTasksService;
