import { getExecution } from "@/classes/graphql/graphql_functions";
import { getConfiguration } from "@/classes/mint/mint-functions";
import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { BadRequestError, NotFoundError } from "@/classes/common/errors";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";

/**
 * One file that an execution archived.
 *
 * MINT does not store this file. `execution_result` has the primary key
 * `(execution_id, model_io_id, resource_id)`, so it holds a typed result only.
 * A raw artifact stays in the Tapis archive, and this service lists it live.
 */
export interface ExecutionFile {
    /** The file name, without the folder. */
    name: string;
    /** The path on the archive system. It tells two files of the same name apart. */
    path: string;
    /** The size in bytes. */
    size: number;
    /** The `tapis://` URI. CKAN reads this URI as it is. */
    url: string;
}

export interface ExecutionFilesService {
    listFiles(executionId: string, authorizationHeader: string): Promise<ExecutionFile[]>;
}

const toExecutionFile = (file: { name?: string; path?: string; size?: number; url?: string }) => ({
    name: file.name ?? "",
    path: file.path ?? "",
    size: file.size ?? 0,
    url: file.url ?? ""
});

const executionFilesService: ExecutionFilesService = {
    /**
     * List the files that an execution archived.
     *
     * The service forwards the token of the user. The archive lives in the
     * `$WORK` directory of that user on `ls6`, and Tapis refuses a token of
     * another user.
     *
     * An execution that Tapis did not start yet has no `runid`. The archive
     * does not exist, so the answer is an empty list. An archive that holds no
     * file answers an empty list too.
     */
    async listFiles(executionId: string, authorizationHeader: string): Promise<ExecutionFile[]> {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        const execution = await getExecution(executionId);
        if (!execution) {
            throw new NotFoundError("Execution not found");
        }

        const prefs = getConfiguration();
        if (prefs.execution_engine !== "tapis") {
            throw new BadRequestError(
                "Only a Tapis execution archives files. This instance runs " +
                    prefs.execution_engine
            );
        }
        if (!execution.runid) {
            return [];
        }

        const tapisExecutionService = new TapisExecutionService(access_token, prefs.tapis.basePath);
        const files = await tapisExecutionService.listJobFiles(execution.runid);
        return files.map(toExecutionFile);
    }
};

export default executionFilesService;
