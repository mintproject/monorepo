import {
    deleteThreadModelExecutionIds,
    getExecutionHash,
    getModelInputBindings,
    getModelInputConfigurations,
    getRegionDetails,
    incrementThreadModelFailedRuns,
    incrementThreadModelSubmittedRuns,
    incrementThreadModelSuccessfulRuns,
    listSuccessfulExecutionIds,
    setExecutions,
    setThreadModelExecutionIds,
    setThreadModelExecutionSummary,
    updateExecutionStatus
} from "../graphql/graphql_functions";
import {
    Execution,
    ExecutionSummary,
    MintPreferences,
    Model,
    ModelIO,
    ModelParameter,
    Region,
    Thread,
    ThreadModelMap
} from "../mint/mint-types";
import { getTapisAppWithoutLogin } from "./apps";
import { queueModelExecutions } from "./submit-execution";
import { TapisComponent } from "./typing";

export const saveAndRunExecutionsTapis = async (
    thread: Thread,
    modelid: string,
    prefs: MintPreferences
) => {
    for (const pmodelid in thread.model_ensembles) {
        if (!modelid || modelid == pmodelid) {
            return await saveAndRunExecutionsModel(pmodelid, thread, prefs);
        }
    }
    console.log("Finished sending all executions for local execution");
    return true;
};

const batchSize = 500; // Store executions in the database in batches
export const saveAndRunExecutionsModel = async (
    modelid: string,
    thread: Thread,
    prefs: MintPreferences
) => {
    if (!thread.execution_summary) thread.execution_summary = {};

    const model = thread.models[modelid];
    const thread_model_id = thread.model_ensembles[modelid].id;
    const thread_region = await getRegionDetails(thread.regionid);
    const execution_details = getModelInputBindings(model, thread, thread_region);
    const threadModel = execution_details[0] as ThreadModelMap;
    const inputIds = execution_details[1] as string[];

    // This is the part that creates all different run configurations
    // - Cross product of all input collections
    // - TODO: Change to allow flexibility
    const configs = getModelInputConfigurations(threadModel, inputIds);

    if (configs !== null)
        await createExecutions(
            configs,
            thread_model_id,
            model,
            prefs,
            inputIds,
            modelid,
            thread,
            thread_region
        );
    return true;
};

async function createExecutions(
    configs: any[][],
    thread_model_id: string,
    model: Model,
    prefs: MintPreferences,
    inputIds: string[],
    modelid: string,
    thread: Thread,
    thread_region: Region
) {
    await createThreadModelExecutionSummary(configs, thread_model_id);
    await deleteThreadModelExecutionIds(thread_model_id);

    const component = await getModelDetails(model);

    // Create executions in batches
    for (let i = 0; i < configs.length; i += batchSize) {
        const bindings = configs.slice(i, i + batchSize);

        // Create executions for this batch
        const executionsBatch: Execution[] = createExecutionsBatch(bindings, inputIds, modelid);
        const executionIdsBatch = executionsBatch.map((e) => e.id);

        // Fetch only successful executions
        const successful_execution_ids: string[] =
            await listSuccessfulExecutionIds(executionIdsBatch);
        // Filter out successful executions
        const executions_to_be_run = executionsBatch.filter(
            (e) => successful_execution_ids.indexOf(e.id) < 0
        );

        // Create Executions and Thread Model Mappings to those executions
        await setExecutions(executions_to_be_run, thread_model_id);
        await setThreadModelExecutionIds(thread_model_id, executionIdsBatch);
        await updateSuccessfulExecutionOnThread(successful_execution_ids, thread_model_id);
        // Increment the number of submitted runs
        await incrementThreadModelSubmittedRuns(thread_model_id, executions_to_be_run.length);
        // Check if the component is valid
        if ((await isValidTapisComponent(component)) === false) {
            await handleInvalidComponent(thread_model_id, executions_to_be_run);
        } else {
            await queueModelExecutions(
                thread,
                modelid,
                component,
                thread_region,
                executions_to_be_run
            );
        }
    }
}

