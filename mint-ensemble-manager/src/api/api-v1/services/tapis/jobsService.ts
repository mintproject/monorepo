import { Execution } from "../../../../classes/mint/mint-types";
import handleExecutionEvent from "../../../../classes/tapis/handle-execution-event";

export interface JobsService {
    webhookJobStatusChange(webHookEvent: any, executionId: string): Promise<Execution | undefined>;
}

const jobsService = {
    async webhookJobStatusChange(
        webHookEvent: any,
        executionId: string
    ): Promise<Execution | undefined> {
        return await handleExecutionEvent(webHookEvent.event, executionId);
    }
};

export default jobsService;
