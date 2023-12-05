import { deleteModelCache } from "../../../classes/mint/mint-local-functions";
import { getModel } from "../../../classes/graphql/graphql_functions";
import { fetchMintConfig } from "../../../classes/mint/mint-functions";
import { KeycloakAdapter } from "../../../config/keycloak-adapter";
import { createResponse } from "./util";

// ./api-v1/services/modelCacheService.js

const modelCacheService = {
    async deleteModel(model_id: string) {
        try {
            let prefs = await fetchMintConfig();
            KeycloakAdapter.signIn(prefs.graphql.username, prefs.graphql.password)

            let model = await getModel(model_id);
            if (model) {
                deleteModelCache(model, prefs);

                return createResponse("success",
                        "Model " + model_id + " model cache deleted !");
            }
            else {
                return createResponse("failure", "Model " + model_id + " not found !");
            }
        }
        catch (error) {
            console.log(error);
            return createResponse("failure", error);
        }
    }
};

export default modelCacheService;