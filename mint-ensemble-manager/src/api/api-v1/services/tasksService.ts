import { Task, ThreadInfo } from "@/classes/mint/mint-types";
import {
    addTask,
    addTaskWithThread,
    getProblemStatement
} from "@/classes/graphql/graphql_functions";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { UnauthorizedError, InternalServerError, NotFoundError } from "@/classes/common/errors";
import problemStatementsService from "./problemStatementsService";

export interface TasksService {
    getTasksByProblemStatementId(
        problemStatementId: string,
        authorizationHeader: string
    ): Promise<Task[]>;
    createTask(
        problemStatementId: string,
        task: Task,
        authorizationHeader: string
    ): Promise<string>;
    createTaskWithThread(
        problemStatementId: string,
        task: Task,
        thread: ThreadInfo,
        authorizationHeader: string
    ): Promise<string[]>;
}

const tasksService: TasksService = {
    async getTasksByProblemStatementId(problemStatementId: string, authorizationHeader: string) {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }

        const problemStatement = await getProblemStatement(problemStatementId, access_token);

        if (!problemStatement) {
            throw new NotFoundError("Problem statement not found");
        }

        return Object.values(problemStatement.tasks || {});
    },

    async createTask(problemStatementId: string, task: Task, authorizationHeader: string) {
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

        try {
            const id = await addTask(problemStatement, task);
            if (!id) {
                throw new InternalServerError("Failed to create task");
            }
            return id;
        } catch (error) {
            console.error("Error creating task:", error);
            throw new InternalServerError("Error creating task: " + error.message);
        }
    },

    async createTaskWithThread(
        problemStatementId: string,
        task: Task,
        thread: ThreadInfo,
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

        try {
            const ids = await addTaskWithThread(problemStatement, task, thread);
            if (!ids) {
                throw new InternalServerError("Failed to create task with thread");
            }
            return ids;
        } catch (error) {
            console.error("Error creating task with thread:", error);
            throw new InternalServerError("Error creating task with thread: " + error.message);
        }
    }
};

export default tasksService;
