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
import executionIdsForThreadGQL from './queries/execution/executionids-for-thread.graphql';
import listExecutionsListGQL from './queries/execution/list.graphql';

import { problemStatementFromGQL, taskFromGQL, threadFromGQL, 
    threadInfoFromGQL,
    executionFromGQL} from './graphql_adapter';
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

export const setThreadExecutionIds = (thread_id: string, modelid: string, executionids: string[]) : Promise<void> => {
    // TODO
    return null;
}

export const deleteAllThreadExecutionIds = async (thread_id: string, modelid: string) => {
    // TODO
}

export const getAllThreadExecutionIds = async (thread_id: string, modelid: string) : Promise<string[]> => {
    return APOLLO_CLIENT.query({
        query: executionIdsForThreadGQL,
        variables: {
            id: thread_id,
            modelId: modelid
        }
    }).then((result) => {
        if(result.errors && result.errors.length > 0) {
            console.log("ERROR");
            console.log(result);
        }
        else {
            if(result.data.thread_by_pk.thread_models.length > 0)
                return result.data.thread_by_pk.thread_models[0].executions.map((ex:any) => ex.execution_id);
        }
        return null;        
    });
}

// Update Thread Executions
export const setThreadExecutions = (executions: Execution[]) => {
    /*
    let executionsRef = db.collection("executions");
    let batch = db.batch();
    let i = 0;
    executions.map((execution) => {
        batch.update(executionsRef.doc(execution.id), execution);
    })
    return batch.commit();*/
}

// Add Executions
export const addThreadExecutions = (executions: Execution[]) => {
    /*
    let executionsRef = db.collection("executions");
    // Read all docs (to check if they exist or not)
    let readpromises = [];
    executions.map((execution) => {
        readpromises.push(executionsRef.doc(execution.id).get());
    });
    let batch = db.batch();
    let i = 0;
    return Promise.all(readpromises).then((docs) => {
        docs.map((curdoc: firebase.firestore.DocumentSnapshot) => {
            // If doc doesn't exist, write execution
            let execution = executions[i++];
            //if(!curdoc.exists)
            batch.set(curdoc.ref, execution);
        })
        return batch.commit();
    })*/
}

/* Execution Functions */

// List Executions
export const listExecutions = (executionids: string[]) : Promise<Execution[]> => {
    return APOLLO_CLIENT.query({
        query: listExecutionsListGQL,
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
export const getModelInputConfigurations = (
        threadModel: ThreadModelMap,
        inputIds: string[]) => {
    let dataExecution = threadModel.bindings;
    let inputBindings : any[] = [];
    let totalproducts = 1;
    inputIds.map((inputid) => {
        inputBindings.push(dataExecution[inputid]);
        if(dataExecution[inputid])
            totalproducts *= dataExecution[inputid].length;
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
            // Expand a dataset to it's constituent resources
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


// List Execution Ids (i.e. which execution ids exist)
export const listExistingExecutionIds = (executionids: string[]) : Promise<string[]> => {
    // TODO
    return null;
};

// List Execution Ids (i.e. which execution ids exist)
export const successfulExecutionIds = (executionids: string[]) : Promise<string[]> => {
    // TODO
    return null;
};

// Update Thread Executions
export const updateThreadExecutions = (executions: Execution[]) => {
    // TODO
}

// Delete Thread Executions
export const deleteThreadExecutions = (executionids: string[]) => {
    // TODO
}

// Region information

// Get details about a particular region/subregion
export const getRegionDetails = (regionid: string, subregionid: string) => {
    // TODO
};

export const updateThreadExecutionStatus = (execution: Execution) => {
    // TODO: Update Execution ? run_progress, status, results ?
};

export const saveExecution = (execution: Execution) => {
    // TODO: Update Execution
};


// ProblemStatement/Task/Thread editing

// Update Thread Execution Summary
export const updateThreadExecutionSummary = (threadid: string, modelid: string, summary: ExecutionSummary) =>  {
    // TODO
};

// Increment thread successful runs
export const incrementThreadSuccessfulRuns = (problem_statement_id: string, threadid: string, modelid: string) =>  {
    // TODO
};

// Increment thread failed runs
export const incrementThreadFailedRuns = (problem_statement_id: string, threadid: string, modelid: string) =>  {
    // TODO
};