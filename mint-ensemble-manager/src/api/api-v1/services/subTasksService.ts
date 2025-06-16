import { Thread, ThreadInfo } from "@/classes/mint/mint-types";
import {
    addThread,
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
import { fetchModelConfigurationSetup } from "@/classes/mint/model-catalog-functions";
import { ModelConfigurationSetup } from "@mintproject/modelcatalog_client/dist";

export interface SubTasksService {
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
            const model: ModelConfigurationSetup = await fetchModelConfigurationSetup(modelId);
            await setThreadModels([model], "Added models", subtask);
        }
        return await getThread(subtaskId);
    }

    //     // Get the resources required for each model in the subtask
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
