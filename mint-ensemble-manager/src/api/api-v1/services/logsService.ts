import { getExecution } from "../../../classes/graphql/graphql_functions";
import { Execution } from "../../../classes/mint/mint-types";
import { fetchWingsRunLog } from "../../../classes/wings/wings-functions";
import { fetchLocalRunLog } from "../../../classes/localex/local-execution-functions";
import { fetchMintConfig } from "../../../classes/mint/mint-functions";
import { KeycloakAdapter } from "../../../config/keycloak-adapter";
import { createResponse } from "./util";

// ./api-v1/services/logsService.js

const logsService = {
    async fetchLog(execution_id: string) {
        try {
            const prefs = await fetchMintConfig();
            KeycloakAdapter.signIn(prefs.graphql.username, prefs.graphql.password);

            const ensemble: Execution = await getExecution(execution_id);
            if (!ensemble.execution_engine || ensemble.execution_engine == "wings") {
                const log = await fetchWingsRunLog(ensemble.runid, prefs);
                return log;
            } else if (ensemble.execution_engine == "localex") {
                const log = fetchLocalRunLog(execution_id, prefs);
                return log;
            }
        } catch (error) {
            console.log(error);
            return createResponse("failure", error);
        }
    }
};

export default logsService;
