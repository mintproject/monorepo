const W3_ID_URI_PREFIX = "https://w3id.org/okn/i/mint/";

/**
 * Converts a Model Catalog REST API URL to a W3ID URI.
 * e.g. https://api.models.mint.local/v1.8.0/modelconfigurations/UUID?username=x
 *      -> https://w3id.org/okn/i/mint/UUID
 */
export const convertApiUrlToW3Id = (url: string): string => {
    const baseUrl = url.split("?")[0];
    const urlParts = baseUrl.split("/");
    const id = urlParts.pop();
    return W3_ID_URI_PREFIX + id;
};

/**
 * Converts a W3ID URI back to a Model Catalog REST API URL (string manipulation only, no REST call).
 * e.g. https://w3id.org/okn/i/mint/UUID -> https://api.models.mint.local/v1.8.0/modelconfigurations/UUID
 */
export const convertW3IdToApiUrl = (w3Id: string, baseApiUrl: string, type: "modelconfigurations" | "modelconfigurationsetups" = "modelconfigurations"): string => {
    const uuid = w3Id.replace(W3_ID_URI_PREFIX, "");
    return `${baseApiUrl}/${type}/${uuid}`;
};
