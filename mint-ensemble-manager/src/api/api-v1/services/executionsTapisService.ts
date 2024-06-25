import { getThread } from "../../../classes/graphql/graphql_functions";
import { Thread } from "../../../classes/mint/mint-types";
import { ModelThread } from "../../../classes/api";
import { saveAndRunExecutionsTapis } from "../../../classes/tapis/prepare-execution";
import { fetchMintConfig } from "../../../classes/mint/mint-functions";
import { Response } from "express";

export interface ExecutionsTapisService {
    submitExecution(threadmodel: ModelThread): Promise<Response>;
}

const executionsTapisService = {
    async submitExecution(threadmodel: ModelThread) {
        const thread: Thread = await getThread(threadmodel.thread_id);
        if (thread) {
            const prefs = await fetchMintConfig();
            await saveAndRunExecutionsTapis(thread, threadmodel.model_id, prefs);
            return thread;
        } else {
            return undefined;
        }
    }
};

export default executionsTapisService;
