import { getPathway, getScenario, fetchMintConfig } from "../../../classes/mint/firebase-functions";
import { Pathway, Scenario } from "../../../classes/mint/mint-types";
import { saveAndRunExecutableEnsembles, monitorAllEnsembles } from "../../../classes/mint/mint-functions";

// ./api-v1/services/executionsService.js

const createResponse = (result: string, message: string) => {
    return {
        result: result,
        message: message
    };
}

const executionsService = {
    async submitExecution(thread: any) {
        let scenario: Scenario = await getScenario(thread.scenario_id); //.then((scenario: Scenario) => {
        if(scenario) {
            let pathway: Pathway = await getPathway(thread.scenario_id, thread.thread_id); //.then((pathway: Pathway) => {
            if(pathway) {
                let mint_prefs = await fetchMintConfig();
                saveAndRunExecutableEnsembles(pathway, scenario, thread.model_id, mint_prefs);
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
    }
};

export default executionsService;