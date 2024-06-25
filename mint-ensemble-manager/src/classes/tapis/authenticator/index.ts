import { getConfiguration } from "../../../classes/mint/mint-functions";
import login from "../api/authenticator/login";

export async function getTapisToken() {
    const prefs = getConfiguration();
    const username = prefs.tapis.username;
    const password = process.env.TAPIS_PASSWORD;
    const basePath = prefs.tapis.basePath;

    const { result } = await login(username, password, basePath);
    const token = result.access_token;
    return { token, basePath };
}
