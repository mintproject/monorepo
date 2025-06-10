import { Model, MintPreferences, ModelIO, Dataset, ModelParameter, Dataslice } from "./mint-types";
import * as rp from "request-promise-native";
import { ModelConfigurationSetup } from "@mintproject/modelcatalog_client";
import { GraphQL } from "../../config/graphql";
import { KeycloakAdapter } from "../../config/keycloak-adapter";

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
