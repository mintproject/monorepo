import { Thread, Model, ThreadModelMap, ProblemStatement, MintPreferences, ExecutionSummary, Execution } from "./mint-types";
import { getModelInputConfigurations, deleteAllThreadExecutionIds, setThreadExecutionIds, getExecutionHash, successfulExecutionIds, getAllThreadExecutionIds, listExecutions, updateThreadExecutions, setThreadExecutions, deleteThreadExecutions, updateThreadExecutionSummary, getModelInputBindings } from "../graphql/graphql_functions";
import { runModelExecutionsLocally, loadModelWCM, getModelCacheDirectory } from "../localex/local-execution-functions";

import fs from "fs-extra";

import Queue from "bull";
import {MONITOR_QUEUE_NAME, REDIS_URL } from "../../config/redis";
import { monitorThread } from "../localex/thread-execution-monitor";
import { DEVMODE } from "../../config/app";

let monitorQueue = new Queue(MONITOR_QUEUE_NAME, REDIS_URL);
monitorQueue.process((job) => monitorThread(job));

export const saveAndRunExecutionsLocally = async(
        thread: Thread, 
        modelid: string,
        prefs: MintPreferences) => {

    for(let pmodelid in thread.model_ensembles) {
        if(!modelid || (modelid == pmodelid)) {
            await saveAndRunExecutionsForModelLocally(pmodelid, thread, prefs);
            if(!DEVMODE) {
                monitorQueue.add({ thread_id: thread.id, model_id: modelid } , {
                    delay: 1000*30 // 30 seconds delay before monitoring for the first time
                });
            }
        }
    }
    console.log("Finished sending all executions for local execution. Adding Monitor");
}

export const saveAndRunExecutionsForModelLocally = async(modelid: string, 
        thread: Thread, 
        prefs: MintPreferences) => {
    if(!thread.execution_summary)
        thread.execution_summary = {};
    
    let model = thread.models[modelid];
    
    let execution_details = getModelInputBindings(model, thread);
    let threadModel = execution_details[0] as ThreadModelMap;
    let inputIds = execution_details[1] as string[];

    // This is the part that creates all different run configurations
    // - Cross product of all input collections
    // - TODO: Change to allow flexibility
    let configs = getModelInputConfigurations(threadModel, inputIds);
    
    if(configs != null) {
        /*
            Pre-Run Setup
        */

        // Setup some book-keeping to help in searching for results
        let summary = {
            total_runs: configs.length,
            submitted_runs : 0,
            failed_runs: 0,
            successful_runs: 0,
            workflow_name: "", // No workflow. Local execution
            submitted_for_execution: true,
            submission_time: Date.now() - 20000 // Less 20 seconds to counter for clock skews
        } as ExecutionSummary

        if(!DEVMODE)
            await updateThreadExecutionSummary(thread.id, modelid, summary);
        
        // Load the component model
        let component = await loadModelWCM(model.code_url, model, prefs);

        // Delete existing thread execution ids (*NOT DELETING GLOBAL ENSEMBLE DOCUMENTS .. Only clearing list of the thread's execution ids)
        if(!DEVMODE)
            await deleteAllThreadExecutionIds(thread.id, modelid);

        // Work in batches
        let batchSize = 500; // Deal with executions from firebase in this batch size
        let batchid = 0;

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
                    submission_time: Date.now(),
                    selected: true
                } as Execution;
                execution.id = getExecutionHash(execution);

                executionids.push(execution.id);
                executions.push(execution);
            })

            if(!DEVMODE)
                setThreadExecutionIds(thread.id, model.id, executionids);

            // Check if any current executions already exist 
            // - Note: execution ids are uniquely defined by the model id and inputs
            let all_executions : Execution[] = DEVMODE ? [] : await listExecutions(executionids);
            let successful_execution_ids = all_executions
                .filter((e) => (e != null && e.status == "SUCCESS"))
                .map((e) => e.id);

            let executions_to_be_run = executions.filter((e) => successful_execution_ids.indexOf(e.id) < 0);

            // Clear out the thread executions to be empty
            if(!DEVMODE)
                await setThreadExecutions(executions_to_be_run);

            summary.submitted_runs += executions.length;
            summary.successful_runs += successful_execution_ids.length;
            if(!DEVMODE)
                updateThreadExecutionSummary(thread.id, modelid, summary);

            // Run the model executions
            runModelExecutionsLocally(thread, component, executions_to_be_run, prefs);
            
            batchid ++;
            
        }
    }
    console.log("Finished submitting all executions for model: " + modelid);
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

export const deleteExecutableCacheForModelLocally = async(modelid: string, 
    thread: Thread, 
    prefs: MintPreferences) => {

    let model = thread.models[modelid];
    let all_execution_ids = await getAllThreadExecutionIds(thread.id, modelid);

    // Delete existing thread execution ids (*NOT DELETING GLOBAL ENSEMBLE DOCUMENTS .. Only clearing list of the thread's execution ids)
    deleteAllThreadExecutionIds(thread.id, modelid);

    // Work in batches
    let batchSize = 500; // Deal with executions from firebase in this batch size

    // Process executions in batches
    for(let i=0; i<all_execution_ids.length; i+= batchSize) {
        let executionids = all_execution_ids.slice(i, i+batchSize);
           
        // Delete the actual execution documents
        deleteThreadExecutions(executionids);
    }

    // Delete cached model directory and zip file
    let modeldir = getModelCacheDirectory(model.code_url, prefs);
    if(modeldir != null) {
        fs.remove(modeldir);
        fs.remove(modeldir + ".zip");
    }

    deleteModelInputCacheLocally(thread, modelid, prefs);
    
    // Remove all executable information and update the thread
    let summary = thread.execution_summary[modelid];
    summary.successful_runs = 0;
    summary.failed_runs = 0;
    summary.submitted_runs = 0;
    summary.submission_time = 0;
    summary.submitted_for_execution = false;

    await updateThreadExecutionSummary(thread.id, modelid, summary);
}
