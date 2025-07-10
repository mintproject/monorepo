import { ModelThread } from "@/classes/api";
import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { ExecutionCreation } from "@/classes/common/ExecutionCreation";
import { getConfiguration } from "@/classes/mint/mint-functions";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { NotFoundError } from "@/classes/common/errors";
import { threadFromGQL } from "@/classes/graphql/graphql_adapter";
import { getThread } from "@/classes/graphql/graphql_functions_v2";

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
        const threadResponse = await getThread(threadmodel.thread_id);
        const thread = threadFromGQL(threadResponse);
        if (thread) {
            const executionCreation = new ExecutionCreation(
                thread,
                threadmodel.model_id,
                TapisExecution,
                token
            );
            await executionCreation.prepareExecutions();
            // Find the thread model id for the given model id
            const threadModelId = threadResponse.thread_models.find(
                (thread_model) => thread_model.model_id === threadmodel.model_id
            )?.id;
            if (!threadModelId) {
                throw new NotFoundError("Thread model not found");
            }
            if (executionCreation.executionToBeRun.length > 0) {
                console.log("Execution to be run", executionCreation.executionToBeRun.length);
                const jobIds = await TapisExecution.submitExecutions(
                    executionCreation.executionToBeRun,
                    executionCreation.model,
                    executionCreation.threadRegion,
                    executionCreation.component,
                    thread.id,
                    threadModelId
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
