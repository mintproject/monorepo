import { getPathway, getScenario, fetchMintConfig } from "../../../classes/mint/firebase-functions";
import { Pathway, Scenario } from "../../../classes/mint/mint-types";
import { saveAndRunExecutableEnsemblesLocally, deleteExecutableCacheLocally } from "../../../classes/mint/mint-local-functions";

// ./api-v1/services/executionsLocalService.js

const createResponse = (result: string, message: string) => {
    return {
        result: result,
        message: message
    };
}

const executionsLocalService = {
    async submitExecution(thread: any) {
        let scenario: Scenario = await getScenario(thread.scenario_id); //.then((scenario: Scenario) => {
        if(scenario) {
            let pathway: Pathway = await getPathway(thread.scenario_id, thread.thread_id); //.then((pathway: Pathway) => {
            if(pathway) {
                let mint_prefs = await fetchMintConfig();
                saveAndRunExecutableEnsemblesLocally(pathway, scenario, thread.model_id, mint_prefs);
                return createResponse("success",
                    "Thread " + thread.thread_id + " submitted for execution !");
            }
            else {
                return createResponse("failure", "Thread " + thread.thread_id + " not found !");
            }
        }
        else {
            return createResponse("failure", "Problem " + thread.scenario_id + " not found !");
        }
    },
    async deleteExecutionCache(thread: any) {
        let scenario: Scenario = await getScenario(thread.scenario_id); //.then((scenario: Scenario) => {
        if(scenario) {
            let pathway: Pathway = await getPathway(thread.scenario_id, thread.thread_id); //.then((pathway: Pathway) => {
            if(pathway) {
                let mint_prefs = await fetchMintConfig();
                deleteExecutableCacheLocally(pathway, scenario, thread.model_id, mint_prefs);
                return createResponse("success",
                    "Thread " + thread.thread_id + " execution cache deleted !");
            }
            else {
                return createResponse("failure", "Thread " + thread.thread_id + " not found !");
            }
        }
        else {
            return createResponse("failure", "Problem " + thread.scenario_id + " not found !");
        }
    }
};

export default executionsLocalService;