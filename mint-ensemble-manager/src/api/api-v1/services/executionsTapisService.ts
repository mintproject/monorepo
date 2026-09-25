import { ModelThread } from "@/classes/api";
import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { ExecutionCreation } from "@/classes/common/ExecutionCreation";
import { getConfiguration } from "@/classes/mint/mint-functions";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { NotFoundError } from "@/classes/common/errors";
import { threadFromGQL } from "@/classes/graphql/graphql_adapter";
import { getThread } from "@/classes/graphql/graphql_functions_v2";
import { getExecution as getExecutionById } from "@/classes/graphql/graphql_functions";
import { SubmissionResult } from "@/interfaces/IExecutionService";
import { applyExecutionInputOverrides } from "@/classes/common/execution-input-overrides";

type AdapterAwareModelThread = ModelThread & {
    adapter_resource_overrides?: Parameters<typeof applyExecutionInputOverrides>[2];
    max_minutes?: number;
};

export interface ExecutionsTapisService {
    submitExecution(threadmodel: AdapterAwareModelThread, token: string): Promise<SubmissionResult>;
    buildCompositeWorkflowModelTask(
        threadmodel: AdapterAwareModelThread,
        workflowPath: string,
        authorization: string
    ): Promise<{
        execution_id: string;
        output_uri: string;
        output_name: string;
        job_definition: unknown;
    }>;
    getExecution(executionId: string, token: string): Promise<any>;
    getJobStatus(jobId: string, token: string): Promise<any>;
}

const executionsTapisService = {
    async getExecution(executionId: string, _authorization: string): Promise<any> {
        const execution = await getExecutionById(executionId);
        if (!execution) throw new NotFoundError("Execution not found");
        return execution;
    },
    async getJobStatus(jobId: string, authorization: string): Promise<any> {
        const token = getTokenFromAuthorizationHeader(authorization);
        if (!token) throw new Error("Unauthorized");
        const prefs = getConfiguration();
        const tapisExecution = new TapisExecutionService(token, prefs.tapis.basePath);
        return tapisExecution.getJobStatus(jobId);
    },
    async submitExecution(
        threadmodel: AdapterAwareModelThread,
        authorization: string
    ): Promise<SubmissionResult> {
        const token = getTokenFromAuthorizationHeader(authorization);
        if (!token) {
            throw new Error("Unauthorized");
        }
        const prefs = getConfiguration();
        const TapisExecution = new TapisExecutionService(token, prefs.tapis.basePath);
        const threadResponse = await getThread(threadmodel.thread_id);
        const thread = threadFromGQL(threadResponse);
        if (thread) {
            applyExecutionInputOverrides(
                thread,
                threadmodel.model_id,
                threadmodel.adapter_resource_overrides || []
            );
            const executionCreation = new ExecutionCreation(
                thread,
                threadmodel.model_id,
                TapisExecution,
                token
            );
            await executionCreation.prepareExecutions();
            // Find the thread model id for the given model id
            const threadModelId = threadResponse.thread_models.find(
                (thread_model) => thread_model.modelcatalog_configuration_id === threadmodel.model_id
            )?.id;
            if (!threadModelId) {
                throw new NotFoundError("Thread model not found");
            }
            if (executionCreation.executionToBeRun.length > 0) {
                console.log("Execution to be run", executionCreation.executionToBeRun.length);
                const submissionResult = await TapisExecution.submitExecutions(
                    executionCreation.executionToBeRun,
                    executionCreation.model,
                    executionCreation.threadRegion,
                    executionCreation.component,
                    thread.id,
                    threadModelId,
                    threadmodel.max_minutes
                );
                if (submissionResult.failedExecutions.length > 0) {
                    console.warn(
                        "Some executions failed to submit:",
                        submissionResult.failedExecutions
                    );
                }

                return submissionResult;
            } else {
                console.log("No executions to run");
                return {
                    submittedExecutions: [],
                    failedExecutions: []
                };
            }
        } else {
            throw new NotFoundError("Thread not found");
        }
    },
    async buildCompositeWorkflowModelTask(
        threadmodel: AdapterAwareModelThread,
        workflowPath: string,
        authorization: string
    ) {
        const token = getTokenFromAuthorizationHeader(authorization);
        if (!token) {
            throw new Error("Unauthorized");
        }
        const prefs = getConfiguration();
        const tapisExecution = new TapisExecutionService(token, prefs.tapis.basePath);
        return tapisExecution.buildCompositeWorkflowModelTask(
            threadmodel,
            workflowPath,
            threadmodel.max_minutes
        );
    }
};

export default executionsTapisService;
