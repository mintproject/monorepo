import { Task, Thread, ProblemStatementInfo, ProblemStatement, ThreadInfo, MintEvent, ModelEnsembleMap, 
    ModelIOBindings, Execution, ExecutionSummary, DataMap, ThreadModelMap, Dataslice, ModelIO, Dataset, Model, ModelParameter, DataResource } from "../mint/mint-types"

import * as crypto from 'crypto';
import { Region } from "../mint/mint-types";

export const regionFromGQL = (regionobj: any) : Region => {
    let region = {
        id: regionobj.id,
        name: regionobj.name,
        category_id: regionobj.category_id,
        geometries: regionobj.geometries.map((geoobj: any) => geoobj["geometry"]),
        model_catalog_uri: regionobj.model_catalog_uri
    } as Region;
    return region;
}

export const eventFromGQL = (eventobj: any) : MintEvent => {
    let event = {
        event: eventobj.event,
        userid: eventobj.userid,
        timestamp: new Date(eventobj.timestamp),
        notes: eventobj.notes
    } as MintEvent;
    return event;
}

export const problemStatementFromGQL = (problem: any) : ProblemStatement => {
    let details = {
        id : problem["id"],
        regionid: problem["region_id"],
        name: problem["name"],
        dates: {
            start_date: new Date(problem["start_date"]),
            end_date: new Date(problem["end_date"])
        },
        events: problem["events"].map(eventFromGQL),
        tasks: {}
    } as ProblemStatement;
    if(problem["tasks"]) {
        problem["tasks"].forEach((task:any) => {
            let fbtask = taskFromGQL(task);
            fbtask.problem_statement_id = problem["id"];
            details.tasks[fbtask.id] = fbtask;
        })
    }
    return details;
}

export const taskFromGQL = (task: any) : Task => {
    let taskobj = {
        id : task["id"],
        problem_statement_id: task["problem_statement_id"],
        regionid: task["region_id"],
        name: task["name"],
        dates: {
            start_date: new Date(task["start_date"]),
            end_date: new Date(task["end_date"])
        },
        threads: {},
        driving_variables: task.driving_variable_id != null ? [task.driving_variable_id] : [],
        response_variables: task.response_variable_id != null ? [task.response_variable_id] : [],
        events: task["events"].map(eventFromGQL),
    } as Task;
    if(task["threads"]) {
        task["threads"].forEach((thread:any) => {
            let fbthread = threadInfoFromGQL(thread);
            fbthread.task_id = task["id"];
            taskobj.threads[fbthread.id] = fbthread;
        });
    }
    return taskobj;
}

export const threadInfoFromGQL = (thread: any) => {
    return {
        id : thread["id"],
        name: thread["name"],
        dates: {
            start_date: new Date(thread["start_date"]),
            end_date: new Date(thread["end_date"])
        },
        regionid: thread["region_id"],
        driving_variables: thread.driving_variable_id != null ? [thread.driving_variable_id] : [],
        response_variables: thread.response_variable_id != null ? [thread.response_variable_id] : [],
        events: thread["events"].map(eventFromGQL),
    } as ThreadInfo;
}

export const threadFromGQL = (thread: any) => {
    let fbthread = {
        id : thread["id"],
        task_id: thread["task_id"],
        regionid: thread["region_id"],
        name: thread["name"],
        dates: {
            start_date: new Date(thread["start_date"]),
            end_date: new Date(thread["end_date"])
        },
        driving_variables: thread.driving_variable_id != null ? [thread.driving_variable_id] : [],
        response_variables: thread.response_variable_id != null ? [thread.response_variable_id] : [],
        execution_summary: {},
        events: thread["events"].map(eventFromGQL),
        models: {},
        data: {},
        model_ensembles: {}
    } as Thread;
    
    thread["thread_data"].forEach((tm:any) => {
        let m = tm["dataslice"];
        let dataslice : Dataslice = dataFromGQL(m);
        fbthread.data[dataslice.id] = dataslice;
    })

    thread["thread_models"].forEach((tm:any) => {
        let m = tm["model"];
        let model : Model = modelFromGQL(m);

        fbthread.models[model.id] = model;
        let model_ensemble = modelEnsembleFromGQL(tm["data_bindings"], tm["parameter_bindings"]);
        fbthread.model_ensembles[model.id] = {
            id: tm["id"],
            bindings: model_ensemble
        }

        tm["execution_summary"].forEach((tmex: any) => {
            fbthread.execution_summary[model.id] = {
                total_runs: tmex["total_runs"],
                submitted_runs: tmex["submitted_runs"],
                successful_runs: tmex["successful_runs"],
                failed_runs: tmex["failed_runs"],
                ingested_runs: tmex["ingested_runs"],
                registered_runs: tmex["registered_runs"],
                published_runs: tmex["published_runs"],
                submission_time: tmex["submission_time"],
                submitted_for_execution: tmex["submitted_for_execution"],
                fetched_run_outputs: tmex["fetched_run_outputs"],
                submitted_for_ingestion: tmex["submitted_for_ingestion"],
                submitted_for_publishing: tmex["submitted_for_publishing"],
                submitted_for_registration: tmex["submitted_for_registration"]
            } as ExecutionSummary
        });
    })
    return fbthread;
}

