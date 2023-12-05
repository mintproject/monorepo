import { Thread, Model, ThreadModelMap, ProblemStatement, MintPreferences, ExecutionSummary, Execution, Dataset } from "./mint-types";
import { getModelInputConfigurations, deleteThreadModelExecutionIds, setThreadModelExecutionIds, 
    getExecutionHash, getThreadModelExecutionIds, getExecutions, 
    setExecutions, deleteExecutions, 
    setThreadModelExecutionSummary, getModelInputBindings, listSuccessfulExecutionIds, incrementThreadModelSubmittedRuns, incrementThreadModelSuccessfulRuns, getRegionDetails, deleteModel, updateExecutionStatus, incrementThreadModelRegisteredRuns } from "../graphql/graphql_functions";
import { loadModelWCM, getModelCacheDirectory, queueModelExecutionsLocally } from "../localex/local-execution-functions";

import fs from "fs-extra";

import { DEVMODE } from "../../config/app";
import { registerDataset } from "./data-catalog-functions";

export const saveAndRunExecutionsLocally = async (
        thread: Thread, 
        modelid: string,
        prefs: MintPreferences) => {

    let ok = false;
    for(let pmodelid in thread.model_ensembles) {
        if(!modelid || (modelid == pmodelid)) {
            ok = await saveAndRunExecutionsForModelLocally(pmodelid, thread, prefs);
            if (!ok) {
                return false;
            }
            /*
            if(!DEVMODE) {
                monitorQueue.add({ thread_id: thread.id, model_id: modelid } , {
                    delay: 1000*30 // 30 seconds delay before monitoring for the first time
                });
            }
            */
        }
    }
    if (ok) {
        console.log("Finished sending all executions for local execution");
        return true;
    }
    else {
        return false;
    }
}

