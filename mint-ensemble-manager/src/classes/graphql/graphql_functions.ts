import { db, fieldPath, increment } from "../../config/firebase";

import { DEVMODE, DEVHOMEDIR, PORT } from "../../config/app";

import {
    ProblemStatement,  Thread, Task, Model, DataResource,
    Execution, ExecutionSummary, MintPreferences, ModelIOBindings, ThreadModelMap } from '../mint/mint-types';

import { GraphQL } from '../../config/graphql';

import getProblemStatementGQL from './queries/problem-statement/get.graphql';
import getTaskGQL from './queries/task/get.graphql';
import getThreadGQL from './queries/thread/get.graphql';

import getExecutionGQL from './queries/execution/get.graphql';
import listSuccessfulIdsGQL from './queries/execution/list-successful-ids.graphql';
import getExecutionsGQL from './queries/execution/list.graphql';
import setExecutionsGQL from './queries/execution/new.graphql';
import updateExecutionStatusResultsGQL from './queries/execution/update-status-results.graphql';
import deleteExecutionsGQL from './queries/execution/delete.graphql';

import updateExecutionSummary from './queries/execution/update-execution-summary.graphql';
import incFailedRunsGQL from './queries/execution/increment-failed-runs.graphql';
import incSuccessfulRunsGQL from './queries/execution/increment-successful-runs.graphql';
import incSubmittedRunsGQL from './queries/execution/increment-submitted-runs.graphql';

import listThreadModelExecutionIdsGQL from './queries/execution/list-thread-model-executions.graphql';
import newThreadModelExecutionsGQL from './queries/execution/new-thread-model-executions.graphql';
import deleteThreadModelExecutionsGQL from './queries/execution/delete-thread-model-executions.graphql';

import { problemStatementFromGQL, taskFromGQL, threadFromGQL, 
    executionFromGQL,
    executionToGQL,
    executionResultsToGQL} from './graphql_adapter';
import { isObject } from 'util';
import { Md5 } from 'ts-md5';


const APOLLO_CLIENT = GraphQL.instance();

export const fetchMintConfig = (): Promise<MintPreferences> => {
    return new Promise<MintPreferences>((resolve, reject) => {
        db.doc("configs/main").get().then((doc) => {
            let prefs = doc.data() as MintPreferences;

            if(DEVMODE) {
                prefs.ensemble_manager_api = "http://localhost:" + PORT + "/v1";
                prefs.localex.datadir = DEVHOMEDIR + "/data";
                prefs.localex.codedir = DEVHOMEDIR + "/code";
                prefs.localex.logdir = DEVHOMEDIR + "/logs";
                prefs.localex.dataurl = "file://" + DEVHOMEDIR + "/data";
                prefs.localex.logurl = "file://" + DEVHOMEDIR + "/logs";
            }
           
            if(prefs.execution_engine == "wings") {
              fetch(prefs.wings.server + "/config").then((res) => {
                res.json().then((wdata) => {
                  prefs.wings.export_url = wdata["internal_server"]
                  prefs.wings.storage = wdata["storage"];
                  prefs.wings.dotpath = wdata["dotpath"];
                  prefs.wings.onturl = wdata["ontology"];
                  resolve(prefs);
                })
              })
            }
            else {
              resolve(prefs);
            }
          })
    })
};


export const getProblemStatement = async(problem_statement_id: string) : Promise<ProblemStatement> => {
    return APOLLO_CLIENT.query({
        query: getProblemStatementGQL,
        variables: {
            id: problem_statement_id
        }
    }).then(result => {
        if(result.errors && result.errors.length > 0) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            let problem = result.data.problem_statement_by_pk;
            if(problem) {
                return problemStatementFromGQL(problem);
            }
        }
        return null;
    });
}

export const getTask = async(taskid: string) : Promise<Task> => {
    return APOLLO_CLIENT.query({
        query: getTaskGQL,
        variables: {
            id: taskid
        }
    }).then(result => {
        if(result.errors && result.errors.length > 0) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            let task = result.data.task_by_pk;
            if(task) {
                return taskFromGQL(task);
            }
        }
        return null;
    });
}

export const getThread = async(threadid: string) : Promise<Thread> => {
    return APOLLO_CLIENT.query({
        query: getThreadGQL,
        variables: {
            id: threadid
        }
    }).then(result => {
        if(result.errors && result.errors.length > 0) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            let thread = result.data.thread_by_pk;
            if(thread) {
                return threadFromGQL(thread);
            }
        }
        return null;
    });
}

