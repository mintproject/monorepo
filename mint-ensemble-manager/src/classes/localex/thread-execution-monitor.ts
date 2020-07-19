import { Pathway, Scenario, MintPreferences, ExecutableEnsemble, ExecutableEnsembleSummary } from "../mint/mint-types";
import { getAllPathwayEnsembleIds, listEnsembles, updatePathwayExecutionSummary } from "../mint/firebase-functions";
import { getScenario, getPathway, fetchMintConfig } from "../mint/firebase-functions";

import Queue from "bull";
import {MONITOR_QUEUE_NAME, REDIS_URL } from "../../config/redis";

export const monitorThread = async function (job: any) {
    var scenario_id: string = job.data.scenario_id;
    var pathway_id: string = job.data.pathway_id;
    var model_id: string = job.data.model_id;

    // Monitor the thread execution
    let scenario: Scenario = await getScenario(scenario_id); //.then((scenario: Scenario) => {
    if(scenario) {
        let pathway: Pathway = await getPathway(scenario_id, pathway_id); //.then((pathway: Pathway) => {
        if(pathway) {
            await _monitorEnsembles(model_id, pathway, scenario);
        }
    }
}

const _monitorEnsembles = async(modelid: string, 
        pathway: Pathway, 
        scenario: Scenario) => {
    let summary = pathway.executable_ensemble_summary[modelid];
    if(!summary)
        summary = {} as ExecutableEnsembleSummary;
    
    // Work in batches
    let batchSize = 500; // Deal with ensembles from firebase in this batch size
    
    let all_ensemble_ids = await getAllPathwayEnsembleIds(scenario.id, pathway.id, modelid);
    
    summary.successful_runs = 0;
    summary.failed_runs = 0;
    summary.submitted_runs = all_ensemble_ids.length;

    // Process ensembles in batches
    for(let i=0; i<all_ensemble_ids.length; i+= batchSize) {
        let ensembleids = all_ensemble_ids.slice(i, i+batchSize);

        // Check Status of all ensembles
        let all_ensembles : ExecutableEnsemble[] = await listEnsembles(ensembleids);
        let successful_ensemble_ids = all_ensembles
            .filter((e) => (e != null && e.status == "SUCCESS"))
            .map((e) => e.id);
        let failed_ensemble_ids = all_ensembles
            .filter((e) => (e != null && e.status == "FAILURE"))
            .map((e) => e.id);
        
        summary.successful_runs += successful_ensemble_ids.length;
        summary.failed_runs += failed_ensemble_ids.length;
    }
    updatePathwayExecutionSummary(scenario.id, pathway.id, modelid, summary);

    if(summary.submitted_runs > (summary.failed_runs + summary.successful_runs)) {
        let monitorQueue = new Queue(MONITOR_QUEUE_NAME, REDIS_URL);
        monitorQueue.process((job) => monitorThread(job));
        // If the failed + successful runs != submitted, i.e. there are still some runs waiting to run, keep monitoring
        monitorQueue.add({ scenario_id: scenario.id, pathway_id: pathway.id, model_id: modelid } , {
            delay: 1000*60*5 // 5 minute delay before monitoring again
        })
    }
}