export const saveAndRunExecutionsForModelLocally = async(modelid: string, 
        thread: Thread, 
        prefs: MintPreferences) => {

    try {
        if(!thread.execution_summary)
            thread.execution_summary = {};
        
        let model = thread.models[modelid];
        let thread_model_id = thread.model_ensembles[modelid].id;
        
        let thread_region = await getRegionDetails(thread.regionid)
        let execution_details = getModelInputBindings(model, thread, thread_region);

        let threadModel = execution_details[0] as ThreadModelMap;
        let inputIds = execution_details[1] as string[];

        // This is the part that creates all different run configurations
        // - Cross product of all input collections
        // - TODO: Change to allow flexibility
        let configs = getModelInputConfigurations(threadModel, inputIds);

        let datadir = prefs.localex.datadir;

        if(!fs.existsSync(datadir))
            fs.mkdirsSync(datadir);

        if(configs != null) {
            // Pre-Run Setup
            // Reset execution summary
            let summary = {
                total_runs: configs.length,
                submitted_runs : 0,
                failed_runs: 0,
                successful_runs: 0,
                workflow_name: "", // No workflow. Local execution
                submitted_for_execution: true,
                submission_time: new Date()
            } as ExecutionSummary

            if(!DEVMODE)
                await setThreadModelExecutionSummary(thread_model_id, summary);
            
            // Load the component model
            let component = await loadModelWCM(model.code_url, model, prefs);

            // Delete existing thread execution ids
            if(!DEVMODE)
                await deleteThreadModelExecutionIds(thread_model_id);
            
            // Work in batches
            let batchSize = 500; // Store executions in the database in batches

            // Create executions in batches
            for(let i=0; i<configs.length; i+= batchSize) {
                let bindings = configs.slice(i, i+batchSize);

                let executions : Execution[] = [];
                let executionids : string[] = [];

                // Create executions for this batch
                bindings.map((binding) => {
                    let inputBindings : any = {};
                    for(let j=0; j<inputIds.length; j++) {
                        inputBindings[inputIds[j]] = binding[j];
                    }
                    //console.log(inputBindings);
                    let execution = {
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

                    executionids.push(execution.id);
                    executions.push(execution);
                })

                // Fetch only successful executions
                let successful_execution_ids : string[] = DEVMODE ? [] : await listSuccessfulExecutionIds(executionids);
                let executions_to_be_run = executions.filter((e) => successful_execution_ids.indexOf(e.id) < 0);

                // Create Executions and Thread Model Mappings to those executions
                if(!DEVMODE) {
                    await setExecutions(executions_to_be_run, thread_model_id);
                    await setThreadModelExecutionIds(thread_model_id, executionids);
                    
                    let num_already_run = successful_execution_ids.length;
                    if(num_already_run > 0) {
                        await incrementThreadModelSubmittedRuns(thread_model_id, num_already_run);
                        await incrementThreadModelSuccessfulRuns(thread_model_id, num_already_run);
                    }
                }

                // Queue the model executions
                queueModelExecutionsLocally(thread, modelid, component, thread_region, executions_to_be_run, prefs);
            }
        }
        console.log("Finished submitting all executions for model: " + modelid);
        return true;
    }
    catch(e) {
        console.log(e);
    }
    return false;
}

export const deleteExecutableCacheLocally = async(
    thread: Thread, 
    modelid: string,
    prefs: MintPreferences) => {

    for(let pmodelid in thread.model_ensembles) {
        if(!modelid || (modelid == pmodelid))
            await deleteExecutableCacheForModelLocally(pmodelid, thread, prefs);
    }
    console.log("Finished deleting all execution cache for local execution");

    //monitorAllEnsembles(thread, problem_statement, prefs);
}

export const deleteModelInputCacheLocally = (
    thread: Thread,
    modelid: string,
    prefs: MintPreferences) => {

    // Delete the selected datasets
    for(let dsid in thread.data) {
        let ds = thread.data[dsid];
        ds.resources.map((res) => {
            let file = prefs.localex.datadir + "/" + res.name;
            if(fs.existsSync(file)) {
                fs.remove(file)
            }
        })
    }

    // Also delete any model setup hardcoded input datasets
    let model = thread.models[modelid];
    model.input_files.map((io) => {
        if(io.value) {
            // There is a hardcoded value in the model itself
            let resources = io.value.resources;
            if(resources.length > 0) {
                let type = io.type.replace(/^.*#/, '');
                resources.map((res) => {
                    if(res.url) {
                        let filename =  res.url.replace(/^.*(#|\/)/, '');
                        filename = filename.replace(/^([0-9])/, '_$1');
                        let file = prefs.localex.datadir + "/" + filename;
                        if(fs.existsSync(file)) {
                            fs.remove(file)
                        }
                    }
                })
            }
        }
    });

}

export const deleteModelCache = (
    model: Model,
    prefs: MintPreferences) => {
        // Delete cached model directory and zip file
        let modeldir = getModelCacheDirectory(model.code_url, prefs);
        if(modeldir != null) {
            console.log("Deleting model directory: " + modeldir)
            fs.remove(modeldir);
            fs.remove(modeldir + ".zip");
        }

        deleteModel(model.id);
        
}

export const deleteExecutableCacheForModelLocally = async(modelid: string, 
    thread: Thread, 
    prefs: MintPreferences) => {

    let model = thread.models[modelid];
    let thread_model_id = thread.model_ensembles[modelid].id;

    let all_execution_ids = await getThreadModelExecutionIds(thread_model_id);

    // Delete existing thread execution ids (*NOT* deleting global execution records  .. Only clearing list of the thread's execution id mappings)
    deleteThreadModelExecutionIds(thread_model_id);

    // Work in batches
    let batchSize = 500; 

    // Process executions in batches
    for(let i=0; i<all_execution_ids.length; i+= batchSize) {
        let executionids = all_execution_ids.slice(i, i+batchSize);
        console.log("Deleting executions: " + executionids.length)
           
        // Delete the actual execution documents
        deleteExecutions(executionids);
    }

    // Delete cached model directory and zip file
    let modeldir = getModelCacheDirectory(model.code_url, prefs);
    if(modeldir != null) {
        console.log("Deleting model directory: " + modeldir)
        fs.remove(modeldir);
        fs.remove(modeldir + ".zip");
    }

    deleteModelInputCacheLocally(thread, modelid, prefs);
    
    // Remove all executable information and update the thread
    let summary = thread.execution_summary[modelid];
    summary.successful_runs = 0;
    summary.failed_runs = 0;
    summary.submitted_runs = 0;
    summary.submission_time = null;
    summary.submitted_for_execution = false;

    await setThreadModelExecutionSummary(thread_model_id, summary);
}


export const registerExecutionResults = async (
    thread: Thread, 
    modelid: string,
    prefs: MintPreferences) => {

    let ok = false;
    for(let pmodelid in thread.model_ensembles) {
        if(!modelid || (modelid == pmodelid)) {
            ok = await registerModelExecutionResults(pmodelid, thread, prefs);
            if (!ok) {
                return false;
            }
        }
    }
    if (ok) {
        console.log("Finished registering all execution outputs");
        return true;
    }
    else {
        return false;
    }
}

export const registerModelExecutionResults = async(modelid: string, 
    thread: Thread, 
    prefs: MintPreferences) => {

    try {
        if(!thread.execution_summary)
            thread.execution_summary = {};
        
        let model = thread.models[modelid];
        let thread_model_id = thread.model_ensembles[modelid].id;
        
        await setThreadModelExecutionSummary(thread_model_id, {
            submitted_for_ingestion: true,
            submitted_for_publishing: true,
            submitted_for_registration: true
        } as ExecutionSummary);

        let all_execution_ids = await getThreadModelExecutionIds(thread_model_id);

        // Work in batches
        let batchSize = 500; 

        // Process executions in batches
        for(let i=0; i<all_execution_ids.length; i+= batchSize) {
            let executionids = all_execution_ids.slice(i, i+batchSize);
            console.log("Registering outputs for executions: " + executionids.length)
            //console.log(executionids);
            
            // Register the execution outputs
            await registerExecutionOutputsInCatalog(executionids, model, prefs);
            await incrementThreadModelRegisteredRuns(thread_model_id, executionids.length);
        }
    }
    catch(e) {
        console.log(e);
    }
    return false;
}


export const registerExecutionOutputsInCatalog = async(
    executionids: string[],
    model: Model,
    prefs: MintPreferences) => {
        
    let executions = await getExecutions(executionids);

    executions.map(async (execution) => {
        // Only register outputs of successful executions
        if(execution.status == "SUCCESS") {
            // Copy any input's spatial/temporal input (if any)
            let spatial = null;
            let temporal = null;
            for(let inputid in execution.bindings) {
                let input = execution.bindings[inputid];
                if(input["spatial_coverage"]) {
                    spatial = JSON.stringify(input["spatial_coverage"])
                }
                if(input["start_date"] && input["end_date"]) {
                    temporal = input["start_date"] + " to " + input["end_date"];
                }
            }

            let promises = [];

            // Register outputs in the data catalog
            model.output_files.map((outf) => {
                if (execution.results[outf.id]) {
                    // Register output with the appropriate variable and spatio-temporal information from input (if transferred) 
                    let output = execution.results[outf.id];
                    let ds = {
                        name: `${outf.name}-${execution.id}`,
                        variables: outf.variables,
                        datatype: output.type,
                        time_period: null, // Fixme
                        is_cached: false,
                        resource_repr: null,
                        dataset_repr: null,
                        resources: [{
                            name: `${output.name}-${execution.id}`,
                            url: output.url
                        }],
                        resource_count: 1,
                        spatial_coverage: spatial,
                    } as Dataset

                    promises.push(registerDataset(ds, prefs));
                }
            });

            let values = await Promise.all(promises);
            if (values.length == model.output_files.length) {
                console.log("Finished registering outputs for execution: " + execution.id);
            }
        }
    });
}