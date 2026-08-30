import { DataResource, Dataset } from "../mint-types";

export interface IdUrl {
    id: string;
    url: string;
}

export interface IDataCatalog {
    /**
     * Register a dataset in the catalog
     */
    registerDataset(dataset: Dataset, owner_org?: string): Promise<string>;

    /**
     * Get a specific dataset by ID with detailed information
     */
    getDataset(datasetId: string): Promise<Dataset>;

    /**
     * Register resources for a dataset
     */
    registerResources?(datasetId: string, resources: DataResource[]): Promise<IdUrl[]>;

    /**
     * Sync dataset metadata
     */
    syncMetadata?(datasetId: string): Promise<void>;

    /**
     * Get catalog type identifier
     */
    getCatalogType(): string;

    /** Delete a dataset from the catalog */
    deleteDataset(datasetId: string): Promise<void>;

    /**
     * Test connection to the catalog
     */
    testConnection?(): Promise<boolean>;
}
