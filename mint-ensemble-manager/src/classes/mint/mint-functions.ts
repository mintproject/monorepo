import { Pathway, Model, DataEnsembleMap, Scenario, MintPreferences, ExecutableEnsembleSummary, ExecutableEnsemble, DataResource } from "./mint-types";
import { setupModelWorkflow, fetchWingsTemplate, loginToWings, runModelEnsembles, fetchWingsRunsStatuses, fetchWingsRunResults } from "../wings/wings-functions";
import { getModelInputEnsembles, getModelInputConfigurations, deleteAllPathwayEnsembleIds, setPathwayEnsembleIds, addPathwayEnsembles, getEnsembleHash, successfulEnsembleIds, getAllPathwayEnsembleIds, listEnsembles, updatePathwayEnsembles, updatePathway, getPathway } from "./firebase-functions";

export const saveAndRunExecutableEnsembles = async(
        pathway: Pathway, 
        scenario: Scenario,
        modelid: string,
        prefs: MintPreferences) => {

    // Setup Model for execution on Wings
    await loginToWings(prefs); // Login to Wings now Happens at the top app level            

    for(let pmodelid in pathway.model_ensembles) {
        if(!modelid || (modelid == pmodelid))
            await saveAndRunExecutableEnsemblesForModel(pmodelid, pathway, scenario, prefs);
    }
    console.log("Finished sending all ensembles for execution");

    monitorAllEnsembles(pathway, scenario, modelid, prefs);
}

