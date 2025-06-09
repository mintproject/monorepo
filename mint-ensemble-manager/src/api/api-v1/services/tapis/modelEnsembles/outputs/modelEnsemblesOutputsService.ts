import { getConfiguration } from "@/classes/mint/mint-functions";
import {
    getThreadModelExecutionIds,
    incrementPublishedRuns,
    toggleThreadModelExecutionSummaryPublishing
} from "@/classes/graphql/graphql_functions";
import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { NotFoundError } from "@/classes/common/errors";

export interface ModelEnsemblesOutputsService {
    registerOutputs(modelEnsembleId: string, authorization: string): void;
}

const modelEnsemblesOutputsService: ModelEnsemblesOutputsService = {
    async registerOutputs(modelEnsembleId: string, authorization: string): Promise<void> {
        const token = getTokenFromAuthorizationHeader(authorization);
        if (!token) {
            throw new Error("Unauthorized");
        }

        const prefs = getConfiguration();
        const tapisExecution = new TapisExecutionService(token, prefs.tapis.basePath);

        // Get all execution IDs for the model ensemble
        const executionIds = await getThreadModelExecutionIds(modelEnsembleId);

        if (executionIds.length === 0) {
            throw new NotFoundError("No executions found for model ensemble");
        }

        toggleThreadModelExecutionSummaryPublishing(modelEnsembleId, true);
        // Process each execution asynchronously without waiting
        for (const executionId of executionIds) {
            try {
                await tapisExecution.registerExecutionOutputs(executionId);
                await incrementPublishedRuns(modelEnsembleId);
            } catch (error) {
                console.error(`Error registering outputs for execution ${executionId}:`, error);
            }
        }
        toggleThreadModelExecutionSummaryPublishing(modelEnsembleId, false);
    }
};

export default modelEnsemblesOutputsService;
