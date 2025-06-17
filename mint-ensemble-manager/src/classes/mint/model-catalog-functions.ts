import { MintPreferences } from "./mint-types";
import * as rp from "request-promise-native";
import { ModelConfiguration, ModelConfigurationSetup } from "@mintproject/modelcatalog_client";
import { KeycloakAdapter } from "@/config/keycloak-adapter";

const W3_ID_URI_PREFIX = "https://w3id.org/okn/i/mint/";

// Query Model Catalog By Variables,
// - Filter by driving variables and model id/name (match with calibration)
// - Return only 1 model
export const fetchModelFromCatalog = (
    response_variables: string[],
    driving_variables: string[],
    modelid: string,
    prefs: MintPreferences
): Promise<ModelConfigurationSetup> => {
    const username = KeycloakAdapter.getUser().email;
    return new Promise<any>((resolve, reject) => {
        rp.get({
            url: prefs.model_catalog_api + "custom/modelconfigurationsetups/variable",
            qs: { username: username, label: response_variables.join(",") },
            json: true
        }).then((setups) => {
            let found = false;
            for (let i = 0; i < setups.length; i++) {
                const calib = setups[i] as ModelConfigurationSetup;
                const calibid: string = calib.id;
                const calibname = calibid.replace(/.*\//, "");
                if (calibname == modelid) {
                    // Match !
                    found = true;
                    console.log("We found a matching model: " + calibid + ". Get details");
                    rp.get({
                        url:
                            prefs.model_catalog_api +
                            "custom/modelconfigurationsetups/" +
                            calibname,
                        qs: { username: username },
                        json: true
                    }).then((setup) => {
                        resolve(setup);
                    });
                    break; // Return only 1 match
                }
            }
            if (!found) {
                reject();
            }
        });
    });
};

export enum ModelConfigurationType {
    ModelConfiguration = "modelconfiguration",
    ModelConfigurationSetup = "modelconfigurationsetup"
}

export const convertToUrlToCustomUrl = (url: string, type: ModelConfigurationType) => {
    //input: https://api.models.mint.local/v1.8.0/modelconfigurations/26603296-1530-4f95-9655-ef51e44a5d7c?username=mint%40isi.edu
    //output: https://api.models.mint.local/v1.8.0/custom/modelconfigurationsetups/26603296-1530-4f95-9655-ef51e44a5d7c?username=mint%40isi.edu
    const [baseUrl, queryParams] = url.split("?");
    const urlParts = baseUrl.split("/");
    const id = urlParts.pop();
    const hostname = urlParts.slice(0, -1).join("/") + "/";
    const typeString =
        type === ModelConfigurationType.ModelConfiguration
            ? "modelconfigurations"
            : "modelconfigurationsetups";
    return hostname + "custom/" + typeString + "/" + id + (queryParams ? `?${queryParams}` : "");
};

/**
 * Fetches a model configuration setup from the catalog based on response variables and model ID
 * @param url - The URL of the model configuration setup
 * @returns Promise resolving to the model configuration setup
 * @throws Error if model is not found or API request fails
 */
export const fetchModelConfigurationSetup = async (
    url: string
): Promise<ModelConfigurationSetup> => {
    // Fetch detailed setup information
    return (await rp.get({
        url: convertToUrlToCustomUrl(url, ModelConfigurationType.ModelConfigurationSetup),
        json: true
    })) as ModelConfigurationSetup;
};

export const fetchModelConfiguration = async (url: string): Promise<ModelConfiguration> => {
    return (await rp.get({
        url: convertToUrlToCustomUrl(url, ModelConfigurationType.ModelConfiguration),
        json: true
    })) as ModelConfiguration;
};

export const convertApiUrlToW3Id = (url: string) => {
    const baseUrl = url.split("?")[0];
    const urlParts = baseUrl.split("/");
    const id = urlParts.pop();
    return W3_ID_URI_PREFIX + id;
};
