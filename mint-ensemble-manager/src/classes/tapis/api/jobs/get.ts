import { Jobs } from "@mfosorio/tapis-typescript";
import apiGenerator from "../../utils/apiGenerator";
import errorDecoder from "../../utils/errorDecoder";

const basePath = process.env.TAPIS_BASE_PATH;

const get = (jobId: string, jwt: string): Promise<Jobs.RespGetJob> => {
    const api: Jobs.JobsApi = apiGenerator<Jobs.JobsApi>(Jobs, Jobs.JobsApi, basePath, jwt);
    return errorDecoder<Jobs.RespGetJob>(() => api.getJob({ jobUuid: jobId }));
};

export default get;
