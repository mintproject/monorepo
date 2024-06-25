import { getConfiguration } from "../../../classes/mint/mint-functions";
import login from "../api/authenticator/login";

const prefs = getConfiguration();
const username = prefs.tapis.username;
const password = process.env.TAPIS_PASSWORD;
const basePath = prefs.tapis.basePath;

export async function getTapisToken() {
    const { result } = await login(username, password, basePath);
    const token = result.access_token;
    return { token, basePath };
}
