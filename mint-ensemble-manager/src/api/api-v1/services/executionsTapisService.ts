import { getThread } from "../../../classes/graphql/graphql_functions";
import { Thread } from "../../../classes/mint/mint-types";
import { ModelThread } from "../../../classes/api";
import { Response } from "express";

import { ExecutionCreation } from "../../../classes/common/ExecutionCreation";
export interface ExecutionsTapisService {
    submitExecution(threadmodel: ModelThread, token: string): Promise<Response>;
}

const executionsTapisService = {
    async submitExecution(threadmodel: ModelThread, token: string) {
        const thread: Thread = await getThread(threadmodel.thread_id);
        if (thread) {
            const executionCreation = new ExecutionCreation(thread, threadmodel.model_id);
            await executionCreation.prepareExecutions();
            console.log("executionToBeRun", executionCreation.executionToBeRun.length);
            return thread;
        } else {
            return undefined;
        }
    }
};

export default executionsTapisService;
