import { getThread } from "@/classes/graphql/graphql_functions";
import { Thread } from "@/classes/mint/mint-types";
import { ModelThread } from "@/classes/api";
import { Response } from "express";
import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { ExecutionCreation } from "@/classes/common/ExecutionCreation";
import { getConfiguration } from "@/classes/mint/mint-functions";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
export interface ExecutionsTapisService {
    submitExecution(threadmodel: ModelThread, token: string): Promise<Response>;
}

const executionsTapisService = {
    async submitExecution(threadmodel: ModelThread, authorization: string) {
        const token = getTokenFromAuthorizationHeader(authorization);
        if (!token) {
            throw new Error("Unauthorized");
        }
        const prefs = getConfiguration();
        const TapisExecution = new TapisExecutionService(token, prefs.tapis.basePath);
        const thread: Thread = await getThread(threadmodel.thread_id);
        if (thread) {
            const executionCreation = new ExecutionCreation(thread, threadmodel.model_id);
            await executionCreation.prepareExecutions();
            const jobIds = await TapisExecution.submitExecutions(
                executionCreation.executionToBeRun,
                executionCreation.model,
                executionCreation.threadRegion,
                executionCreation.component,
                thread.id
            );
            console.log("jobIds", jobIds);
            return thread;
        } else {
            return undefined;
        }
    }
};

export default executionsTapisService;
