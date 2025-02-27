import { Execution } from "../../../../classes/mint/mint-types";
import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { getConfiguration } from "@/classes/mint/mint-functions";
import { ExecutionJob } from "@/interfaces/IExecutionService";
import { Jobs } from "@mfosorio/tapis-typescript/dist";
export interface JobsService {
    webhookJobStatusChange(webHookEvent: any, executionId: string): Promise<Execution | undefined>;
    get(jobId: string, authorizationHeader: string): Promise<ExecutionJob>;
    submitJob(job: Jobs.ReqSubmitJob, authorizationHeader: string): Promise<string>;
}

const jobsService = {
    getAccessToken(authorizationHeader: string): string {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new Error("Invalid authorization header");
        }
        return access_token;
    },

    async webhookJobStatusChange(
        webHookEvent: any,
        executionId: string,
        authorizationHeader: string
    ): Promise<Execution | undefined> {
        const access_token = this.getAccessToken(authorizationHeader);
        const prefs = getConfiguration();
        const executionService = new TapisExecutionService(access_token, prefs.tapis.basePath);
        return await executionService.updateExecution(
            executionId,
            webHookEvent.event.type,
            webHookEvent.event.subject
        );
    },

    async get(jobId: string, authorizationHeader: string): Promise<ExecutionJob> {
        const access_token = this.getAccessToken(authorizationHeader);
        const prefs = getConfiguration();
        const executionService = new TapisExecutionService(access_token, prefs.tapis.basePath);
        return await executionService.getJobStatus(jobId);
    },

    async submitJob(job: Jobs.ReqSubmitJob, authorizationHeader: string): Promise<string> {
        const access_token = this.getAccessToken(authorizationHeader);
        const prefs = getConfiguration();

        const executionService = new TapisExecutionService(access_token, prefs.tapis.basePath);
        return await executionService.submitJob(job);
    }
};

export default jobsService;
