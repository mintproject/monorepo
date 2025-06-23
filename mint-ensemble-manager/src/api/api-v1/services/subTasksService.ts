import { Thread, ThreadInfo } from "@/classes/mint/mint-types";
import {
    addThread,
    insertModel,
    getModel,
    getTask,
    getThread,
    setThreadModels,
    setThreadData,
    setThreadParameters
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
import { Model_Insert_Input } from "@/classes/graphql/types";
import {
    AddDataRequest,
    AddParametersRequest,
    SetupModelConfigurationAndBindingsRequest
} from "../paths/problemStatements/tasks/subtasks";
import useModelsService from "./useModelsService";
import { IExecutionService } from "@/interfaces/IExecutionService";
import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { getConfiguration } from "@/classes/mint/mint-functions";
import { MockExecutionService } from "@/classes/common/__tests__/mocks/MockExecutionService";
import { ExecutionCreation } from "@/classes/common/ExecutionCreation";
import { DatasetSpecification } from "@mintproject/modelcatalog_client/dist";

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
    getModelParameters(model_id: string, authorizationHeader: string): unknown;
    submitSubtask(
        subtaskId: string,
        model_id: string,
        authorizationHeader: string
    ): Promise<Thread>;
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
    addParameters(
        subtaskId: string,
        parameters: AddParametersRequest,
        authorizationHeader: string
    ): Promise<Thread>;
    setupModelConfigurationAndBindings(
        subtaskId: string,
        request: SetupModelConfigurationAndBindingsRequest,
        authorizationHeader: string
    ): Promise<Thread>;
    getModelDataBindings(
        model_id: string,
        authorizationHeader: string
    ): Promise<DatasetSpecification[]>;
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
            subtask.events = [
                {
                    event: "CREATE",
                    timestamp: new Date(),
                    userid: "system",
                    notes: "Added subtask from API"
                }
            ];
            subtask.permissions = [
                { read: true, write: true, execute: true, owner: false, userid: "*" }
            ];
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
                    const modelConfiguration = await fetchModelConfiguration(modelId);
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
        const dataMap = await useModelsService.setInputBindings(data, subtask);
        await setThreadData(
            dataMap,
            subtask.model_ensembles,
            "Setting thread data via API",
            subtask
        );
        return subtask;
    },

    async addParameters(
        subtaskId: string,
        parameters: AddParametersRequest,
        authorizationHeader: string
    ) {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }
        const subtask = await getThread(subtaskId);
        if (!subtask) {
            throw new NotFoundError("Subtask not found");
        }
        await useModelsService.setParameterBindings(parameters, subtask);
        await setThreadParameters(
            subtask.model_ensembles,
            subtask.execution_summary,
            "Setting thread parameters via API",
            subtask
        );
        return subtask;
    },

    async setupModelConfigurationAndBindings(
        subtaskId: string,
        request: SetupModelConfigurationAndBindingsRequest,
        authorizationHeader: string
    ) {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }
        const subtask = await getThread(subtaskId);
        if (!subtask) {
            throw new NotFoundError("Subtask not found");
        }

        // Check if the model exists in the subtask, if not add it
        const modelW3Id = convertApiUrlToW3Id(request.model_id);
        const modelExists = subtask.model_ensembles && subtask.model_ensembles[modelW3Id];

        if (!modelExists) {
            // Add the model first
            await this.addModels(subtaskId, [request.model_id], authorizationHeader);
            // Refresh the subtask after adding the model
            const updatedSubtask = await getThread(subtaskId);
            if (!updatedSubtask) {
                throw new NotFoundError("Subtask not found after adding model");
            }
            // Update the subtask reference for the rest of the method
            Object.assign(subtask, updatedSubtask);
        }

        // Handle data if provided
        if (request.data && request.data.length > 0) {
            const dataRequest: AddDataRequest = {
                model_id: request.model_id,
                data: request.data
            };
            const dataMap = await useModelsService.setInputBindings(dataRequest, subtask);
            await setThreadData(
                dataMap,
                subtask.model_ensembles,
                "Setting thread data via API",
                subtask
            );
        }
        // Handle parameters if provided
        if (request.parameters && request.parameters.length > 0) {
            const parametersRequest: AddParametersRequest = {
                model_id: request.model_id,
                parameters: request.parameters
            };
            await useModelsService.setParameterBindings(parametersRequest, subtask);
            try {
                const result = await setThreadParameters(
                    subtask.model_ensembles,
                    subtask.execution_summary,
                    "Setting thread parameters via API",
                    subtask
                );
                console.log("Result of setting thread parameters:", result);
            } catch (error) {
                console.error("Error setting thread parameters:", error);
                throw new InternalServerError("Error setting thread parameters: " + error.message);
            }
        }

        return await getThread(subtaskId);
    },

    async getModelDataBindings(model_id: string, authorizationHeader: string) {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }
        return await useModelsService.getDataBindingsByModelId(model_id);
    },

    async getModelParameters(model_id: string, authorizationHeader: string) {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }
        return await useModelsService.getModelParametersByModelId(model_id);
    },

    async submitSubtask(subtaskId: string, model_id: string, authorizationHeader: string) {
        const w3id = convertApiUrlToW3Id(model_id);
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }
        const subtask = await getThread(subtaskId);
        if (!subtask) {
            throw new NotFoundError("Subtask not found");
        }
        const executionService = new TapisExecutionService(
            access_token,
            getConfiguration().tapis.basePath
        );
        const executionCreation = new ExecutionCreation(
            subtask,
            w3id,
            executionService,
            access_token
        );
        await executionCreation.prepareExecutions();
        await executionService.submitExecutions(
            executionCreation.executionToBeRun,
            executionCreation.model,
            executionCreation.threadRegion,
            executionCreation.component,
            subtask.id,
            subtask.model_ensembles[w3id].id
        );
        return await getThread(subtaskId);
    }
};

export default subTasksService;
