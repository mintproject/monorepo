import { getPathway, getScenario, fetchMintConfig, getExecutableEnsemble } from "../../../classes/mint/firebase-functions";
import { Pathway, Scenario, ExecutableEnsemble } from "../../../classes/mint/mint-types";
import { saveAndRunExecutableEnsembles, monitorAllEnsembles } from "../../../classes/mint/mint-functions";
import { fetchWingsRunLog } from "../../../classes/wings/wings-functions";
import { fetchLocalRunLog } from "../../../classes/localex/local-execution-functions";

// ./api-v1/services/logsService.js


const logsService = {
    async fetchLog(ensemble_id: string) {
        let mint_prefs = await fetchMintConfig();
        let ensemble: ExecutableEnsemble = await getExecutableEnsemble(ensemble_id);
        if(ensemble.execution_engine == "wings") {
            let log = await fetchWingsRunLog(ensemble.runid, mint_prefs);
            return log;
        }
        else if(ensemble.execution_engine == "localex") {
            let log = fetchLocalRunLog(ensemble_id, mint_prefs);
            return log;
        }
    }
};

export default logsService;