import { getExecution } from "../../../classes/graphql/graphql_functions";
import { Execution } from "../../../classes/mint/mint-types";
import { fetchWingsRunLog } from "../../../classes/wings/wings-functions";
import { fetchLocalRunLog } from "../../../classes/localex/local-execution-functions";
import { fetchMintConfig } from "../../../classes/mint/mint-functions";
import { createResponse } from "./util";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";

// ./api-v1/services/logsService.js
export interface LogsService {
    getAccessToken(authorizationHeader: string): string;
    fetchLog(execution_id: string, authorizationHeader: string): Promise<string>;
}

const logsService: LogsService = {
    getAccessToken(authorizationHeader: string): string {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new Error("Invalid authorization header");
        }
        return access_token;
    },
    async fetchLog(execution_id: string, authorizationHeader: string) {
        try {
            const prefs = await fetchMintConfig();
            const execution: Execution = await getExecution(execution_id);
            if (!execution.execution_engine || prefs.execution_engine == "wings") {
                const log = await fetchWingsRunLog(execution.runid, prefs);
                return log;
            } else if (prefs.execution_engine == "localex") {
                const log = fetchLocalRunLog(execution_id, prefs);
                return log;
            } else if (prefs.execution_engine == "tapis") {
                const access_token = this.getAccessToken(authorizationHeader);
                const tapisExecutionService = new TapisExecutionService(
                    access_token,
                    prefs.tapis.basePath
                );
                if (!execution.runid) {
                    return createResponse(
                        "failure",
                        "Run ID is not set for this execution. Please try again later."
                    );
                }
                const response = await tapisExecutionService.getJobHistory(execution.runid);
                let log = "";
                for (const result of response.result) {
                    log += `[${result.created} - ${result.event}] ${result.eventDetail}\n`;
                }
                return log;
            }
        } catch (error) {
            console.log(error);
            return createResponse("failure", error.message);
        }
    }
};

export default logsService;
