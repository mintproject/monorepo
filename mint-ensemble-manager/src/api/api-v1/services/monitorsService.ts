import { getPathway, getScenario } from "../../../classes/mint/firebase-functions";
import { Pathway, Scenario } from "../../../classes/mint/mint-types";
import { monitorAllEnsembles } from "../../../classes/mint/mint-functions";
import { MINT_PREFERENCES as mint_prefs} from "../../../config/wings";

// ./api-v1/services/monitorsService.js

const createResponse = (result: string, message: string) => {
    return {
        result: result,
        message: message
    };
}

const monitorsService = {
    async submitMonitor(thread: any) {
        let scenario: Scenario = await getScenario(thread.scenario_id); //.then((scenario: Scenario) => {
        if(scenario) {
            let pathway: Pathway = await getPathway(thread.scenario_id, thread.thread_id); //.then((pathway: Pathway) => {
            if(pathway) {
                monitorAllEnsembles(pathway, scenario, mint_prefs);
                return createResponse("success",
                    "Thread " + thread.thread_id + " submitted for monitoring !");
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

export default monitorsService;