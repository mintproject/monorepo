import { DEVMODE, DEVHOMEDIR, PORT } from "../../config/app";

import {
    ProblemStatement,  Thread, Task, Model, DataResource,
    Execution, ExecutionSummary, MintPreferences, ModelIOBindings, ThreadModelMap, ProblemStatementInfo, ThreadInfo, DataMap, ModelEnsembleMap, IdMap, Region, BoundingBox } from '../mint/mint-types';
import { ModelConfigurationSetup } from '@mintproject/modelcatalog_client';

import { GraphQL } from '../../config/graphql';

import getProblemStatementGQL from './queries/problem-statement/get.graphql';
import getTaskGQL from './queries/task/get.graphql';
import getThreadGQL from './queries/thread/get.graphql';

import newProblemStatementGQL from './queries/problem-statement/new.graphql';
import newTaskGQL from './queries/task/new.graphql';
import newThreadGQL from './queries/thread/new.graphql';

import updateProblemStatementGQL from './queries/problem-statement/update.graphql';
import updateTaskGQL from './queries/task/update.graphql';
import updateThreadModelGQL from './queries/thread/update-models.graphql';
import updateThreadDataGQL from './queries/thread/update-datasets.graphql';
import updateThreadParametersGQL from './queries/thread/update-parameters.graphql';
import updateThreadInfoGQL from './queries/thread/update-info.graphql';

import getExecutionGQL from './queries/execution/get.graphql';
import listSuccessfulIdsGQL from './queries/execution/list-successful-ids.graphql';
import listExistingIdStatusGQL from './queries/execution/list-existing-ids.graphql';
import getExecutionsGQL from './queries/execution/list.graphql';
import setExecutionsGQL from './queries/execution/new.graphql';
import updateExecutionStatusResultsGQL from './queries/execution/update-status-results.graphql';
import deleteExecutionsGQL from './queries/execution/delete.graphql';

import getRegionDetailsGQL from './queries/region/get.graphql';

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
    problemStatementToGQL,
    taskToGQL,
    threadInfoToGQL,
    problemStatementUpdateToGQL,
    taskUpdateToGQL,
    threadInfoUpdateToGQL,
    getCustomEvent,
    threadDataBindingsToGQL,
    threadParameterBindingsToGQL,
    executionResultsToGQL,
    regionFromGQL,
    eventToGQL} from './graphql_adapter';
import { Md5 } from 'ts-md5';
import { isObject } from "util";
import { KeycloakAdapter } from "../../config/keycloak-adapter";


