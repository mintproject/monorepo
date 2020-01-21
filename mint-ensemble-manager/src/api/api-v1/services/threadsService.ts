import { getScenario, fetchMintConfig, addScenario, getSubgoal, addSubGoal, addPathway, getRegionDetails, getTotalConfigurations } from "../../../classes/mint/firebase-functions";
import { Pathway, Scenario, SubGoal, Model, StepUpdateInformation, Dataset, ExecutableEnsembleSummary, PathwayUpdateInformation, Region } from "../../../classes/mint/mint-types";
import { toTimeStamp } from "../../../classes/mint/date-utils";
import { fetchModelFromCatalog } from "../../../classes/mint/model-catalog-functions";
import { queryDatasetDetails } from "../../../classes/mint/data-catalog-functions";
import { isArray } from "util";

// ./api-v1/services/threadsService.js

const createResponse = (result: string, message: string) => {
    return {
        result: result,
        message: message
    };
}

const threadsService = {
    async createThread(desc: any) {
        let mint_prefs = await fetchMintConfig();

        // Create Scenario if needed
        let scenario_desc = desc.scenario;
        let scenario : Scenario =  null;
        if(scenario_desc.id) {
            scenario = await getScenario(scenario_desc.id);
        }
        else {
            scenario = {
                name: scenario_desc.name,
                regionid: scenario_desc.regionid,
                dates: {
                    start_date: toTimeStamp(scenario_desc.time_period.from),
                    end_date: toTimeStamp(scenario_desc.time_period.to)
                },
            }
            scenario.id = await addScenario(scenario);
        }

        // Create Task (Subgoal) if needed
        let task_desc = desc.subgoal;
        let task : SubGoal = null;
        let time_period = task_desc.time_period ? task_desc.time_period : scenario_desc.time_period;
        if(task_desc.id && scenario_desc.id) {
            task = await getSubgoal(scenario_desc.id, task_desc.id);
        }
        else {
            task = {
                name: task_desc.name,
                subregionid: task_desc.regionid,
                response_variables: [ task_desc.indicatorid ],
                driving_variables: task_desc.interventionid ? [ task_desc.interventionid ] : [],
                dates: {
                    start_date: toTimeStamp(time_period.from),
                    end_date: toTimeStamp(time_period.to)
                }
            }
            task.id = await addSubGoal(scenario, task);
        }


        // Create Thread
        let thread_desc = desc.thread;
        let update_info = {
            time: Date.now(), user: "api"
        } as StepUpdateInformation;

        let thread : Pathway = {
            name: thread_desc.name ? thread_desc.name : null,
            driving_variables: task.driving_variables,
            response_variables: task.response_variables,
            models: {},
            datasets: {},            
            model_ensembles: {},
            executable_ensemble_summary: {},
            dates: task.dates,
            last_update: {
                variables: update_info,
                models: update_info,
                datasets: update_info,
                parameters: update_info,
            } as PathwayUpdateInformation,
        } as Pathway;

        // Fetch region details
        let region: Region = await getRegionDetails(scenario.regionid, task.subregionid);

        // Fetch model details from the Model Catalog
        let model : Model = await fetchModelFromCatalog([ task_desc.indicatorid ], [], thread_desc.modelid, mint_prefs);
        thread.models[model.id] = model;
        thread.model_ensembles[model.id] = {};

        for(var i=0; i<model.input_parameters.length; i++) {
            let input_parameter = model.input_parameters[i];
            if(!input_parameter.value) {
                let value = thread_desc.parameters[input_parameter.name];
                if(!value)
                    value = input_parameter.default;
                if(!isArray(value))
                    value = [ value ];
                thread.model_ensembles[model.id][input_parameter.id] = value;
            }
        }

        // Fetch dataset details from the Data Catalog
        for(var i=0; i<model.input_files.length; i++) {
            let input_file = model.input_files[i];
            if(!input_file.value) {
                // Only search for model inputs that don't have a fixed value defined                
                let datasetids = thread_desc.datasets[input_file.name];
                if(datasetids) {
                    if(!isArray(datasetids))
                        datasetids = [ datasetids ];     
                    thread.model_ensembles[model.id][input_file.id] = datasetids;  
                    for(var j=0; j<datasetids.length; j++) {
                        let dsid = datasetids[j];
                        let dataset : Dataset = await queryDatasetDetails(model.id, input_file.id, 
                            input_file.variables, dsid, thread.dates, region, mint_prefs);
                        thread.datasets[dataset.id] = dataset;
                    }                      
                }
            }
        }

        // Get total number of configs to run
        let totalconfigs = getTotalConfigurations(model, thread.model_ensembles[model.id], thread);
        thread.executable_ensemble_summary[model.id] = {
            total_runs: totalconfigs,
            submitted_runs: 0,
            failed_runs: 0,
            successful_runs: 0
        } as ExecutableEnsembleSummary;

        // Store the thread
        let threadid = await addPathway(scenario, task.id, thread);
        thread.id = threadid;

        // Return details of newly created thread
        let modelthread = {
            scenario_id: scenario.id,
            subgoal_id: task.id,
            thread_id: thread.id
        }
        return createResponse("success", JSON.stringify(modelthread));
    },
};

export default threadsService;