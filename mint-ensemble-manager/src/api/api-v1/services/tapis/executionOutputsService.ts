import { TapisExecutionService } from "@/classes/tapis/adapters/TapisExecutionService";
import { getConfiguration } from "@/classes/mint/mint-functions";
import { Execution_Result, Thread } from "@/classes/mint/mint-types";
import { TACC_CKAN_DataCatalog } from "@/classes/mint/data-catalog/TACC_CKAN_Datacatalog";

export interface ExecutionOutputsService {
    isPublic: (subtask: Thread) => boolean;
    registerOutputs(
        executionId: string,
        access_token: string,
        subtask: Thread,
        origin?: string,
        datasetId?: string
    ): Promise<Execution_Result[]>;
    createDataset(
        executionId: string,
        subtask: Thread,
        ckan: TACC_CKAN_DataCatalog
    ): Promise<string>;
}

const executionOutputsService: ExecutionOutputsService = {
    createDataset: async (
        executionId: string,
        subtask: Thread,
        ckan: TACC_CKAN_DataCatalog
    ): Promise<string> => {
        const prefs = getConfiguration();
        return await ckan.registerDataset(
            {
                name: subtask.id,
                description: "Outputs for " + subtask.id,
                region: subtask.regionid,
                datatype: "file",
                time_period: subtask.dates,
                version: "1.0.0",
                limitations: "None",
                source: {
                    name: "Tapis",
                    url: "https://tapis.org",
                    type: "file"
                },
                resources: []
            },
            prefs.data_catalog_extra.owner_organization_id
        );
    },
    isPublic: (subtask: Thread): boolean => {
        try {
            const publicPermission = subtask.permissions.find((p) => p.userid === "*");
            return publicPermission?.read || publicPermission?.write || publicPermission?.execute;
        } catch (error) {
            return false;
        }
    },

    async registerOutputs(
        executionId: string,
        access_token: string,
        subtask: Thread,
        origin?: string,
        datasetId?: string
    ): Promise<Execution_Result[]> {
        const isPublic = this.isPublic(subtask);
        const prefs = getConfiguration();
        const tapisExecution = new TapisExecutionService(access_token, prefs.tapis.basePath);
        if (!datasetId) {
            datasetId = prefs.data_catalog_extra.default_dataset_id;
            console.log("No dataset ID provided, using default dataset ID", datasetId);
        }
        console.log("Registering outputs for execution", executionId, "with dataset", datasetId);
        return await tapisExecution.registerExecutionOutputs(executionId, isPublic, datasetId);
    }
};

export default executionOutputsService;
