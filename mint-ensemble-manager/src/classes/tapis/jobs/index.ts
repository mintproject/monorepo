import { Jobs } from "@mfosorio/tapis-typescript";
import getJobOutputs from "../api/jobs/outputs";
import { getModelOutputsByModelId } from "../../../classes/graphql/graphql_functions";
import { Execution, Execution_Result, ModelOutput } from "../../../classes/mint/mint-types";
import { getMd5Hash } from "../../../classes/graphql/graphql_adapter";
import getJobOutputDownload from "../api/jobs/jobOutputDownload";
import { getTapisToken } from "../authenticator";

const getJobOutputList = async (
    jobUuid: string,
    outputPath: string | undefined
): Promise<Jobs.RespGetJobOutputList> => {
    const { token, basePath } = await getTapisToken();
    const realOutputPath = outputPath || "";
    return await getJobOutputs(jobUuid, realOutputPath, basePath, token.access_token);
};

const getJobOutputDownloadFile = async (jobUuid: string, outputPath: string): Promise<Blob> => {
    const { token, basePath } = await getTapisToken();
    return await getJobOutputDownload(jobUuid, outputPath, basePath, token.access_token);
};

const matchTapisOutputsToMintOutputs = (
    files: Jobs.FileInfo[],
    mintOutputs: ModelOutput[]
): Execution_Result[] => {
    return files
        .flatMap((file) => {
            const modelOutput = mintOutputs.find((output: ModelOutput) => {
                if (output.model_io.name.toLowerCase() === file.name.toLowerCase()) {
                    return output;
                }
            });
            if (!modelOutput) return undefined;
            else {
                const executionResult: Execution_Result = {
                    resource: {
                        name: file.name,
                        url: file.url,
                        id: getMd5Hash(file.url)
                        // spatial_coverage: getSpatialCoverageGeometry(data["spatial_coverage"]),
                        // time_period: {}
                    },
                    model_io: modelOutput.model_io
                };
                return executionResult;
            }
        })
        .filter((result) => result !== undefined) as Execution_Result[];
};

async function getExecutionResultsFromJob(jobUuid: string, execution: Execution) {
    const { result: files } = await getJobOutputList(jobUuid, "");
    const mintOutputs = await getModelOutputsByModelId(execution.modelid);
    const executionResults: Execution_Result[] = matchTapisOutputsToMintOutputs(files, mintOutputs);
    return executionResults;
}

export { matchTapisOutputsToMintOutputs, getExecutionResultsFromJob, getJobOutputDownloadFile };
