import { getThread } from "@/classes/graphql/graphql_functions";
import { Thread } from "@/classes/mint/mint-types";
import { ModelThread } from "@/classes/api";
import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { ExecutionCreation } from "@/classes/common/ExecutionCreation";
import { getConfiguration } from "@/classes/mint/mint-functions";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { NotFoundError } from "@/classes/common/errors";

export interface ExecutionsTapisService {
    submitExecution(threadmodel: ModelThread, token: string): Promise<string[]>;
}

const executionsTapisService = {
    async submitExecution(threadmodel: ModelThread, authorization: string): Promise<string[]> {
        const token = getTokenFromAuthorizationHeader(authorization);
        if (!token) {
            throw new Error("Unauthorized");
        }
        const prefs = getConfiguration();
        const TapisExecution = new TapisExecutionService(token, prefs.tapis.basePath);
        const thread: Thread = await getThread(threadmodel.thread_id);
        if (thread) {
            const executionCreation = new ExecutionCreation(
                thread,
                threadmodel.model_id,
                TapisExecution,
                token
            );
            await executionCreation.prepareExecutions();
            if (executionCreation.executionToBeRun.length > 0) {
                console.log("Execution to be run", executionCreation.executionToBeRun.length);
                const jobIds = await TapisExecution.submitExecutions(
                    executionCreation.executionToBeRun,
                    executionCreation.model,
                    executionCreation.threadRegion,
                    executionCreation.component,
                    thread.id,
                    threadmodel.thread_id
                );
                return jobIds;
            } else {
                console.log("No executions to run");
                return [];
            }
        } else {
            throw new NotFoundError("Thread not found");
        }
    }
};

export default executionsTapisService;
