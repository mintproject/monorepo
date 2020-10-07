import { Timestamp } from "@google-cloud/firestore"

export interface IdMap<T> {
    [id: string]: T
}
  
export interface IdNameObject {
    id?: string
    name?: string
}

export interface Wcm {
    wings: any ;
}

export interface WingsWcm {
    inputs: ModelIO[],
    outputs: ModelIO[],

}



export interface MintPreferences {
    wings: WingsPreferences,
    localex?: LocalExecutionPreferences,
    execution_engine?: "wings" | "localex",
    ensemble_manager_api: string,
    wings_api: string,
    ingestion_api: string,
    visualization_url: string,
    data_catalog_api: string,
    model_catalog_api: string
  }
  
  export interface WingsPreferences {
    server: string,
    domain: string,
    username: string,
    password: string,
    datadir: string,
    dataurl: string
    // The following is retrieved from wings itself
    export_url?: string,
    storage?: string,
    dotpath?: string,
    onturl?: string,
  }

export interface LocalExecutionPreferences {
    datadir: string,
    dataurl: string,
    logdir: string,
    logurl: string,
    codedir: string,
    parallelism: number
}

export interface ModelingState {
    scenarios?: ScenarioList
    scenario?: ScenarioDetails
    pathway?: Pathway
    ensembles?: ModelEnsembles
}

export interface EnsemblesWithStatus {
    loading: boolean,
    ensembles: ExecutableEnsemble[]
}
export type ModelEnsembles = Map<string, EnsemblesWithStatus[]>

export interface ScenarioList {
    scenarioids: string[]
    scenarios: IdMap<Scenario>
}

export interface Scenario extends IdNameObject {
    regionid: string
    subregionid?: string
    dates: DateRange
    last_update?: string
    last_update_user?: string
}

export interface DateRange {
    start_date: Timestamp
    end_date: Timestamp
}

export interface ScenarioDetails extends Scenario {
    goals: IdMap<Goal>
    subgoals: IdMap<SubGoal>
    unsubscribe?: Function
}


export interface PathwayInfo extends IdNameObject {
    dates?: DateRange
}

export interface Pathway extends PathwayInfo {
    driving_variables: string[]
    response_variables: string[]
    models?: ModelMap
    datasets?: DatasetMap
    model_ensembles?: ModelEnsembleMap
    executable_ensemble_summary: IdMap<ExecutableEnsembleSummary>
    notes?: Notes
    last_update?: PathwayUpdateInformation
    visualizations?: Visualization[]
    unsubscribe?: Function
}

export interface Visualization {
    type: string,
    url: string
}

export interface Notes {
    variables: string,
    models: string,
    datasets: string,
    parameters: string,
    visualization: string,
    results: string
}

export interface PathwayUpdateInformation {
    variables: StepUpdateInformation
    models: StepUpdateInformation
    datasets: StepUpdateInformation
    parameters: StepUpdateInformation
    results: StepUpdateInformation
}

export interface StepUpdateInformation {
    time: number
    user: string
}

export interface ComparisonFeature {
    name: string,
    fn: Function
}

export type ModelMap = IdMap<Model>

export type DatasetMap = IdMap<Dataset>

export interface Goal extends IdNameObject {
    subgoalids?: string[]
}

export interface SubGoal extends IdNameObject {
    dates?: DateRange,
    response_variables: string[],
    driving_variables: string[],
    subregionid?: string
    pathways?: IdMap<PathwayInfo>
}

// Mapping of model id to data ensembles
export interface ModelEnsembleMap {
    [modelid: string]: DataEnsembleMap
}

// Mapping of model input to list of values (data ids or parameter values)
export interface DataEnsembleMap {
    [inputid: string]: string[]
}

export interface ExecutableEnsembleSummary {
    workflow_name: string

    submitted_for_execution: boolean
    submission_time: number    
    total_runs: number
    submitted_runs: number
    successful_runs: number
    failed_runs: number


