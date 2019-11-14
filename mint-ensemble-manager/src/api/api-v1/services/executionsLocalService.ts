import { getPathway, getScenario } from "../../../classes/mint/firebase-functions";
import { Pathway, Scenario } from "../../../classes/mint/mint-types";
import { saveAndRunExecutableEnsemblesLocally } from "../../../classes/mint/mint-local-functions";
import { MINT_PREFERENCES as mint_prefs} from "../../../config/mint";

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
                saveAndRunExecutableEnsemblesLocally(pathway, scenario, mint_prefs);
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

export default executionsLocalService;