const MAX_CONFIGURATIONS = 1000000;
export const getTotalConfigurations = (model: Model, bindings: ModelIOBindings, thread: Thread) => {
    let totalconfigs = 1;
    model.input_files.map((io) => {
        if(!io.value) {
            // Expand a dataset to it's constituent resources
            // FIXME: Create a collection if the model input has dimensionality of 1
            if(bindings[io.id]) {
                let nexecution : any[] = [];
                bindings[io.id].map((dsid) => {
                    let ds = thread.data[dsid];
                    let selected_resources = ds.resources.filter((res) => res.selected);
                    // Fix for older saved resources
                    if(selected_resources.length == 0) 
                        selected_resources = ds.resources;
                    nexecution = nexecution.concat(selected_resources);
                });
                totalconfigs *= nexecution.length;
            }
        }
        else {
            totalconfigs *= (io.value.resources as any[]).length;
        }
    })
    
    // Add adjustable parameters to the input ids
    model.input_parameters.map((io) => {
        if(!io.value)
            totalconfigs *= bindings[io.id].length;
    });

    return totalconfigs;
}

const cartProd = (lists : any[]) => {
    let ps : any[] = [],
        acc : any [][] = [
            []
        ],
        i = lists.length;
    while (i--) {
        let subList = lists[i],
            j = subList.length;
        while (j--) {
            let x = subList[j],
                k = acc.length;
            while (k--) ps.push([x].concat(acc[k]))
        };
        acc = ps;
        ps = [];
    };
    return acc.reverse();
};

export const getModelInputConfigurations = (
        threadModel: ThreadModelMap,
        inputIds: string[]) => {
    let dataBindings = threadModel.bindings;
    let inputBindings : any[] = [];
    let totalproducts = 1;
    inputIds.map((inputid) => {
        inputBindings.push(dataBindings[inputid]);
        if(dataBindings[inputid])
            totalproducts *= dataBindings[inputid].length;
    });
    if(totalproducts < MAX_CONFIGURATIONS) {
        return cartProd(inputBindings);
    }
    else {
        return null;
    }
}

export const getModelInputBindings = (model: Model, thread: Thread) => {
    let me = thread.model_ensembles[model.id];
    let threadModel = {
        id: me.id,
        bindings: Object.assign({}, me.bindings)
    } as ThreadModelMap;
    let inputIds : any[] = [];

    model.input_files.map((io) => {
        inputIds.push(io.id);
        if(!io.value) {
            // Expand a dataset to it's constituent "selected" resources
            // FIXME: Create a collection if the model input has dimensionality of 1
            if(threadModel.bindings[io.id]) {
                let nexecution : any[] = [];
                threadModel.bindings[io.id].map((dsid) => {
                    let ds = thread.data[dsid];
                    let selected_resources = ds.resources.filter((res) => res.selected);
                    // Fix for older saved resources
                    if(selected_resources.length == 0) 
                        selected_resources = ds.resources;
                    nexecution = nexecution.concat(selected_resources);
                });
                threadModel.bindings[io.id] = nexecution;
            }
        }
        else {
            threadModel.bindings[io.id] = io.value.resources as any[];
        }
    })
    
    // Add adjustable parameters to the input ids
    model.input_parameters.map((io) => {
        if(!io.value) inputIds.push(io.id);
    })
    // Get cartesian product of inputs to get all model configurations

    return [threadModel, inputIds];
};


/* 
    Executions
*/
export const getExecution = async(executionid: string) : Promise<Execution> => {
    return APOLLO_CLIENT.query({
        query: getExecutionGQL,
        variables: {
            id: executionid
        }
    }).then(result => {
        if(result.errors && result.errors.length > 0) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            let execution = result.data.execution_by_pk;
            if(execution) {
                return executionFromGQL(execution);
            }
        }
        return null;
    });
}

// Get Executions
export const getExecutions = (executionids: string[]) : Promise<Execution[]> => {
    return APOLLO_CLIENT.query({
        query: getExecutionsGQL,
        variables: {
            ids: executionids
        }
    }).then((result) => {
        if(result.errors && result.errors.length > 0) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            return result.data.execution.map((ex:any) => executionFromGQL(ex));
        }
        return null;        
    });
};

