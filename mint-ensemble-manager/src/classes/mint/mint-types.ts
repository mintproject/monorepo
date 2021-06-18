export interface ExecutionsWithStatus {
    loading: boolean,
    executions: Execution[]
}
export type ModelExecutions = Map<string, ExecutionsWithStatus[]>

export interface MintEvent {
    event: string,
    userid: string
    timestamp: Date
    notes: string
}

export interface ProblemStatementEvent extends MintEvent {
    event: "CREATE" | "UPDATE" | "ADD_TASK" | "DELETE_TASK"
}

export interface TaskEvent extends MintEvent {
    event: "CREATE" | "UPDATE" | "ADD_THREAD" | "DELETE_THREAD"
}

export interface ThreadEvent extends MintEvent {
    event: "CREATE" | "UPDATE" | "SELECT_DATA" | "SELECT_MODELS" | "SELECT_PARAMETERS" | "EXECUTE" | "INGEST" | "VISUALIZE"
}

export interface ProblemStatementList {
    problem_statement_ids: string[]
    problem_statements: IdMap<ProblemStatementInfo>
    unsubscribe?: Function
}

export interface ProblemStatementInfo extends IdNameObject {
    regionid: string
    dates: DateRange
    events: ProblemStatementEvent[]
}

export interface DateRange {
    start_date: Date
    end_date: Date
}

export interface ProblemStatement extends ProblemStatementInfo {
    tasks: IdMap<Task>
    changed?: boolean
    unsubscribe?: Function
}

export interface ThreadInfo extends IdNameObject {
    dates?: DateRange
    task_id: string
    driving_variables: string[]
    response_variables: string[]
    regionid?: string
    events?: ThreadEvent[]
}

export interface ThreadList {
    thread_ids: string[]
    threads: IdMap<ThreadInfo>
    unsubscribe?: Function
}

export interface Thread extends ThreadInfo {
    models?: ModelMap
    data?: DataMap
    model_ensembles?: ModelEnsembleMap
    execution_summary: IdMap<ExecutionSummary>
    visualizations?: Visualization[]
    events: ThreadEvent[]
    changed?: boolean
    unsubscribe?: Function
}

export interface Visualization {
    type: string,
    url: string
}

export interface ComparisonFeature {
    name: string,
    fn: Function
}

export type ModelMap = IdMap<Model>

export type DataMap = IdMap<Dataslice>

export interface TaskList {
    task_ids: string[]
    tasks: IdMap<Task>
    unsubscribe?: Function
}

export interface Task extends IdNameObject {
    problem_statement_id: string,
    dates?: DateRange,
    response_variables: string[],
    driving_variables: string[],
    regionid?: string,
    threads?: IdMap<ThreadInfo>
    events: TaskEvent[]
    unsubscribe?: Function
}

// Mapping of model id to data ensembles
export interface ModelEnsembleMap {
    [modelid: string]: ThreadModelMap
}

export interface ThreadModelMap {
    id?: string,
    bindings: ModelIOBindings
}

// Mapping of model input to list of values (data ids or parameter values)
export interface ModelIOBindings {
    [inputid: string]: string[]
}

export interface ExecutionSummary {
    workflow_name: string

    submitted_for_execution: boolean
    submission_time: Date    
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

export interface Execution {
    id?: string
    modelid: string
    bindings: InputBindings
    runid?: string
    start_time: Date
    end_time?: Date
    execution_engine?: "wings" | "localex"
    status: "FAILURE" | "SUCCESS" | "RUNNING" | "WAITING",
    run_progress?: number // 0 to 100 (percentage done)
    results: any[] // Chosen results after completed run
    selected: boolean
}

export interface InputBindings {
    [input: string]: string | DataResource
}

export interface Model extends IdNameObject {
    localname?: string,
    region_name: string,
    description?: string,
    category: string,
    input_files: ModelIO[],
    input_parameters: ModelParameter[],
    output_files: ModelIO[],
    code_url?: string,
    model_type?: string,
    model_name?: string,
    model_version?: string,
    model_configuration?:string,
    parameter_assignment?: string,
    parameter_assignment_details?: string,
    software_image?: string,
    calibration_target_variable?: string,
    modeled_processes?: string[],
    dimensionality?: number|string,
    spatial_grid_type?: string,
    spatial_grid_resolution?: string,
    output_time_interval?: string,
    usage_notes?: string,
    hasRegion?: any
};

const getLastPart = (s:string) => {
    let sp = s.split('/');
    if (sp && sp.length > 0) return sp.pop();
    return '';
}

export const getPathFromModel = (m:Model) => {
    let path = "";
    let model = getLastPart(m.model_name);
    if (model) {
        path += "/" + model;
        let version = getLastPart(m.model_version);
        if (version) {
            path += "/" + version;
            let cfg = getLastPart(m.model_configuration)
            if (cfg) {
                path += "/" + cfg;
                path += "/" + getLastPart(m.id);
            }
        }
    }
    return path;
}

export interface ModelIO extends IdNameObject {
    type?: string,
    variables: string[],
    value?: Dataslice,
    position?: number,
    format: string
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
    position?: number
}

export interface ModelDetail extends Model {
    documentation: string,
    lookupTable: string,
    image: string
}

export type VariableModels = Map<string, Model[]> 

export type RegionMap = IdMap<Region>;

export interface Region extends IdNameObject {
    bounding_box?: BoundingBox,
    model_catalog_uri?: string,
    category_id: string,
    geometries: any[]
}

export interface RegionCategory extends IdNameObject {
    citation?: string,
    subcategories?: RegionCategory[]
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

export interface IdMap<T> {
    [id: string]: T
  }
  
  export interface IdNameObject {
    id?: string
    name?: string
  }
  
  export interface UserPreferences {
    mint: MintPreferences,
    modelCatalog: ModelCatalogPreferences,
    profile?: UserProfile
  }
  
  export interface MintPreferences {
    wings: WingsPreferences,
    localex?: LocalExecutionPreferences,
    execution_engine?: "wings" | "localex",
    wings_api: string,
    ensemble_manager_api: string,
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
    codedir: string
  }
  
  type ModelCatalogStatus = 'LOADING' | 'DONE' | 'ERROR';
  export interface ModelCatalogPreferences {
    username: string,
    accessToken: string,
    status: ModelCatalogStatus
  }
  
  export type UserProfile = {
      mainRegion: string,
      graph: string,
  }

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
    is_cached?: boolean,
    resource_repr?: any,
    dataset_repr?: any,
    resources: DataResource[],
    resources_loaded?: boolean,
    resource_count?: number,
    spatial_coverage?: any,
};

export interface Dataslice extends IdNameObject {
    dataset: Dataset,
    resources: DataResource[],
    resources_loaded?: boolean,
    time_period: DateRange,
    spatial_coverage?: any
}

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