import { MintPreferences } from "./mint-types";
import * as rp from "request-promise-native";
import {
    ModelConfiguration,
    ModelConfigurationSetup,
    DatasetSpecification
} from "@mintproject/modelcatalog_client";
import { KeycloakAdapter } from "@/config/keycloak-adapter";
import { getConfiguration } from "./mint-functions";

const W3_ID_URI_PREFIX = "https://w3id.org/okn/i/mint/";

export interface CustomModelConfigurationSetup extends ModelConfigurationSetup {
    hasInput: DatasetSpecification[];
}

export interface CustomModelConfiguration extends ModelConfiguration {
    hasInput: DatasetSpecification[];
}

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
): Promise<CustomModelConfigurationSetup> => {
    // Fetch detailed setup information
    return (await rp.get({
        url: convertToUrlToCustomUrl(url, ModelConfigurationType.ModelConfigurationSetup),
        json: true
    })) as CustomModelConfigurationSetup;
};

export const fetchModelConfiguration = async (url: string): Promise<CustomModelConfiguration> => {
    return (await rp.get({
        url: convertToUrlToCustomUrl(url, ModelConfigurationType.ModelConfiguration),
        json: true
    })) as CustomModelConfiguration;
};

export const fetchCustomModelConfigurationSetup = async (
    url: string
): Promise<CustomModelConfigurationSetup> => {
    return (await rp.get({
        url: url,
        json: true
    })) as CustomModelConfigurationSetup;
};

export const fetchCustomModelConfiguration = async (
    url: string
): Promise<CustomModelConfiguration> => {
    return (await rp.get({
        url: url,
        json: true
    })) as CustomModelConfiguration;
};

export const fetchCustomModelConfigurationOrSetup = async (
    url: string
): Promise<CustomModelConfiguration | CustomModelConfigurationSetup> => {
    try {
        const customUrl = convertToUrlToCustomUrl(url, ModelConfigurationType.ModelConfiguration);
        return await fetchCustomModelConfiguration(customUrl);
    } catch (error) {
        const customUrl = convertToUrlToCustomUrl(
            url,
            ModelConfigurationType.ModelConfigurationSetup
        );
        return await fetchCustomModelConfigurationSetup(customUrl);
    }
};

export const convertApiUrlToW3Id = (url: string) => {
    const baseUrl = url.split("?")[0];
    const urlParts = baseUrl.split("/");
    const id = urlParts.pop();
    return W3_ID_URI_PREFIX + id;
};

export enum ModelCatalogType {
    ModelConfiguration = "modelconfiguration",
    ModelConfigurationSetup = "modelconfigurationsetup"
}

//TODO: This is a temporary function to convert a W3 ID to an API URL.
export const convertModelConfigurationW3IdToApiUrl = async (w3Id: string) => {
    const config = getConfiguration();
    const modelCatalogApi = config.model_catalog_api;
    const modelConfigurationUrl =
        modelCatalogApi +
        "/" +
        ModelCatalogType.ModelConfiguration +
        "s/" +
        w3Id.replace(W3_ID_URI_PREFIX, "") +
        "?username=" +
        "mint@isi.edu";
    const modelConfigurationSetupUrl =
        modelCatalogApi +
        "/" +
        ModelCatalogType.ModelConfigurationSetup +
        "s/" +
        w3Id.replace(W3_ID_URI_PREFIX, "") +
        "?username=" +
        "mint@isi.edu";
    try {
        const modelConfiguration = await await rp.get({
            url: modelConfigurationUrl,
            json: true
        });
        if (modelConfiguration) {
            return modelConfigurationUrl;
        }
    } catch (error) {
        try {
            const modelConfigurationSetup = await await rp.get({
                url: modelConfigurationSetupUrl,
                json: true
            });
            if (modelConfigurationSetup) {
                return modelConfigurationSetupUrl;
            }
        } catch (error) {
            throw new Error("Model not found");
        }
    }
};