export const getProblemStatement = async(problem_statement_id: string) : Promise<ProblemStatement> => {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.query({
        query: getProblemStatementGQL,
        variables: {
            id: problem_statement_id
        }
    }).then(result => {
        if(!result || (result.errors && result.errors.length > 0)) {
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
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.query({
        query: getTaskGQL,
        variables: {
            id: taskid
        }
    }).then(result => {
        if(!result || (result.errors && result.errors.length > 0)) {
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
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.query({
        query: getThreadGQL,
        fetchPolicy: 'no-cache',
        variables: {
            id: threadid
        }
    }).then(result => {
        if(!result || (result.errors && result.errors.length > 0)) {
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
export const getTotalConfigurations = (model: ModelConfigurationSetup, bindings: ModelIOBindings, data: DataMap) => {
    let totalconfigs = 1;
    model.hasInput.map((io) => {
        if(!io.hasFixedResource || io.hasFixedResource.length == 0) {
            // Expand a dataset to it's constituent resources
            // FIXME: Create a collection if the model input has dimensionality of 1
            if(bindings[io.id]) {
                let nexecution : any[] = [];
                bindings[io.id].map((dsid) => {
                    let ds = data[dsid];
                    let selected_resources = ds.resources.filter((res) => res.selected);
                    // Fix for older saved resources
                    if(!selected_resources || selected_resources.length == 0) 
                        selected_resources = ds.resources;
                    nexecution = nexecution.concat(selected_resources);
                });
                totalconfigs *= nexecution.length;
            }
        }
        else {
            totalconfigs *= (io.hasFixedResource as any[]).length;
        }
    })
    
    // Add adjustable parameters to the input ids
    model.hasParameter.map((io) => {
        if(!io.hasFixedValue || io.hasFixedValue.length == 0)
            totalconfigs *= (bindings[io.id]?.length ?? 1);
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
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.query({
        query: getExecutionGQL,
        variables: {
            id: executionid
        }
    }).then(result => {
        if(!result || (result.errors && result.errors.length > 0)) {
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
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.query({
        query: getExecutionsGQL,
        variables: {
            ids: executionids
        }
    }).then((result) => {
        if(!result || (result.errors && result.errors.length > 0)) {
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

// List Existing Execution Ids
export const listExistingExecutionIdStatus = (executionids: string[]) : Promise<Map<string,string>> => {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.query({
        query: listExistingIdStatusGQL,
        variables: {
            ids: executionids
        }
    }).then((result) => {
        if(!result || (result.errors && result.errors.length > 0)) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            let idstatus = {}
            result.data.execution.forEach((ex:any) => { 
                idstatus[ex["id"].replace(/-/g, "")] = ex["status"];
            });
        }
        return null;        
    });
};

// List Successful Execution Ids
export const listSuccessfulExecutionIds = (executionids: string[]) : Promise<string[]> => {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.query({
        query: listSuccessfulIdsGQL,
        variables: {
            ids: executionids
        }
    }).then((result) => {
        if(!result || (result.errors && result.errors.length > 0)) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            return result.data.execution.map((ex:any) => ex["id"].replace(/-/g, ""));
        }
        return null;        
    });
};

// Update Executions
export const setExecutions = (executions: Execution[], thread_model_id: string) => {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.mutate({
        mutation: setExecutionsGQL,
        variables: {
            ids: executions.map((ex) => ex.id),
            tmid: thread_model_id,
            executions: executions.map((ex) => executionToGQL(ex))
        }
    });
}

// Update Execution status and results only
export const updateExecutionStatusAndResults = (execution: Execution) => {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
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
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
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
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.query({
        query: listThreadModelExecutionIdsGQL,
        variables: {
            threadModelId: thread_model_id
        }
    }).then((result) => {
        if(!result || (result.errors && result.errors.length > 0)) {
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
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
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
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
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
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.mutate({
        mutation: updateExecutionSummary,
        variables: {
            threadModelId: thread_model_id,
            summary: summary
        }
    });
};

// Increment thread submitted runs
export const incrementThreadModelSubmittedRuns = (thread_model_id: string, num: number = 1) =>  {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.mutate({
        mutation: incSubmittedRunsGQL,
        variables: {
            threadModelId: thread_model_id,
            inc: num
        }
    });
};

// Increment thread successful runs
export const incrementThreadModelSuccessfulRuns = (thread_model_id: string, num: number = 1) =>  {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.mutate({
        mutation: incSuccessfulRunsGQL,
        variables: {
            threadModelId: thread_model_id,
            inc: num
        }
    });
};

// Increment thread failed runs
export const incrementThreadModelFailedRuns = (thread_model_id: string, num: number = 1) =>  {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.mutate({
        mutation: incFailedRunsGQL,
        variables: {
            threadModelId: thread_model_id,
            inc: num
        }
    });
};


/* Update Functions */
// Add ProblemStatement
export const addProblemStatement = (problem_statement:ProblemStatementInfo) : Promise<string> =>  {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    let problemobj = problemStatementToGQL(problem_statement);
    return APOLLO_CLIENT.mutate({
        mutation: newProblemStatementGQL,
        variables: {
            object: problemobj
        }
    }).then((result) => {
        if(!result || (result.errors && result.errors.length > 0)) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            return result.data.insert_problem_statement.returning[0].id;
        }
        return null;        
    });
};

// Add Task
export const addTask = (problem_statement: ProblemStatementInfo, task: Task) : Promise<string> =>  {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    let taskobj = taskToGQL(task, problem_statement);
    return APOLLO_CLIENT.mutate({
        mutation: newTaskGQL,
        variables: {
            object: taskobj
        }
    }).then((result) => {
        if(!result || (result.errors && result.errors.length > 0)) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            return result.data.insert_task.returning[0].id;
        }
        return null;        
    });
};

// Add Task
export const addTaskWithThread = (problem_statement: ProblemStatementInfo, task: Task, thread: ThreadInfo) : Promise<string[]> =>  {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    let taskobj = taskToGQL(task, problem_statement);
    let threadobj = threadInfoToGQL(thread, task.id, task.regionid);
    taskobj["threads"] = {
        data: [threadobj]
    }
    return APOLLO_CLIENT.mutate({
        mutation: newTaskGQL,
        variables: {
            object: taskobj
        }
    }).then((result) => {
        if(!result || (result.errors && result.errors.length > 0)) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            return [
                result.data.insert_task.returning[0].id,
                result.data.insert_task.returning[0].threads[0].id
            ];
        }
        return null;        
    });
};

// Add Thread
export const addThread = (task:Task, thread: ThreadInfo) : Promise<string> =>  {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    let threadobj = threadInfoToGQL(thread, task.id, task.regionid);
    //console.log(threadobj);
    return APOLLO_CLIENT.mutate({
        mutation: newThreadGQL,
        variables: {
            object: threadobj
        }
    }).then((result) => {
        if(!result || (result.errors && result.errors.length > 0)) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            return result.data.insert_thread.returning[0].id;
        }
        return null;        
    });
};


// Update ProblemStatement
export const updateProblemStatement = (problem_statement: ProblemStatementInfo) =>  {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    let problemobj = problemStatementUpdateToGQL(problem_statement);
    return APOLLO_CLIENT.mutate({
        mutation: updateProblemStatementGQL,
        variables: {
            object: problemobj
        }
    });
};

// Update Task
export const updateTask = (task: Task) =>  {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    let taskobj = taskUpdateToGQL(task);
    return APOLLO_CLIENT.mutate({
        mutation: updateTaskGQL,
        variables: {
            object: taskobj
        }
    });
};

export const updateThreadInformation = (threadinfo: ThreadInfo) => {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    let threadobj = threadInfoUpdateToGQL(threadinfo);
    return APOLLO_CLIENT.mutate({
        mutation: updateThreadInfoGQL,
        variables: {
            object: threadobj
        }
    });
}

export const setThreadModels = (models: ModelConfigurationSetup[], notes: string, thread: Thread) =>  {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    let threadmodelsobj = models.map((model) => {
        return {
            model_id: model.id,
            thread_id: thread.id
        };
    });
    let event = getCustomEvent("SELECT_MODELS", notes);
    let eventobj = eventToGQL(event);
    eventobj["thread_id"] = thread.id;
    return APOLLO_CLIENT.mutate({
        mutation: updateThreadModelGQL,
        variables: {
            threadId: thread.id,
            objects: threadmodelsobj,
            event: eventobj
        }
    });
};

export const setThreadData = (datasets: DataMap, model_ensembles: ModelEnsembleMap, 
        notes: string, thread: Thread) =>  {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    let bindings = threadDataBindingsToGQL(datasets, model_ensembles, thread);
    let event = getCustomEvent("SELECT_DATA", notes);
    let eventobj = eventToGQL(event);
    eventobj["thread_id"] = thread.id;
    
    return APOLLO_CLIENT.mutate({
        mutation: updateThreadDataGQL,
        variables: {
            threadId: thread.id,
            data: bindings.data,
            modelIO: bindings.model_io,
            event: eventobj
        }
    });
};

export const setThreadParameters = (model_ensembles: ModelEnsembleMap, 
        execution_summary: IdMap<ExecutionSummary>,
        notes: string, thread: Thread) =>  {
    let bindings = threadParameterBindingsToGQL(model_ensembles, thread);
    let event = getCustomEvent("SELECT_PARAMETERS", notes);
    let eventobj = eventToGQL(event);
    eventobj["thread_id"] = thread.id;
    let summaries = [];
    Object.keys(execution_summary).forEach((modelid) => {
        let summary = execution_summary[modelid];
        summary["thread_model_id"] = model_ensembles[modelid].id;
        summaries.push(summary);
    })
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return APOLLO_CLIENT.mutate({
        mutation: updateThreadParametersGQL,
        variables: {
            threadId: thread.id,
            summaries: summaries,
            modelParams: bindings,
            event: eventobj
        }
    });
};

// Get details about a particular region/subregion
export const getRegionDetails = (regionid: string, subregionid: string) => {
    let APOLLO_CLIENT = GraphQL.instance(KeycloakAdapter.getUser());
    return new Promise<Region>((resolve, reject) => {
        APOLLO_CLIENT.query({
            query: getRegionDetailsGQL,
            variables: {
                id: subregionid
            }
        }).then(result => {
            if(!result || (result.errors && result.errors.length > 0)) {
                console.log("ERROR");
                console.log(result);
                reject();
            }
            else {
                let region = regionFromGQL(result.data.region_by_pk);
                region.bounding_box = _calculateBoundingBox(region.geometries)
                resolve(region);
            }
        });
    });
};

const _calculateBoundingBox = (geometries: any[]) => {
    var xmin=99999, ymin=99999, xmax=-99999, ymax=-99999;
    geometries.forEach((geometry) => {
        let coords_list = geometry.coordinates;
        if(geometry.type == "MultiPolygon") {
            coords_list = coords_list.flat(1);
        }

        coords_list.map((coords: any) => {
            coords.map((c: any) => {
                if(c[0] < xmin)
                    xmin = c[0];
                if(c[1] < ymin)
                    ymin = c[1];
                if(c[0] > xmax)
                    xmax = c[0];
                if(c[1] > ymax)
                    ymax = c[1];
            })
        })
    });

    return {
      xmin: xmin-0.01, 
      ymin: ymin-0.01, 
      xmax: xmax+0.01, 
      ymax: ymax+0.01
    } as BoundingBox;
}