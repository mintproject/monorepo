import { Jobs } from "@mfosorio/tapis-typescript";
import apiGenerator from "../../utils/apiGenerator";
import errorDecoder from "../../utils/errorDecoder";

const submit = (
    request: Jobs.ReqSubmitJob,
    basePath: string,
    jwt: string
): Promise<Jobs.RespSubmitJob> => {
    const api: Jobs.JobsApi = apiGenerator<Jobs.JobsApi>(Jobs, Jobs.JobsApi, basePath, jwt);
    return errorDecoder<Jobs.RespSubmitJob>(() => api.submitJob({ reqSubmitJob: request }));
};

export default submit;
