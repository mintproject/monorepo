import { Jobs } from "@mfosorio/tapis-typescript";
import apiGenerator from "../../utils/apiGenerator";
import errorDecoder from "../../utils/errorDecoder";

const getJobOutputDownload = (
    jobUuid: string,
    outputPath: string,
    basePath: string,
    jwt: string
): Promise<Blob> => {
    const api: Jobs.JobsApi = apiGenerator<Jobs.JobsApi>(Jobs, Jobs.JobsApi, basePath, jwt);
    return errorDecoder<Blob>(() =>
        api.getJobOutputDownload({ jobUuid: jobUuid, outputPath: outputPath })
    );
};

export default getJobOutputDownload;
