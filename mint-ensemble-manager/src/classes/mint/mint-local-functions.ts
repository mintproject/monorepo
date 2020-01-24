import { Pathway, Model, DataEnsembleMap, Scenario, MintPreferences, ExecutableEnsembleSummary, ExecutableEnsemble } from "./mint-types";
import { getModelInputEnsembles, getModelInputConfigurations, deleteAllPathwayEnsembleIds, setPathwayEnsembleIds, getEnsembleHash, listAlreadyRunEnsembleIds, getAllPathwayEnsembleIds, listEnsembles, updatePathwayEnsembles, updatePathway, setPathwayEnsembles, deletePathwayEnsembles } from "./firebase-functions";
import { runModelEnsemblesLocally, loadModelWCM, getModelCacheDirectory } from "../localex/local-execution-functions";

import fs from "fs-extra";

export const saveAndRunExecutableEnsemblesLocally = async(
        pathway: Pathway, 
        scenario: Scenario,
        modelid: string,
        prefs: MintPreferences) => {

    for(let pmodelid in pathway.model_ensembles) {
        if(!modelid || (modelid == pmodelid))
            await saveAndRunExecutableEnsemblesForModelLocally(pmodelid, pathway, scenario, prefs);
    }
    console.log("Finished sending all ensembles for local execution");

    //monitorAllEnsembles(pathway, scenario, prefs);
}

export const saveAndRunExecutableEnsemblesForModelLocally = async(modelid: string, 
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
        // Setup some book-keeping to help in searching for results
        pathway.executable_ensemble_summary[modelid] = {
            total_runs: configs.length,
            submitted_runs : 0,
            failed_runs: 0,
            successful_runs: 0,
            workflow_name: "", // No workflow. Local execution
            submitted_for_execution: true,
            submission_time: Date.now() - 20000 // Less 20 seconds to counter for clock skews
        } as ExecutableEnsembleSummary

        await updatePathway(scenario, pathway);
        
        // Load the component model
        let component = await loadModelWCM(model.wcm_uri, model, prefs);

        // Delete existing pathway ensemble ids (*NOT DELETING GLOBAL ENSEMBLE DOCUMENTS .. Only clearing list of the pathway's ensemble ids)
        await deleteAllPathwayEnsembleIds(scenario.id, pathway.id, modelid);

        // Work in batches
        let batchSize = 100; // Deal with ensembles from firebase in this batch size
        let batchid = 0; // Use to create batchids in firebase for storing ensemble ids

        // Run models locally in these number of parallel threads
        let executionBatchSize = prefs.localex.parallelism ? prefs.localex.parallelism : 10; 
        
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
                    execution_engine: "localex",
                    runid: null,
                    status: null,
                    results: {},
                    submission_time: Date.now(),
                    selected: true
                } as ExecutableEnsemble;
                ensemble.id = getEnsembleHash(ensemble);

                ensembleids.push(ensemble.id);
                ensembles.push(ensemble);
            })

            // Save pathway ensemble ids (to be used for later retrieval of ensembles)
            setPathwayEnsembleIds(scenario.id, pathway.id, model.id, batchid, ensembleids);

            // Check if any current ensembles already exist 
            // - Note: ensemble ids are uniquely defined by the model id and inputs
            let all_ensemble_ids : any[] = await listAlreadyRunEnsembleIds(ensembleids);
            let current_ensemble_ids = all_ensemble_ids.filter((eid) => eid); // Filter for null/undefined ensemble ids

            pathway.executable_ensemble_summary[modelid].submitted_runs += current_ensemble_ids.length;
            pathway.executable_ensemble_summary[modelid].successful_runs += current_ensemble_ids.length;
            updatePathway(scenario, pathway);

            // Run ensembles in smaller batches
            for(let i=0; i<ensembles.length; i+= executionBatchSize) {
                let eslice = ensembles.slice(i, i+executionBatchSize);
                // Get ensembles that arent already run
                let eslice_nr = eslice.filter((ensemble) => current_ensemble_ids.indexOf(ensemble.id) < 0);
                if(eslice_nr.length > 0) {
                    pathway.executable_ensemble_summary[modelid].submitted_runs += eslice_nr.length;

                    // Store the ensembles in Firebase (empty status)
                    await setPathwayEnsembles(eslice_nr);
                    updatePathway(scenario, pathway);

                    // The following will create multiple threads and update the ensembles inside the thread itself
                    eslice_nr = await runModelEnsemblesLocally(pathway, component, eslice_nr, prefs);

                    // Update the ensemble summary
                    eslice_nr.map((finished_ensemble) => {
                        if(finished_ensemble.status == "FAILURE")
                            pathway.executable_ensemble_summary[modelid].failed_runs++;
                        else if(finished_ensemble.status == "SUCCESS")
                            pathway.executable_ensemble_summary[modelid].successful_runs++;
                    });

                    // Store the updated ensembles in Firebase (updated status)
                    await setPathwayEnsembles(eslice_nr);
                    updatePathway(scenario, pathway);
                }
            }

            batchid++;
        }
    }
    console.log("Finished submitting all executions for model: " + modelid);
}

export const deleteExecutableCacheLocally = async(
    pathway: Pathway, 
    scenario: Scenario,
    modelid: string,
    prefs: MintPreferences) => {

for(let pmodelid in pathway.model_ensembles) {
    if(!modelid || (modelid == pmodelid))
        await deleteExecutableCacheForModelLocally(pmodelid, pathway, scenario, prefs);
}
console.log("Finished deleting all execution cache for local execution");

//monitorAllEnsembles(pathway, scenario, prefs);
}

export const deleteExecutableCacheForModelLocally = async(modelid: string, 
    pathway: Pathway, 
    scenario: Scenario,
    prefs: MintPreferences) => {

    let model = pathway.models[modelid];
    let ensembleids = await getAllPathwayEnsembleIds(scenario.id, pathway.id, modelid);

    // Delete existing pathway ensemble ids (*NOT DELETING GLOBAL ENSEMBLE DOCUMENTS .. Only clearing list of the pathway's ensemble ids)
    await deleteAllPathwayEnsembleIds(scenario.id, pathway.id, modelid);

    // Delete the actual ensemble documents
    await deletePathwayEnsembles(ensembleids);

    // Delete cached model directory and zip file
    let modeldir = getModelCacheDirectory(model.wcm_uri, prefs);
    if(modeldir != null) {
        fs.remove(modeldir);
        fs.remove(modeldir + ".zip");
    }

    // Remove all executable information and update the pathway
    pathway.executable_ensemble_summary[modelid].successful_runs = 0;
    pathway.executable_ensemble_summary[modelid].failed_runs = 0;
    pathway.executable_ensemble_summary[modelid].submitted_runs = 0;
    pathway.executable_ensemble_summary[modelid].submission_time = 0;
    pathway.executable_ensemble_summary[modelid].submitted_for_execution = false;

    await updatePathway(scenario, pathway);
}
