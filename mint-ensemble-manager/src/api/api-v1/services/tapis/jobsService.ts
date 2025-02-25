import { Execution } from "../../../../classes/mint/mint-types";
import handleExecutionEvent from "../../../../classes/tapis/handle-execution-event";
import get from "../../../../classes/tapis/api/jobs/get";

export interface JobsService {
    webhookJobStatusChange(webHookEvent: any, executionId: string): Promise<Execution | undefined>;
    get(jobId: string, access_token: string): Promise<string>;
}

const jobsService = {
    async webhookJobStatusChange(
        webHookEvent: any,
        executionId: string
    ): Promise<Execution | undefined> {
        return await handleExecutionEvent(webHookEvent.event, executionId);
    },

    async get(jobId: string, access_token: string): Promise<string> {
        const job = await get(jobId, access_token);
        return job.status;
    }
};

export default jobsService;
