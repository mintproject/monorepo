import { getExecution } from "@/classes/graphql/graphql_functions";
import { Execution } from "@/classes/mint/mint-types";
import { fetchWingsRunLog } from "@/classes/wings/wings-functions";
import { fetchLocalRunLog } from "@/classes/localex/local-execution-functions";
import { fetchMintConfig } from "@/classes/mint/mint-functions";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { NotFoundError, UnauthorizedError } from "@/classes/common/errors";

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
        const prefs = await fetchMintConfig();
        const execution: Execution = await getExecution(execution_id);
        if (!execution) {
            throw new NotFoundError("Execution not found");
        }
        if (prefs.execution_engine == "wings") {
            return await fetchWingsRunLog(execution.runid, prefs);
        } else if (prefs.execution_engine == "localex") {
            return fetchLocalRunLog(execution_id, prefs);
        } else if (prefs.execution_engine == "tapis") {
            const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
            if (!access_token) {
                throw new UnauthorizedError("Invalid authorization header");
            }
            const tapisExecutionService = new TapisExecutionService(
                access_token,
                prefs.tapis.basePath
            );
            return await tapisExecutionService.getLog(execution.runid);
        }
    }
};

export default logsService;
