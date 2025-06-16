import { Model, MintPreferences, ModelIO, Dataset, ModelParameter, Dataslice } from "./mint-types";
import * as rp from "request-promise-native";
import { ModelConfigurationSetup } from "@mintproject/modelcatalog_client";
import { GraphQL } from "@/config/graphql";
import { KeycloakAdapter } from "@/config/keycloak-adapter";

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

/**
 * Fetches a model configuration setup from the catalog based on response variables and model ID
 * @param url - The URL of the model configuration setup
 * @returns Promise resolving to the model configuration setup
 * @throws Error if model is not found or API request fails
 */
export const fetchModelConfigurationSetup = async (
    url: string
): Promise<ModelConfigurationSetup> => {
    try {
        // Fetch detailed setup information
        const detailedSetup = (await rp.get({
            url: url,
            json: true
        })) as ModelConfigurationSetup;

        return detailedSetup;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        throw new Error(`Failed to fetch model configuration: ${errorMessage}`);
    }
};
