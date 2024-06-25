import { Apps, Jobs } from "@mfosorio/tapis-typescript";
import apiGenerator from "../../utils/apiGenerator";
import errorDecoder from "../../utils/errorDecoder";

const detail = (params: Apps.GetAppRequest, basePath: string, jwt: string) => {
    const api: Apps.ApplicationsApi = apiGenerator<Apps.ApplicationsApi>(
        Apps,
        Apps.ApplicationsApi,
        basePath,
        jwt
    );
    return errorDecoder<Apps.RespApp>(() => api.getApp(params));
};

export default detail;
