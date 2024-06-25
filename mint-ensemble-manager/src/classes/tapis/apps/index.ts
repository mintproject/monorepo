import detail from "../api/apps/detail";
import { getTapisToken } from "../authenticator";

async function getTapisApp(
    tapisAppId: string,
    tapisAppVersion: string,
    access_token: string,
    basePath: string
) {
    return await detail({ appId: tapisAppId, appVersion: tapisAppVersion }, basePath, access_token);
}

async function getTapisAppWithoutLogin(tapisAppId: string, tapisAppVersion: string) {
    const { token, basePath } = await getTapisToken();
    return await detail(
        { appId: tapisAppId, appVersion: tapisAppVersion },
        basePath,
        token.access_token
    );
}

export { getTapisApp, getTapisAppWithoutLogin };
