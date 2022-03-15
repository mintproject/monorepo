import { getThread, getProblemStatement } from "../../../classes/graphql/graphql_functions";
import { Thread, ProblemStatement } from "../../../classes/mint/mint-types";
import { saveAndRunExecutionsLocally, deleteExecutableCacheLocally } from "../../../classes/mint/mint-local-functions";
import { fetchMintConfig } from "../../../classes/mint/mint-functions";
import { KeycloakAdapter } from "../../../config/keycloak-adapter";

// ./api-v1/services/executionsLocalService.js

const createResponse = (result: string, message: string) => {
    return {
        result: result,
        message: message
    };
}

const executionsLocalService = {
    async submitExecution(threadmodel: any) {
        let mint_prefs = await fetchMintConfig();
        //KeycloakAdapter.signOut();
        await KeycloakAdapter.signIn(mint_prefs.graphql.username, mint_prefs.graphql.password);

        let thread: Thread = await getThread(threadmodel.thread_id); //.then((thread: Thread) => {
        if(thread) {
            saveAndRunExecutionsLocally(thread, threadmodel.model_id, mint_prefs);
            return createResponse("success",
                "Thread " + threadmodel.thread_id + " submitted for execution !");
        }
        else {
            return createResponse("failure", "Thread " + threadmodel.thread_id + " not found !");
        }
    },
    async deleteExecutionCache(threadmodel: any) {
        let mint_prefs = await fetchMintConfig();

        //KeycloakAdapter.signOut();
        await KeycloakAdapter.signIn(mint_prefs.graphql.username, mint_prefs.graphql.password);

        let thread: Thread = await getThread(threadmodel.thread_id); //.then((thread: Thread) => {
        if(thread) {
            deleteExecutableCacheLocally(thread, threadmodel.model_id, mint_prefs);
            return createResponse("success",
                "Thread " + threadmodel.thread_id + " execution cache deleted !");
        }
        else {
            return createResponse("failure", "Thread " + threadmodel.thread_id + " not found !");
        }
    }
};

export default executionsLocalService;