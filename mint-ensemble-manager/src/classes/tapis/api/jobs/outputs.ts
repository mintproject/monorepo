import { Jobs } from "@mfosorio/tapis-typescript";
import apiGenerator from "../../utils/apiGenerator";
import errorDecoder from "../../utils/errorDecoder";

const getJobOutputs = (
    jobUuid: string,
    outputPath: string,
    basePath: string,
    jwt: string
): Promise<Jobs.RespGetJobOutputList> => {
    const api: Jobs.JobsApi = apiGenerator<Jobs.JobsApi>(Jobs, Jobs.JobsApi, basePath, jwt);
    return errorDecoder<Jobs.RespGetJobOutputList>(() =>
        api.getJobOutputList({ jobUuid: jobUuid, outputPath: outputPath })
    );
};

export default getJobOutputs;
