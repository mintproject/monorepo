import { getThread } from "@/classes/graphql/graphql_functions";
import { Thread } from "@/classes/mint/mint-types";
import { fetchMintConfig, saveAndRunExecutions } from "@/classes/mint/mint-functions";
import { createResponse, GenericResponse } from "./util";

// ./api-v1/services/executionsService.js
const executionsService = {
    async submitExecution(threadmodel: any): Promise<GenericResponse> {
        const thread: Thread = await getThread(threadmodel.thread_id); //.then((thread: Thread) => {
        if (thread) {
            const mint_prefs = await fetchMintConfig();
            saveAndRunExecutions(thread, threadmodel.model_id, mint_prefs);
            return createResponse(
                "success",
                "Thread " + threadmodel.thread_id + " submitted for execution !"
            );
        } else {
            return createResponse("failure", "Thread " + threadmodel.thread_id + " not found !");
        }
    }
};

export default executionsService;
