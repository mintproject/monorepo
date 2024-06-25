import { Jobs } from "@mfosorio/tapis-typescript";
import apiGenerator from "../../utils/apiGenerator";
import errorDecoder from "../../utils/errorDecoder";

const suscribe = (
    request: Jobs.ReqSubscribe,
    basePath: string,
    jobUuid: string,
    jwt: string
): Promise<Jobs.RespResourceUrl> => {
    const api: Jobs.SubscriptionsApi = apiGenerator<Jobs.SubscriptionsApi>(
        Jobs,
        Jobs.SubscriptionsApi,
        basePath,
        jwt
    );
    return errorDecoder<Jobs.RespResourceUrl>(() =>
        api.subscribe({ jobUuid: jobUuid, reqSubscribe: request })
    );
};

export default suscribe;