export const saveAndRunExecutableEnsemblesForModel = async(modelid: string, 
        pathway: Pathway, 
        scenario: Scenario,
        prefs: MintPreferences) => {
    if(!pathway.executable_ensemble_summary)
        pathway.executable_ensemble_summary = {};
    
    let model = pathway.models[modelid];
    let ensemble_details = getModelInputEnsembles(model, pathway);
    let dataEnsemble = ensemble_details[0] as DataEnsembleMap;
    let inputIds = ensemble_details[1] as string[];
    let configs = getModelInputConfigurations(dataEnsemble, inputIds);
    
    if(configs != null) {
        // Delete existing pathway ensemble ids (*NOT DELETING GLOBAL ENSEMBLE DOCUMENTS .. Only clearing list of the pathway's ensemble ids)
        deleteAllPathwayEnsembleIds(scenario.id, pathway.id, modelid);

        // Setup Model for execution on Wings
        // await loginToWings(prefs); // Login to Wings now Happens at the top app level
        
        let workflowid = await setupModelWorkflow(model, pathway, prefs);
        let tpl_package = await fetchWingsTemplate(workflowid, prefs);

        let datasets = {}; // Map of datasets to be registered (passed to Wings to keep track)
    
        // Setup some book-keeping to help in searching for results
        pathway.executable_ensemble_summary[modelid] = {
            total_runs: configs.length,
            workflow_name: workflowid.replace(/.+#/, ''),
            submission_time: Date.now() - 20000 // Less 20 seconds to counter for clock skews
        } as ExecutableEnsembleSummary

        updatePathway(scenario, pathway);
        
        // Work in batches
        let batchSize = 100; // Deal with ensembles from firebase in this batch size
        let batchid = 0; // Use to create batchids in firebase for storing ensemble ids

        let executionBatchSize = 10; // Run workflows in Wings in batches
        
        // Create ensembles in batches
        for(let i=0; i<configs.length; i+= batchSize) {
            let bindings = configs.slice(i, i+batchSize);

            let ensembles : ExecutableEnsemble[] = [];
            let ensembleids : string[] = [];

            // Create ensembles for this batch
            bindings.map((binding) => {
                let inputBindings : any = {};
                for(let j=0; j<inputIds.length; j++) {
                    inputBindings[inputIds[j]] = binding[j];
                }
                //console.log(inputBindings);
                let ensemble = {
                    modelid: modelid,
                    bindings: inputBindings,
                    runid: null,
                    status: null,
                    results: [],
                    submission_time: Date.now(),
                    selected: true
                } as ExecutableEnsemble;
                ensemble.id = getEnsembleHash(ensemble);

                ensembleids.push(ensemble.id);
                ensembles.push(ensemble);
            })

            // Check if any current ensembles already exist 
            // - Note: ensemble ids are uniquely defined by the model id and inputs
            let all_ensemble_ids : any[] = await successfulEnsembleIds(ensembleids);
            let current_ensemble_ids = all_ensemble_ids.filter((eid) => eid); // Filter for null/undefined ensemble ids

            // Run ensembles in smaller batches
            for(let i=0; i<ensembles.length; i+= executionBatchSize) {
                let eslice = ensembles.slice(i, i+executionBatchSize);
                // Get ensembles that arent already run
                let eslice_nr = eslice.filter((ensemble) => current_ensemble_ids.indexOf(ensemble.id) < 0);
                if(eslice_nr.length > 0) {
                    let runids = await runModelEnsembles(pathway, eslice_nr, datasets, tpl_package, prefs);
                    for(let j=0; j<eslice_nr.length; j++) {
                        eslice_nr[j].runid = runids[j];
                        eslice_nr[j].status = "WAITING";
                        eslice_nr[j].execution_engine = "wings";
                        eslice_nr[j].run_progress = 0;
                    }
                    addPathwayEnsembles(eslice_nr);
                }
            }

            // Save pathway ensemble ids (to be used for later retrieval of ensembles)
            setPathwayEnsembleIds(scenario.id, pathway.id,
                model.id, batchid, ensembleids);

            batchid++;
        }
    }
    console.log("Finished submitting all executions for model: " + modelid);
}

export const monitorAllEnsembles = async(
        pathway: Pathway, 
        scenario: Scenario,
        modelid: string,
        prefs: MintPreferences) => {

    let currentTimeout = 30000; // Check every 30 seconds

    console.log("Start monitoring for "+pathway.id);

    checkStatusAllEnsembles(pathway, scenario, modelid, prefs).then(() => {
        console.log("Status checking finished");
        getPathway(scenario.id, pathway.id).then((pway) => {
            pathway = pway;
            let done = true;
            Object.keys(pathway.model_ensembles).map((modelid) => {
                let summary = pathway.executable_ensemble_summary[modelid];
                if(summary.total_runs != (summary.successful_runs + summary.failed_runs)) {
                    done = false;
                }
            })
            // FIXME: Check for a global shared variable if a request comes to abort for this thread
            if(!done) {
                setTimeout(() => {
                    monitorAllEnsembles(pathway, scenario, modelid, prefs)
                }, currentTimeout);
            } else {
                console.log("Finished Monitoring for "+pathway.id+". Thread runs have finished")
            }
        })
    });
}

export const checkStatusAllEnsembles = async(
        pathway: Pathway, 
        scenario: Scenario,
        modelid: string,
        prefs: MintPreferences) => {

    // Setup Model for execution on Wings
    await loginToWings(prefs); // Login to Wings now Happens at the top app level            

    for(let pmodelid in pathway.model_ensembles) {
        if(!modelid || modelid==pmodelid)
            await checkStatusAllEnsemblesForModel(pmodelid, pathway, scenario, prefs);
    }
    console.log("Finished checking ensembles");
}

export const checkStatusAllEnsemblesForModel = async(
        modelid: string,
        pathway: Pathway, 
        scenario: Scenario,
        prefs: MintPreferences) => {
    let model = pathway.models[modelid];
    let summary = pathway.executable_ensemble_summary[modelid];
    
    // await loginToWings(prefs); // Login to Wings handled at the top now
    
    // FIXME: Some problem with the submission times
    let runtimeInfos : any = await fetchWingsRunsStatuses(summary.workflow_name, 
        Math.floor(summary.submission_time/1000), summary.total_runs, prefs);

    let start = 0;
    let pageSize = 100;
    let numSuccessful = 0;
    let numFailed = 0;
    let numRunning = 0;

    let pathwayModelEnsembleIds =  await getAllPathwayEnsembleIds(scenario.id, pathway.id, modelid);

    while(true) {
        let ensembleids = pathwayModelEnsembleIds.slice(start, start+pageSize);
        let ensembles = await listEnsembles(ensembleids);
        start += pageSize;

        if(!ensembles || ensembles.length == 0)
            break;

        let changed_ensembles : ExecutableEnsemble[] = [];

        ensembles.map((ensemble) => {
            // Check if the ensemble is not already finished (probably from another run)
            if(ensemble.status == "WAITING" || ensemble.status == "RUNNING") {
                let runtimeInfo = runtimeInfos[ensemble.runid];
                if(runtimeInfo) {
                    if(runtimeInfo.status != ensemble.status) {
                        if(runtimeInfo.status == "SUCCESS" || runtimeInfo.status == "FAILURE") {
                            ensemble.run_progress = 1;
                        }
                        ensemble.status = runtimeInfo.status;
                        changed_ensembles.push(ensemble);
                    }
                }
                else {
                    // Ensemble not yet submitted
                    //console.log(ensemble);
                }
            }
            switch(ensemble.status) {
                case "RUNNING":
                    numRunning++;
                    break;
                case "SUCCESS":
                    numSuccessful++;
                    break;
                case "FAILURE":
                    numFailed++;
                    break;
            }
        });

        let finished_ensembles = changed_ensembles.filter((ensemble) => ensemble.status == "SUCCESS");

        // Fetch Results of ensembles that have finished
        let results = await Promise.all(finished_ensembles.map((ensemble) => {
            return fetchWingsRunResults(ensemble, prefs);
        }));
        for(let i=0; i<finished_ensembles.length; i++) {
            if(results[i])
                finished_ensembles[i].results = results[i];
        }

        // Update all ensembles
        updatePathwayEnsembles(changed_ensembles);
    }
    
    summary.successful_runs = numSuccessful;
    summary.failed_runs = numFailed;
    summary.submitted_runs = numRunning + numSuccessful + numFailed;
    
    await updatePathway(scenario, pathway);
}