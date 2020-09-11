import { getThread, getProblemStatement, fetchMintConfig } from "../../../classes/graphql/graphql_functions";
import { Thread, ProblemStatement } from "../../../classes/mint/mint-types";
import { monitorAllExecutions } from "../../../classes/mint/mint-functions";

// ./api-v1/services/monitorsService.js

const createResponse = (result: string, message: string) => {
    return {
        result: result,
        message: message
    };
}

const monitorsService = {
    async submitMonitor(threadmodel: any) {
        let thread: Thread = await getThread(threadmodel.thread_id); //.then((thread: Thread) => {
        if(thread) {
            let mint_prefs = await fetchMintConfig();
            monitorAllExecutions(thread, threadmodel.model_id, mint_prefs);
            return createResponse("success",
                "Thread " + threadmodel.thread_id + " submitted for monitoring !");
        }
        else {
            return createResponse("failure", "Thread " + threadmodel.thread_id + " not found !");
        }
    },
    async fetchRunStatus(threadid: string) {
        let thread = await getThread(threadid);
        if(thread)
            return thread.execution_summary;
        else 
            return createResponse("failure", "Thread not found");
    }
};

export default monitorsService;