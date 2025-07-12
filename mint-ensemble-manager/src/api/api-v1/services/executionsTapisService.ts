import { ModelThread } from "@/classes/api";
import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { ExecutionCreation } from "@/classes/common/ExecutionCreation";
import { getConfiguration } from "@/classes/mint/mint-functions";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { NotFoundError } from "@/classes/common/errors";
import { threadFromGQL } from "@/classes/graphql/graphql_adapter";
import { getThread } from "@/classes/graphql/graphql_functions_v2";
import { Execution } from "@/classes/mint/mint-types";

export interface ExecutionSubmissionResult {
    jobIds: string[];
    totalExecutions: number;
    successfulSubmissions: number;
    failedSubmissions: number;
    submissionDetails: {
        submittedExecutions: { execution: Execution; jobId: string }[];
        failedExecutions: { execution: Execution; error: Error }[];
    };
}

export interface ExecutionsTapisService {
    submitExecution(threadmodel: ModelThread, token: string): Promise<ExecutionSubmissionResult>;
}

const executionsTapisService = {
    async submitExecution(threadmodel: ModelThread, authorization: string): Promise<ExecutionSubmissionResult> {
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
                const { submittedExecutions, failedExecutions } = await TapisExecution.submitExecutions(
                    executionCreation.executionToBeRun,
                    executionCreation.model,
                    executionCreation.threadRegion,
                    executionCreation.component,
                    thread.id,
                    threadModelId
                );
                if (failedExecutions.length > 0) {
                    console.warn("Some executions failed to submit:", failedExecutions);
                }
                
                return {
                    jobIds: submittedExecutions.map(se => se.jobId),
                    totalExecutions: executionCreation.executionToBeRun.length,
                    successfulSubmissions: submittedExecutions.length,
                    failedSubmissions: failedExecutions.length,
                    submissionDetails: {
                        submittedExecutions,
                        failedExecutions
                    }
                };
            } else {
                console.log("No executions to run");
                return {
                    jobIds: [],
                    totalExecutions: 0,
                    successfulSubmissions: 0,
                    failedSubmissions: 0,
                    submissionDetails: {
                        submittedExecutions: [],
                        failedExecutions: []
                    }
                };
            }
        } else {
            throw new NotFoundError("Thread not found");
        }
    }
};

export default executionsTapisService;
