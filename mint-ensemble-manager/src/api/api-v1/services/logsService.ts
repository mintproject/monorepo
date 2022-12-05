import { getExecution } from "../../../classes/graphql/graphql_functions";
import { Execution } from "../../../classes/mint/mint-types";
import { fetchWingsRunLog } from "../../../classes/wings/wings-functions";
import { fetchLocalRunLog } from "../../../classes/localex/local-execution-functions";
import { fetchMintConfig } from "../../../classes/mint/mint-functions";
import { KeycloakAdapter } from "../../../config/keycloak-adapter";

// ./api-v1/services/logsService.js


const logsService = {
    async fetchLog(execution_id: string) {
        let prefs = await fetchMintConfig();
        KeycloakAdapter.signIn(prefs.graphql.username, prefs.graphql.password)

        let ensemble: Execution = await getExecution(execution_id);
        if(!ensemble.execution_engine || ensemble.execution_engine == "wings") {
            let log = await fetchWingsRunLog(ensemble.runid, prefs);
            return log;
        }
        else if(ensemble.execution_engine == "localex") {
            let log = fetchLocalRunLog(execution_id, prefs);
            return log;
        }
    }
};

export default logsService;