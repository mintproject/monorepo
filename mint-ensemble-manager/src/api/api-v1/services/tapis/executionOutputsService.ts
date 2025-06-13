import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { getConfiguration } from "@/classes/mint/mint-functions";

export interface ExecutionOutputsService {
    registerOutputs(executionId: string, authorization: string): Promise<any[]>;
}

const executionOutputsService: ExecutionOutputsService = {
    async registerOutputs(executionId: string, authorization: string): Promise<any[]> {
        const token = getTokenFromAuthorizationHeader(authorization);
        if (!token) {
            throw new Error("Unauthorized");
        }

        const prefs = getConfiguration();
        const tapisExecution = new TapisExecutionService(token, prefs.tapis.basePath);
        const results = await tapisExecution.registerExecutionOutputs(executionId);

        return results.map((result) => {
            return {
                ...result
            };
        });
    }
};

export default executionOutputsService;