    submitted_for_ingestion: boolean
    fetched_run_outputs: number // Run data fetched for ingestion
    ingested_runs: number // Run data ingested in the Visualization database

    submitted_for_registration: boolean
    registered_runs: number // Registered in the data catalog

    submitted_for_publishing: boolean
    published_runs: number // Published in the provenance catalog
}

export interface ExecutableEnsemble {
    id: string
    modelid: string
    bindings: InputBindings
    runid?: string
    submission_time: number
    execution_engine?: "wings" | "localex"
    status: "FAILURE" | "SUCCESS" | "RUNNING" | "WAITING"
    run_progress?: number // 0 to 100 (percentage done)
    results: any[] // Chosen results after completed run
    selected: boolean
}

export interface InputBindings {
    [input: string]: string | DataResource
}

export interface Model extends IdNameObject {
    localname?: string,
    calibrated_region: string,
    description?: string,
    category: string,
    input_files: ModelIO[],
    input_parameters: ModelParameter[],
    output_files: ModelIO[],
    wcm_uri?: string,
    model_type?: string,
    original_model?: string,
    model_version?: string,
    model_configuration?:string,
    parameter_assignment?: string,
    parameter_assignment_details?: string,
    target_variable_for_parameter_assignment?: string,
    modeled_processes?: string[],
    dimensionality?: number,
    software_image?: string,
    spatial_grid_type?: string,
    spatial_grid_resolution?: string,
    minimum_output_time_interval?: string,
    usage_notes?: string
};

export interface ModelIO extends IdNameObject {
    type?: string,
    variables: string[],
    value?: Dataset,
    position?: number
}

export interface ModelParameter extends IdNameObject {
    type: string,
    description?: string,
    min?: string,
    max?: string,
    unit?: string,
    default?: string,
    value?: string,
    adjustment_variable?: string,
    accepted_values?: string[],
    position: number
}

export interface ModelDetail extends Model {
    documentation: string,
    lookupTable: string,
    image: string
}

export interface ModelsState {
    models: VariableModels,
    model: ModelDetail | null,
    loading: boolean
}

export type VariableModels = Map<string, Model[]> // Map of response variable to models

export interface Dataset extends IdNameObject {
    region: string,
    variables: string[],
    datatype: string,
    time_period: DateRange,
    description: string,
    version: string,
    limitations: string,
    source: Source,
    categories?: string[],
    resources: DataResource[]
};

export interface DataResource extends IdNameObject {
    url: string
    time_period?: DateRange,
    spatial_coverage?: any
    selected? : boolean
}

export interface DatasetDetail extends Dataset {
    documentation: string,
    image: string
}

export interface Source {
    name: string,
    url: string,
    type: string
}

export interface DatasetQueryParameters {
    spatialCoverage?: BoundingBox,
    dateRange?: DateRange,
    name?: string,
    variables?: string[]
}

export interface DatasetsState {
    model_datasets?: ModelDatasets
    query_datasets?: DatasetsWithStatus
    region_datasets?: DatasetsWithStatus
    dataset?: DatasetWithStatus
}
export interface DatasetsWithStatus {
    loading: boolean,
    datasets: Dataset[]
}
export interface DatasetWithStatus {
    loading: boolean,
    dataset: Dataset
}
export type ModelInputDatasets = Map<string, DatasetsWithStatus[]>
export type ModelDatasets = Map<string, ModelInputDatasets>

export type RegionMap = IdMap<Region>;

export interface Region extends IdNameObject {
    geojson_blob?: string, // This contains the whole geojson itself
    region_type?: string,
    bounding_box?: BoundingBox
}

export interface RegionsState {
    regions?: RegionMap,
    top_region_ids?: string[],
    sub_region_ids?: IdMap<string[]>
}

export interface BoundingBox {
    xmin: number
    xmax: number
    ymin: number
    ymax: number
}

export interface Point {
    x: number,
    y: number
}