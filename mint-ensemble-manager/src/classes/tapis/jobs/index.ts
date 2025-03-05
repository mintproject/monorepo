import { Jobs } from "@mfosorio/tapis-typescript";
import { getMd5Hash } from "../../../classes/graphql/graphql_adapter";
import { Execution_Result, ModelOutput } from "../../../classes/mint/mint-types";

const matchTapisOutputsToMintOutputs = (
    files: Jobs.FileInfo[],
    mintOutputs: ModelOutput[]
): Execution_Result[] => {
    const PORTAL_URL = "https://ptdatax.tacc.utexas.edu/workbench/data/tapis/private/cloud.data";
    return files
        .flatMap((file) => {
            const modelOutput = mintOutputs.find((output: ModelOutput) => {
                if (output.model_io.name.toLowerCase() === file.name.toLowerCase()) {
                    return output;
                }
            });
            if (!modelOutput) return undefined;
            else {
                // Transform the Tapis URL to the public portal URL
                const publicUrl = file.url.replace("tapis://ls6", PORTAL_URL);

                const executionResult: Execution_Result = {
                    resource: {
                        name: file.name,
                        url: publicUrl,
                        id: getMd5Hash(publicUrl)
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

export { matchTapisOutputsToMintOutputs };