export const getTotalConfigs = (model: Model, bindings: ModelIOBindings, thread: Thread) => {
    let totalconfigs = 1;
    model.input_files.map((io) => {
        if(!io.value) {
            // Expand a dataset to it's constituent resources
            // FIXME: Create a collection if the model input has dimensionality of 1
            if(bindings[io.id]) {
                let nensemble : any[] = [];
                bindings[io.id].map((dsid) => {
                    let ds = thread.data[dsid];
                    let selected_resources = ds.resources.filter((res) => res.selected);
                    // Fix for older saved resources
                    if(selected_resources.length == 0) 
                        selected_resources = ds.resources;
                    nensemble = nensemble.concat(selected_resources);
                });
                totalconfigs *= nensemble.length;
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

export const dataFromGQL = (d: any) => {
    let ds = d["dataset"];
    return {
        id: d["id"],
        name: ds["name"],
        resources: d["resources"].map((resobj:any) => {
            let res = resourceFromGQL(resobj["resource"]);
            res.selected = resobj["selected"];
            return res;
        }),
        time_period: {
            start_date: ds["start_date"],
            end_date: ds["end_date"]
        },
        resource_count: d["resources"].length,
        dataset: {
            id: ds["id"],
            name: ds["name"]
        } as Dataset
    } as Dataslice;
}

export const modelFromGQL = (mobj: any) => {
    let m = Object.assign({}, mobj);
    m["input_files"] = (m["inputs"] as any[]).map((input) => {
        return modelIOFromGQL(input);
    });
    delete m["inputs"];
    m["output_files"] = (m["outputs"] as any[]).map((output) => {
        return modelIOFromGQL(output);
    });
    delete m["outputs"];
    m["input_parameters"] = (m["parameters"] as any[]).map((parameter) => {
        return modelParameterFromGQL(parameter);
    });
    delete m["parameters"];
    return m;
}

export const modelIOFromGQL = (model_io: any) => {
    let io = model_io["model_io"];
    let fixed_ds = (io["fixed_bindings"] && io["fixed_bindings"].length > 0) ? 
        {
            id: io.id + "_fixed_dataset",
            name: io.name + "_fixed_dataset",
            resources: io["fixed_bindings"].map((res:any) => {
                return res["resource"]
            })
        } as Dataslice
        : null;
    return {
        id: io["id"],
        name: io["name"],
        type: io["type"],
        value: fixed_ds,
        position: model_io["position"],
        variables: io["variables"].map((varobj:any) => {
            let v = varobj["variable"];
            return v["id"];
        })
    } as ModelIO
}

export const modelParameterFromGQL = (p: any) => {
    return {
        id: p["id"],
        name: p["name"],
        type: p["type"],
        accepted_values: p["accepted_values"],
        adjustment_variable: p["adjustment_variable"],
        default: p["default"],
        description: p["description"],
        max: p["max"],
        min: p["min"],
        unit: p["unit"],
        value: p["fixed_value"],
        position: p["position"]
    } as ModelParameter
}

export const modelEnsembleFromGQL = (dbs: any[], pbs: any[]): ModelIOBindings => {
    let bindings = {} as ModelIOBindings;
    dbs.forEach((db) => {
        let binding = bindings[db["model_io"]["id"]];
        if(!binding)
            binding = [];
        binding.push(db["dataslice_id"]);
        bindings[db["model_io"]["id"]] = binding;
    })
    pbs.forEach((pb) => {
        let binding = bindings[pb["model_parameter"]["id"]];
        if(!binding)
            binding = [];
        binding.push(pb["parameter_value"]);
        bindings[pb["model_parameter"]["id"]] = binding;        
    })
    return bindings;
}

export const toDateString = (date: Date) : string => {
    if(!date)
        return null;
    let dateString = typeof(date) == "string" ? date : date.toISOString();
    return dateString.split('T')[0]
}

export const toDateTimeString = (date: Date) : string => {
    if(!date)
        return null;
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

export const getDates = (dates:any) => {
    let start = dates["start_date"]
    let end = dates["end_date"]
    return {
        "start_date" : toDateString(start),
        "end_date": toDateString(end)
    }
}

export const getResourceData = (data:any) => {
    let dates = getDates(data["time_period"])
    return {
        "data": {
            "id": getMd5Hash(data["url"]),
            "dcid": data["id"],
            "name": data["name"],
            "spatial_coverage": data["spatial_coverage"],
            "start_date": dates?.start_date,
            "end_date": dates?.end_date,
            "url": data["url"]
        },
        "on_conflict": {
            "constraint": "resource_pkey",
            "update_columns": ["id"]
        }
    }
}

export const executionResultsToGQL = (results: any) => {
    let data: any = [];
    Object.keys(results).forEach((outid) => {
        let result = results[outid];
        data.push({
            model_io_id: outid,
            resource: getResourceData(result)
        });
    })
    return data;
}

export const executionToGQL = (ex: Execution) : any => {
    let exobj = {
        id: ex.id,
        model_id: ex.modelid,
        status: ex.status,
        start_time: ex.start_time,
        execution_engine: ex.execution_engine,
        run_progress: ex.run_progress,
        run_id: ex.runid,
        parameter_bindings: {
            data: [] as any
        },
        data_bindings: {
            data: [] as any
        },
        results: {
            data: [] as any
        }
    }
    Object.keys(ex.bindings).forEach((ioid) => {
        let binding = ex.bindings[ioid];
        if (typeof(binding) == 'string') {
            exobj.parameter_bindings.data.push({
                model_parameter_id: ioid,
                parameter_value: binding+"",
            })
        }
        else {
            exobj.data_bindings.data.push({
                model_io_id: ioid,
                resource_id: binding["id"]
            })
        }
    })
    exobj.results.data = executionResultsToGQL(ex.results);
    return exobj;
}

export const executionFromGQL = (ex: any) : Execution => {
    let exobj = {
        id: ex.id,
        modelid: ex.model_id,
        status: ex.status,
        start_time: ex.start_time,
        end_time: ex.end_time,
        execution_engine: ex.execution_engine,
        run_progress: ex.run_progress,
        runid: ex.run_id,
        bindings: {},
        results: {}
    } as Execution;
    ex.parameter_bindings.forEach((param:any) => {
        exobj.bindings[param.model_parameter_id] = param.parameter_value;
    });
    ex.data_bindings.forEach((data:any) => {
        exobj.bindings[data.model_io_id] = data.resource as DataResource;
    });
    ex.results.forEach((data:any) => {
        exobj.results[data.model_output_id] = data.resource as DataResource;
    });
    return exobj;
}

export const resourceToGQL = (resource: DataResource) => {
    let resourceobj = {
        id: resource.id,
        name: resource.name,
        url: resource.url,
        start_date: resource.time_period?.start_date,
        end_date: resource.time_period?.end_date
    };
    return resourceobj;
}

export const resourceFromGQL = (resourceobj: any) : DataResource => {
    let resource = {
        id: resourceobj.id,
        name: resourceobj.name,
        url: resourceobj.url,
        spatial_coverage: resourceobj.spatial_coverage,
        time_period: {
            start_date: new Date(resourceobj.start_date),
            end_date: new Date(resourceobj.end_date)
        }
    } as DataResource;
    return resource;
}

export const getAutoID = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let autoId = ''
    for (let i = 0; i < 20; i++) {
      autoId += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return autoId;
}

const getMd5Hash = (str2hash: string) => {
    return crypto.createHash('md5').update(str2hash).digest("hex");
}


export const executionSummaryToGQL = (summary: ExecutionSummary) => {
    let exobj = Object.assign({}, summary) as any;
    exobj["submission_time"] = toDateTimeString(summary.submission_time);
    return exobj;
}

export const executionSummaryFromGQL = (summary: any) : ExecutionSummary => {
    let exobj = Object.assign({}, summary) as ExecutionSummary;
    return exobj;
}