export const getMatchingExecution = (executions: Execution[], execution: Execution, hashes: string[]) => {
    let hash = getExecutionHash(execution);
    let index = hashes.indexOf(hash);
    if(index >= 0) {
        return executions[index];
    }
    return null;
}

export const getExecutionHash = (execution: Execution) : string => {
    let str = execution.modelid;
    let varids = Object.keys(execution.bindings).sort();
    varids.map((varid) => {
        let binding = execution.bindings[varid];
        let bindingid = isObject(binding) ? (binding as DataResource).id : binding;
        str += varid + "=" + bindingid + "&";
    })
    return Md5.hashStr(str).toString();
}

// List Successful Execution Ids
export const listSuccessfulExecutionIds = (executionids: string[]) : Promise<string[]> => {
    return APOLLO_CLIENT.query({
        query: listSuccessfulIdsGQL,
        variables: {
            ids: executionids
        }
    }).then((result) => {
        if(result.errors && result.errors.length > 0) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            return result.data.execution.map((ex:any) => ex["id"]);
        }
        return null;        
    });
};

// Update Executions
export const setExecutions = (executions: Execution[]) => {
    return APOLLO_CLIENT.mutate({
        mutation: setExecutionsGQL,
        variables: {
            ids: executions.map((ex) => ex.id),
            executions: executions.map((ex) => executionToGQL(ex))
        }
    });
}

// Update Execution status and results only
export const updateExecutionStatusAndResults = (execution: Execution) => {
    return APOLLO_CLIENT.mutate({
        mutation: updateExecutionStatusResultsGQL,
        variables: {
            id: execution.id,
            start_time: execution.start_time,
            end_time: execution.end_time,
            run_progress: execution.run_progress,
            status: execution.status,
            results: executionResultsToGQL(execution.results).map((exres:any) => {
                exres["execution_id"] = execution.id;
                return exres;
            })
        }
    });
}

// Delete Executions
export const deleteExecutions = (executionids: string[]) => {
    return APOLLO_CLIENT.mutate({
        mutation: deleteExecutionsGQL,
        variables: {
            ids: executionids
        }
    });
}


/* 
    Thread Model Execution Mappings 
*/
export const getThreadModelExecutionIds = async (thread_model_id: string) : Promise<string[]> => {
    return APOLLO_CLIENT.query({
        query: listThreadModelExecutionIdsGQL,
        variables: {
            threadModelId: thread_model_id
        }
    }).then((result) => {
        if(result.errors && result.errors.length > 0) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            return result.data.thread_model_by_pk.executions.map((ex:any) => ex.execution_id);
        }
        return null;        
    });
}

export const setThreadModelExecutionIds = (thread_model_id: string, executionids: string[]) => {
    let tmexids = executionids.map((exid) => {
        return {
            thread_model_id: thread_model_id,
            execution_id: exid
        }
    });
    return APOLLO_CLIENT.mutate({
        mutation: newThreadModelExecutionsGQL,
        variables: {
            threadModelExecutions: tmexids
        }
    });
}

export const deleteThreadModelExecutionIds = async (thread_model_id: string) => {
    return APOLLO_CLIENT.mutate({
        mutation: deleteThreadModelExecutionsGQL,
        variables: {
            threadModelId: thread_model_id
        }
    });
}

/* 
    Thread Model Execution Summaries 
*/
export const setThreadModelExecutionSummary = (thread_model_id: string, summary: ExecutionSummary) =>  {
    return APOLLO_CLIENT.mutate({
        mutation: updateExecutionSummary,
        variables: {
            threadModelId: thread_model_id,
            summary: summary
        }
    });
};

// Increment thread submitted runs
export const incrementThreadModelSubmittedRuns = (thread_model_id: string) =>  {
    return APOLLO_CLIENT.mutate({
        mutation: incSubmittedRunsGQL,
        variables: {
            threadModelId: thread_model_id
        }
    });
};

// Increment thread successful runs
export const incrementThreadModelSuccessfulRuns = (thread_model_id: string) =>  {
    return APOLLO_CLIENT.mutate({
        mutation: incSuccessfulRunsGQL,
        variables: {
            threadModelId: thread_model_id
        }
    });
};

// Increment thread failed runs
export const incrementThreadModelFailedRuns = (thread_model_id: string) =>  {
    return APOLLO_CLIENT.mutate({
        mutation: incFailedRunsGQL,
        variables: {
            threadModelId: thread_model_id
        }
    });
};