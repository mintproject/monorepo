import { deleteModelCache } from "../../../classes/mint/mint-local-functions";
import { getModel } from "../../../classes/graphql/graphql_functions";
import { fetchMintConfig } from "../../../classes/mint/mint-functions";
import { KeycloakAdapter } from "../../../config/keycloak-adapter";

// ./api-v1/services/modelCacheService.js

const modelCacheService = {
    async deleteModel(model_id: string) {
        let prefs = await fetchMintConfig();
        KeycloakAdapter.signIn(prefs.graphql.username, prefs.graphql.password)

        let model = await getModel(model_id);
        await deleteModelCache(model, prefs);

        return createResponse("success",
                "Thread " + model_id + " model cache deleted !");
    }
};

const createResponse = (result: string, message: string) => {
    return {
        result: result,
        message: message
    };
}

export default modelCacheService;