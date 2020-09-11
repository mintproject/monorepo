import { Thread, MintPreferences, Execution, ExecutionSummary } from "../mint/mint-types";
import { getAllThreadExecutionIds, listExecutions, updateThreadExecutionSummary, getThread } from "../graphql/graphql_functions";

import Queue from "bull";
import {MONITOR_QUEUE_NAME, REDIS_URL } from "../../config/redis";
let monitorQueue = new Queue(MONITOR_QUEUE_NAME, REDIS_URL);
monitorQueue.process((job) => monitorThread(job));

export const monitorThread = async function (job: any) {
    var thread_id: string = job.data.thread_id;
    var model_id: string = job.data.model_id;

    // Monitor the thread execution
    let thread: Thread = await getThread(thread_id); //.then((thread: Thread) => {
    if(thread) {
        await _monitorEnsembles(model_id, thread);
    }
}

const _monitorEnsembles = async(modelid: string, thread: Thread) => {
    let summary = thread.execution_summary[modelid];
    if(!summary)
        summary = {} as ExecutionSummary;
    
    // Work in batches
    let batchSize = 500; // Deal with ensembles from firebase in this batch size
    
    let all_ensemble_ids = await getAllThreadExecutionIds(thread.id, modelid);
    
    summary.successful_runs = 0;
    summary.failed_runs = 0;
    summary.submitted_runs = all_ensemble_ids.length;

    // Process ensembles in batches
    for(let i=0; i<all_ensemble_ids.length; i+= batchSize) {
        let ensembleids = all_ensemble_ids.slice(i, i+batchSize);

        // Check Status of all ensembles
        let all_ensembles : Execution[] = await listExecutions(ensembleids);
        let successful_ensemble_ids = all_ensembles
            .filter((e) => (e != null && e.status == "SUCCESS"))
            .map((e) => e.id);
        let failed_ensemble_ids = all_ensembles
            .filter((e) => (e != null && e.status == "FAILURE"))
            .map((e) => e.id);
        
        summary.successful_runs += successful_ensemble_ids.length;
        summary.failed_runs += failed_ensemble_ids.length;
    }
    await updateThreadExecutionSummary(thread.id, modelid, summary);

    if(summary.submitted_runs > (summary.failed_runs + summary.successful_runs)) {
        // If the failed + successful runs != submitted, i.e. there are still some runs waiting to run, keep monitoring
        monitorQueue.add({ thread_id: thread.id, model_id: modelid } , {
            //delay: 1000*30 // DEV: 30 second delay before monitoring again
            delay: 1000*60*3 // 3 minute delay before monitoring again
        })
    }
}