const isValidTapisComponent = async (component: TapisComponent) => {
    try {
        const { result: app } = await getTapisAppWithoutLogin(component.id, component.version);
        if (!app) {
            return false;
        }
    } catch (e) {
        console.error(e);
        return false;
    }
    return true;
};

async function handleInvalidComponent(thread_model_id: string, executions_to_be_run: Execution[]) {
    console.error("Invalid component");
    await incrementThreadModelFailedRuns(thread_model_id, executions_to_be_run.length);
    executions_to_be_run.map((execution) => {
        execution.status = "FAILURE";
        execution.run_progress = 0;
        updateExecutionStatus(execution);
    });
}

async function updateSuccessfulExecutionOnThread(
    successful_execution_ids: string[],
    thread_model_id: string
) {
    const num_already_run = successful_execution_ids.length;
    if (num_already_run > 0) {
        await incrementThreadModelSubmittedRuns(thread_model_id, num_already_run);
        await incrementThreadModelSuccessfulRuns(thread_model_id, num_already_run);
    }
}

async function createThreadModelExecutionSummary(configs: any[][], thread_model_id: string) {
    const summary = {
        total_runs: configs.length,
        submitted_runs: 0,
        failed_runs: 0,
        successful_runs: 0,
        workflow_name: "", // No workflow. Local execution
        submitted_for_execution: true,
        submission_time: new Date()
    } as ExecutionSummary;
    await setThreadModelExecutionSummary(thread_model_id, summary);
}

function createExecutionsBatch(bindings: any[][], inputIds: string[], modelid: string) {
    const executions: Execution[] = [];
    bindings.map((binding) => {
        const inputBindings: any = {};
        for (let j = 0; j < inputIds.length; j++) {
            inputBindings[inputIds[j]] = binding[j];
        }
        const execution = createExecutionMetadata(modelid, inputBindings);
        executions.push(execution);
    });
    return executions;
}

function createExecutionMetadata(modelid: string, inputBindings: any) {
    const execution = {
        modelid: modelid,
        bindings: inputBindings,
        execution_engine: "localex",
        runid: null,
        status: null,
        results: {},
        start_time: new Date(),
        selected: true
    } as Execution;
    execution.id = getExecutionHash(execution);
    return execution;
}

const _getModelIODetails = (io: ModelIO, iotype: string) => {
    if (!io.position) {
        return null;
    }
    const pfx = iotype == "input" ? "-i" : "-o";
    return {
        id: io.id,
        role: io.name,
        prefix: pfx + io.position,
        isParam: false,
        format: io.format,
        type: io.type
    };
};

const _getModelParamDetails = (param: ModelParameter) => {
    return {
        id: param.id,
        role: param.name,
        prefix: "-p" + param.position,
        isParam: true,
        type: param.type
    };
};

const loadComponent = async (component_url: string) => {
    try {
        const response = await fetch(component_url);
        if (response.ok) {
            const data = await response.text();
            const component = JSON.parse(data) as TapisComponent;
            // Check if the component is valid
            if (component.id && component.version) {
                return component;
            } else {
                throw new Error("Invalid component");
            }
        }
    } catch (e) {
        console.log(e);
        throw Error(`Error loading component ${component_url}`);
    }
};

const getModelDetails = async (model: Model) => {
    const comp = await loadComponent(model.code_url);
    comp.inputs = [];
    comp.outputs = [];
    model.input_files.map((input) => {
        const details = _getModelIODetails(input, "input");
        if (!details) throw new Error("Input file missing position: " + input.id);
        comp.inputs.push(details);
    });
    model.input_parameters.map((param) => {
        const details = _getModelParamDetails(param);
        if (!details) throw new Error("Input parameter missing position: " + param.id);
        comp.inputs.push(details);
    });
    model.output_files.map((output) => {
        const details = _getModelIODetails(output, "output");
        if (!details) throw new Error("Output file missing position: " + output.id);
        comp.outputs.push(details);
    });
    return comp;
};
