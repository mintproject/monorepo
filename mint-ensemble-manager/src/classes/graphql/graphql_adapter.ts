import {
    Task,
    Thread,
    ProblemStatementInfo,
    ProblemStatement,
    ThreadInfo,
    MintEvent,
    ModelEnsembleMap,
    ModelIOBindings,
    Execution,
    ExecutionSummary,
    DataMap,
    ThreadModelMap,
    Dataslice,
    ModelIO,
    Dataset,
    Model,
    ModelParameter,
    DataResource,
    Variable,
    MintPermission,
    Execution_Result,
    Region
} from "@/classes/mint/mint-types";

import * as crypto from "crypto";
import { KeycloakAdapter } from "@/config/keycloak-adapter";

export const uuidv4 = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

export const fromTimestampIntegerToString = (timestamp: number): string => {
    return new Date(timestamp).toISOString().replace(/\.000Z$/, "");
};

export const fromTimestampIntegerToReadableString = (timestamp: number): string => {
    return fromTimestampIntegerToString(timestamp).replace(/T/, " at ").replace(/\..+$/, "");
};

export const fromTimestampIntegerToDateString = (timestamp: number): string => {
    return fromTimestampIntegerToString(timestamp).replace(/T.*$/, "");
};

export const toDateString = (date: Date): string => {
    if (!date) return null;
    if (typeof date === "string") {
        return (date + "").split("T")[0];
    }
    return date.toISOString().split("T")[0];
};

export const toDateTimeString = (date: Date): string => {
    if (!date) return null;
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
};

export const regionToGQL = (region: Region) => {
    const regionobj = {
        name: region.name,
        category_id: region.category_id,
        geometries: {
            data: region.geometries.map((geom) => {
                return { geometry: geom };
            })
        },
        model_catalog_uri: region.model_catalog_uri
    };
    if (!region.id) regionobj["id"] = getAutoID();

    return regionobj;
};

export const regionFromGQL = (regionobj: any): Region => {
    const region = {
        id: regionobj.id,
        name: regionobj.name,
        category_id: regionobj.category_id,
        geometries: (regionobj.geometries ?? []).map((geoobj) => geoobj["geometry"]),
        model_catalog_uri: regionobj.model_catalog_uri
    } as Region;
    return region;
};

export const variableFromGQL = (varobj: any) => {
    const variable = {
        id: varobj.id,
        name: varobj.name,
        categories: (varobj.categories ?? []).map((catobj) => catobj["category"]),
        is_adjustment_variable: varobj.is_adjustment_variable,
        is_indicator: varobj.is_indicator,
        description: varobj.description,
        intervention: varobj.intervention
    } as Variable;
    return variable;
};

export const eventToGQL = (event: MintEvent) => {
    const eventobj = {
        event: event.event,
        userid: event.userid,
        timestamp: event.timestamp.toISOString(),
        notes: event.notes
    };
    return eventobj;
};

export const eventFromGQL = (eventobj: any): MintEvent => {
    const event = {
        event: eventobj.event,
        userid: eventobj.userid,
        timestamp: new Date(eventobj.timestamp),
        notes: eventobj.notes
    } as MintEvent;
    return event;
};

export const permissionFromGQL = (permobj: any): MintPermission => {
    const permission = {
        userid: permobj.user_id,
        read: permobj.read ?? false,
        write: permobj.write ?? false,
        execute: permobj?.execute ?? false
    } as MintPermission;
    return permission;
};

export const permissionToGQL = (permission: MintPermission) => {
    const permissionobj = {
        user_id: permission.userid,
        read: permission.read ?? false,
        write: permission.write ?? false
    };
    return permissionobj;
};

export const problemStatementToGQL = (problem_statement: ProblemStatementInfo) => {
    const problemobj = {
        id: getAutoID(),
        name: problem_statement.name,
        start_date: toDateString(problem_statement.dates.start_date),
        end_date: toDateString(problem_statement.dates.end_date),
        region_id: problem_statement.regionid,
        events: {
            data: problem_statement.events.map(eventToGQL)
        },
        permissions: {
            data: (problem_statement.permissions || []).map(permissionToGQL),
            on_conflict: {
                constraint: "problem_statement_permission_pkey",
                update_columns: ["read", "write"]
            }
        }
    };
    return problemobj;
};

export const problemStatementUpdateToGQL = (problem_statement: ProblemStatementInfo) => {
    const problemobj = {
        id: problem_statement.id,
        name: problem_statement.name,
        start_date: toDateString(problem_statement.dates.start_date),
        end_date: toDateString(problem_statement.dates.end_date),
        region_id: problem_statement.regionid,
        events: {
            data: problem_statement.events.map(eventToGQL)
        },
        permissions: {
            data: (problem_statement.permissions || []).map(permissionToGQL),
            on_conflict: {
                constraint: "problem_statement_permission_pkey",
                update_columns: ["read", "write"]
            }
        }
    };
    return problemobj;
};

export const problemStatementFromGQL = (problem: any): ProblemStatement => {
    const details = {
        id: problem["id"],
        name: problem["name"],
        dates: {
            start_date: new Date(problem["start_date"]),
            end_date: new Date(problem["end_date"])
        },
        events: "events" in problem ? problem["events"].map(eventFromGQL) : [],
        permissions: "permissions" in problem ? problem["permissions"].map(permissionFromGQL) : [],
        tasks: {},
        preview: problem["preview"]
    } as ProblemStatement;
    if (problem["tasks"] && problem["tasks"].length > 0) {
        problem["tasks"].forEach((task: any) => {
            const fbtask = taskFromGQL(task);
            fbtask.problem_statement_id = problem["id"];
            details.tasks[fbtask.id] = fbtask;
        });
    }
    return details;
};

export const taskToGQL = (task: Task, problem_statement: ProblemStatementInfo) => {
    const taskGQL = {
        id: getAutoID(),
        name: task.name,
        problem_statement_id: problem_statement.id,
        start_date: toDateString(task.dates.start_date),
        end_date: toDateString(task.dates.end_date),
        region_id: task.regionid,
        response_variable_id: task.response_variables[0],
        driving_variable_id: task.driving_variables.length > 0 ? task.driving_variables[0] : null,
        events: {
            data: task.events.map(eventToGQL)
        },
        permissions: {
            data: (task.permissions || []).map(permissionToGQL),
            on_conflict: {
                constraint: "task_permission_pkey",
                update_columns: ["read", "write"]
            }
        }
    };
    return taskGQL;
};

export const taskUpdateToGQL = (task: Task) => {
    const taskGQL = {
        id: task.id,
        name: task.name,
        problem_statement_id: task.problem_statement_id,
        start_date: toDateString(task.dates.start_date),
        end_date: toDateString(task.dates.end_date),
        region_id: task.regionid,
        response_variable_id: task.response_variables[0],
        driving_variable_id: task.driving_variables.length > 0 ? task.driving_variables[0] : null,
        events: {
            data: task.events.map(eventToGQL)
        },
        permissions: {
            data: (task.permissions || []).map(permissionToGQL),
            on_conflict: {
                constraint: "task_permission_pkey",
                update_columns: ["read", "write"]
            }
        }
    };

    return taskGQL;
};

export const taskFromGQL = (task: any): Task => {
    const taskobj = {
        id: task["id"],
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
        events: "events" in task ? task["events"].map(eventFromGQL) : [],
        permissions: "permissions" in task ? task["permissions"].map(permissionFromGQL) : []
    } as Task;
    if (task["threads"]) {
        task["threads"].forEach((thread: any) => {
            const fbthread = threadInfoFromGQL(thread);
            fbthread.task_id = task["id"];
            taskobj.threads[fbthread.id] = fbthread;
        });
    }
    return taskobj;
};

export const threadInfoToGQL = (thread: ThreadInfo, taskid: string, regionid: string) => {
    const threadobj = {
        id: getAutoID(),
        name: thread.name,
        task_id: taskid,
        start_date: toDateString(thread.dates.start_date),
        end_date: toDateString(thread.dates.end_date),
        region_id: regionid,
        response_variable_id: thread.response_variables[0],
        driving_variable_id:
            thread.driving_variables.length > 0 ? thread.driving_variables[0] : null,
        events: {
            data: thread.events.map(eventToGQL)
        },
        permissions: {
            data: (thread.permissions || []).map(permissionToGQL),
            on_conflict: {
                constraint: "thread_permission_pkey",
                update_columns: ["read", "write"]
            }
        }
    };
    return threadobj;
};

export const threadInfoUpdateToGQL = (thread: ThreadInfo) => {
    const threadobj = {
        id: thread.id,
        task_id: thread.task_id,
        name: thread.name,
        start_date: toDateString(thread.dates.start_date),
        end_date: toDateString(thread.dates.end_date),
        response_variable_id: thread.response_variables[0],
        driving_variable_id:
            thread.driving_variables.length > 0 ? thread.driving_variables[0] : null,
        events: {
            data: thread.events.map(eventToGQL)
        },
        permissions: {
            data: (thread.permissions || []).map(permissionToGQL),
            on_conflict: {
                constraint: "thread_permission_pkey",
                update_columns: ["read", "write"]
            }
        }
    };
    return threadobj;
};

export const threadInfoFromGQL = (thread: any) => {
    return {
        id: thread["id"],
        name: thread["name"],
        dates: {
            start_date: new Date(thread["start_date"]),
            end_date: new Date(thread["end_date"])
        },
        regionid: thread["region_id"],
        driving_variables: thread.driving_variable_id != null ? [thread.driving_variable_id] : [],
        response_variables:
            thread.response_variable_id != null ? [thread.response_variable_id] : [],
        events: "events" in thread ? thread["events"].map(eventFromGQL) : [],
        permissions: "permissions" in thread ? thread["permissions"].map(permissionFromGQL) : []
    } as ThreadInfo;
};

export const threadFromGQL = (thread: any) => {
    const fbthread = {
        id: thread["id"],
        task_id: thread["task_id"],
        regionid: thread["region_id"],
        name: thread["name"],
        dates: {
            start_date: new Date(thread["start_date"]),
            end_date: new Date(thread["end_date"])
        },
        driving_variables: thread.driving_variable_id != null ? [thread.driving_variable_id] : [],
        response_variables:
            thread.response_variable_id != null ? [thread.response_variable_id] : [],
        execution_summary: {},
        events: thread["events"].map(eventFromGQL),
        models: {},
        data: {},
        model_ensembles: {}
    } as Thread;

    thread["thread_data"].forEach((tm: any) => {
        const m = tm["dataslice"];
        const dataslice: Dataslice = datasliceFromGQL(m);
        fbthread.data[dataslice.id] = dataslice;
    });

    thread["thread_models"].forEach((tm: any) => {
        const m = tm["model"];
        const model: Model = modelFromGQL(m);

        fbthread.models[model.id] = model;
        const model_ensemble = modelEnsembleFromGQL(tm["data_bindings"], tm["parameter_bindings"]);
        fbthread.model_ensembles[model.id] = {
            id: tm["id"],
            bindings: model_ensemble
        };

        (tm["execution_summary"] ?? []).forEach((tmex) => {
            fbthread.execution_summary[model.id] = threadModelExecutionSummaryFromGQL(tmex);
            // Set summary changed to true, to load the executions initially
            //fbthread.execution_summary[model.id].changed = true;
        });
    });
    return fbthread;
};

export const threadModelExecutionSummaryFromGQL = (tmex: any) => {
    return {
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
    } as ExecutionSummary;
};

export const threadModelsToGQL = (models: Model[], threadid: string) => {
    return models.map((model) => {
        return {
            thread_id: threadid,
            model: {
                data: modelToGQL(model),
                on_conflict: {
                    constraint: "model_pkey",
                    update_columns: ["name"]
                }
            }
        };
    });
};

export const getTotalConfigs = (model: Model, bindings: ModelIOBindings, thread: Thread) => {
    let totalconfigs = 1;
    model.input_files.map((io) => {
        if (!io.value) {
            // Expand a dataset to it's constituent resources
            // FIXME: Create a collection if the model input has dimensionality of 1
            if (bindings[io.id]) {
                let numresources = 0;
                bindings[io.id].map((dsid) => {
                    const ds = thread.data[dsid];
                    numresources += ds.selected_resources;
                });
                totalconfigs *= numresources;
            }
        } else {
            totalconfigs *= (io.value.resources as any[]).length;
        }
    });

    // Add adjustable parameters to the input ids
    model.input_parameters.map((io) => {
        if (!io.value) totalconfigs *= bindings[io.id].length;
    });

    return totalconfigs;
};

export const datasliceFromGQL = (d: any) => {
    const ds = d["dataset"];
    return {
        id: d["id"],
        name: ds["name"],
        total_resources: d["total_resources"]?.aggregate?.count ?? 0,
        selected_resources: d["selected_resources"]?.aggregate?.count ?? 0,
        resources: (d["resources"] ?? []).map((resobj: any) => {
            const res = resourceFromGQL(resobj["resource"]);
            res.selected = resobj["selected"];
            return res;
        }),
        resources_loaded: d["resources"]?.length > 0 ? true : false,
        time_period: {
            start_date: ds["start_date"],
            end_date: ds["end_date"]
        },
        resource_count: ds["resource_count"],
        dataset: {
            id: ds["id"],
            name: ds["name"]
        } as Dataset
    } as Dataslice;
};

export const modelFromGQL = (m: any) => {
    m = Object.assign({}, m);
    m.input_files = (m["inputs"] as any[]).map((input) => {
        return modelIOFromGQL(input);
    });
    delete m["inputs"];
    m.output_files = (m["outputs"] as any[]).map((output) => {
        return modelIOFromGQL(output);
    });
    delete m["outputs"];
    m.input_parameters = (m["parameters"] as any[]).map((parameter) => {
        return modelParameterFromGQL(parameter);
    });
    delete m["parameters"];
    return m;
};

export const modelIOFromGQL = (model_io: any) => {
    const io = model_io["model_io"];
    const fixed_ds =
        io["fixed_bindings"] && io["fixed_bindings"].length > 0
            ? ({
                  id: io.id + "_fixed_dataset",
                  name: io.name + "_fixed_dataset",
                  resources: io["fixed_bindings"].map((res: any) => {
                      return res["resource"];
                  })
              } as Dataslice)
            : null;
    return {
        id: io["id"],
        name: io["name"],
        type: io["type"],
        value: fixed_ds,
        position: model_io["position"],
        variables: io["variables"].map((varobj: any) => {
            const v = varobj["variable"];
            return v["id"];
        })
    } as ModelIO;
};

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
    } as ModelParameter;
};

export const modelEnsembleFromGQL = (dbs: any[], pbs: any[]): ModelIOBindings => {
    const bindings = {} as ModelIOBindings;
    dbs.forEach((db) => {
        let binding = bindings[db["model_io"]["id"]];
        if (!binding) binding = [];
        binding.push(db["dataslice_id"]);
        bindings[db["model_io"]["id"]] = binding;
    });
    pbs.forEach((pb) => {
        let binding = bindings[pb["model_parameter"]["id"]];
        if (!binding) binding = [];
        binding.push(pb["parameter_value"]);
        bindings[pb["model_parameter"]["id"]] = binding;
    });
    return bindings;
};

export const executionToGQL = (ex: Execution): any => {
    const exobj = {
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
    };
    Object.keys(ex.bindings).forEach((ioid) => {
        const binding = ex.bindings[ioid];
        if (typeof binding == "string") {
            exobj.parameter_bindings.data.push({
                model_parameter_id: ioid,
                parameter_value: binding + ""
            });
        } else {
            exobj.data_bindings.data.push({
                model_io_id: ioid,
                resource_id: binding["id"]
            });
        }
    });
    exobj.results.data = executionResultsToGQL(ex.results);
    return exobj;
};

export const executionFromGQL = (ex: any, emulator = false): Execution => {
    const exobj = {
        id: ex.id.replace(/\-/g, ""),
        modelid: ex.model_id,
        status: ex.status,
        start_time: new Date(ex.start_time),
        end_time: ex.end_time ? new Date(ex.end_time) : null,
        execution_engine: ex.execution_engine,
        run_progress: ex.run_progress,
        runid: ex.run_id,
        bindings: {},
        results: {}
    } as Execution;
    ex.parameter_bindings.forEach((param: any) => {
        exobj.bindings[emulator ? param.model_parameter.name : param.model_parameter_id] =
            param.parameter_value;
    });
    ex.data_bindings.forEach((data: any) => {
        exobj.bindings[emulator ? data.model_io.name : data.model_io_id] =
            data.resource as DataResource;
    });
    ex.results.forEach((data: any) => {
        exobj.results[emulator ? data.model_output.name : data.model_io_id] =
            data.resource as DataResource;
    });
    return exobj;
};

export const resourceToGQL = (resource: DataResource) => {
    const resourceobj = {
        id: resource.id,
        name: resource.name,
        url: resource.url,
        start_date: resource.time_period?.start_date,
        end_date: resource.time_period?.end_date
    };
    return resourceobj;
};

export const resourceFromGQL = (resourceobj: any): DataResource => {
    const resource = {
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
};

export const getCreateEvent = (notes: string) => {
    return {
        event: "CREATE",
        timestamp: new Date(),
        userid: KeycloakAdapter.getUser().email,
        notes: notes
    } as MintEvent;
};

export const getUpdateEvent = (notes: string) => {
    return {
        event: "UPDATE",
        timestamp: new Date(),
        userid: KeycloakAdapter.getUser().email,
        notes: notes
    } as MintEvent;
};

export const getCustomEvent = (event: string, notes: string) => {
    return {
        event: event,
        timestamp: new Date(),
        userid: KeycloakAdapter.getUser().email,
        notes: notes
    } as MintEvent;
};

const getNamespacedId = (namespace, id) => {
    if (id.indexOf(namespace) == 0) return id;
    return namespace + id;
};

export const modelToGQL = (m: Model) => {
    const namespace = m.id.replace(/(^.*\/).*$/, "$1");
    return {
        id: m.id,
        name: m.name,
        category: m.category,
        description: m.description,
        region_name: m.region_name,
        type: m.model_type,
        model_configuration: getNamespacedId(namespace, m.model_configuration),
        model_version: getNamespacedId(namespace, m.model_version),
        model_name: getNamespacedId(namespace, m.model_name),
        dimensionality: m.dimensionality,
        parameter_assignment: m.parameter_assignment,
        parameter_assignment_details: m.parameter_assignment_details,
        calibration_target_variable: m.calibration_target_variable,
        spatial_grid_resolution: m.spatial_grid_resolution,
        spatial_grid_type: m.spatial_grid_type,
        output_time_interval: m.output_time_interval,
        code_url: m.code_url,
        usage_notes: m.usage_notes,
        software_image: m.software_image,
        inputs: {
            data: m.input_files.map((input) => modelInputOutputToGQL(input)),
            on_conflict: {
                constraint: "model_input_pkey",
                update_columns: ["model_id"]
            }
        },
        parameters: {
            data: m.input_parameters.map((param) => modelParameterToGQL(param)),
            on_conflict: {
                constraint: "model_parameter_pkey",
                update_columns: ["model_id"]
            }
        },
        outputs: {
            data: m.output_files.map((output) => modelInputOutputToGQL(output)),
            on_conflict: {
                constraint: "model_output_pkey",
                update_columns: ["model_id"]
            }
        }
    };
};

export const getAutoID = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let autoId = "";
    for (let i = 0; i < 20; i++) {
        autoId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return autoId;
};

export const getMd5Hash = (str2hash) => {
    return crypto.createHash("md5").update(str2hash).digest("hex");
};

const getModelIOFixedBindings = (io) => {
    const fixed_bindings_data = [];
    if ("value" in io && "resources" in io["value"]) {
        io["value"]["resources"].forEach((res: any) => {
            if (!("name" in res)) res["name"] = res["url"].replace(/^.*\/(.*?)$/, "$1");
            fixed_bindings_data.push({
                resource: {
                    data: {
                        id: getMd5Hash(res["url"]),
                        name: res["name"],
                        url: res["url"]
                    },
                    on_conflict: {
                        constraint: "resource_pkey",
                        update_columns: ["name"]
                    }
                }
            });
        });
    }
    return {
        data: fixed_bindings_data,
        on_conflict: {
            constraint: "model_input_bindings_pkey",
            update_columns: ["resource_id"]
        }
    };
};

const getVariableData = (variableid) => {
    return {
        data: {
            id: variableid
        },
        on_conflict: {
            constraint: "variable_pkey",
            update_columns: ["description"]
        }
    };
};

const modelIOToGQL = (io: any) => {
    const fixed_bindings = getModelIOFixedBindings(io);
    return {
        id: io["id"],
        name: io["name"],
        type: io["type"],
        format: io["format"],
        fixed_bindings: fixed_bindings,
        variables: {
            data: io["variables"].map((v) => {
                return {
                    variable: getVariableData(v)
                };
            }),
            on_conflict: {
                constraint: "model_io_variable_pkey",
                update_columns: ["variable_id"]
            }
        }
    };
};

const modelInputOutputToGQL = (io: any) => {
    return {
        position: io["position"],
        model_io: {
            data: modelIOToGQL(io),
            on_conflict: {
                constraint: "model_io_pkey",
                update_columns: ["id"]
            }
        }
    };
};

const modelParameterToGQL = (input: ModelParameter) => {
    if ("default" in input && input["default"]) input["default"] = input["default"] + "";
    if ("value" in input && input["value"]) input["fixed_value"] = input["value"] + "";
    delete input["value"];
    return input;
};

const getModelDataBindings = (model, model_ensemble: ThreadModelMap) => {
    const dataBindings = [];
    model["input_files"].forEach((ifile) => {
        const inputid = ifile["id"];
        if (inputid in model_ensemble.bindings) {
            model_ensemble.bindings[inputid].forEach((sliceid) => {
                dataBindings.push({
                    thread_model_id: model_ensemble.id,
                    model_io_id: inputid,
                    dataslice_id: sliceid
                });
            });
        }
    });
    return dataBindings;
};

const getModelParameterBindings = (model, model_ensemble: ThreadModelMap) => {
    const parameterBindings = [];
    model["input_parameters"].forEach((iparam) => {
        const inputid = iparam["id"];
        if (inputid in model_ensemble.bindings) {
            model_ensemble.bindings[inputid].forEach((paramvalue) => {
                parameterBindings.push({
                    thread_model_id: model_ensemble.id,
                    model_parameter_id: inputid,
                    parameter_value: paramvalue + ""
                });
            });
        }
    });
    return parameterBindings;
};

const getSpatialCoverageGeometry = (coverage) => {
    if (!coverage) return null;
    const value = coverage["value"];
    if (coverage["type"] == "Point") {
        return {
            type: "Point",
            coordinates: [parseFloat(value["x"]), parseFloat(value["y"])]
        };
    }
    if (coverage["type"] == "BoundingBox") {
        return {
            type: "Polygon",
            coordinates: [
                [
                    [parseFloat(value["xmin"]), parseFloat(value["ymin"])],
                    [parseFloat(value["xmax"]), parseFloat(value["ymin"])],
                    [parseFloat(value["xmax"]), parseFloat(value["ymax"])],
                    [parseFloat(value["xmin"]), parseFloat(value["ymax"])],
                    [parseFloat(value["xmin"]), parseFloat(value["ymin"])]
                ]
            ]
        };
    }
};

const getDates = (dates) => {
    const start = dates["start_date"];
    const end = dates["end_date"];
    return {
        start_date: toDateString(start),
        end_date: toDateString(end)
    };
};

const getResourceData = (data) => {
    const dates = getDates(data["time_period"]);
    return {
        data: {
            id: getMd5Hash(data["url"]),
            dcid: data["id"],
            name: data["name"],
            spatial_coverage: getSpatialCoverageGeometry(data["spatial_coverage"]),
            start_date: dates?.start_date,
            end_date: dates?.end_date,
            url: data["url"]
        },
        on_conflict: {
            constraint: "resource_pkey",
            update_columns: ["name"]
        }
    };
};

const getDatasliceResourceData = (data) => {
    return {
        resource: getResourceData(data),
        selected: data["selected"] ?? false
    };
};

const getDatasliceData = (data: Dataslice, thread: Thread) => {
    const dsname = data.name;
    const threadname = thread.name;

    const slicename = dsname + " for thread: " + threadname;
    const sliceid = data["id"] ?? uuidv4(); // Change to using md5 hash of sorted resource ids
    return {
        id: sliceid,
        name: slicename,
        region_id: thread.regionid,
        start_date: toDateString(thread.dates?.start_date),
        end_date: toDateString(thread.dates?.end_date),
        resource_count: data.dataset.resource_count,
        dataset: {
            data: {
                id: data.dataset.id,
                name: dsname
            },
            on_conflict: {
                constraint: "dataset_pkey",
                update_columns: ["name"]
            }
        },
        resources: {
            data: data.resources.map((res) => getDatasliceResourceData(res)),
            on_conflict: {
                constraint: "dataslice_resource_pkey",
                update_columns: ["dataslice_id"]
            }
        }
    };
};

const getThreadDataslice = (data: Dataslice, thread: Thread) => {
    return {
        thread_id: thread.id,
        dataslice: {
            data: getDatasliceData(data, thread),
            on_conflict: {
                constraint: "dataslice_pkey",
                update_columns: ["id"]
            }
        }
    };
};

export const threadDataBindingsToGQL = (
    data: DataMap,
    model_ensemble: ModelEnsembleMap,
    thread: Thread
) => {
    const dataslices = [];
    Object.keys(data).map((sliceid) => {
        const dataslice = getThreadDataslice(data[sliceid], thread);
        dataslices.push(dataslice);
    });

    let thread_model_io = [];
    Object.keys(model_ensemble).forEach((modelid) => {
        const model = thread.models[modelid];
        const tmio = getModelDataBindings(model, model_ensemble[modelid]);
        thread_model_io = thread_model_io.concat(tmio);
    });

    return {
        data: dataslices,
        model_io: thread_model_io
    };
};

export const threadParameterBindingsToGQL = (model_ensemble: ModelEnsembleMap, thread: Thread) => {
    let thread_model_params = [];
    Object.keys(model_ensemble).forEach((modelid) => {
        const model = thread.models[modelid];
        const tmparams = getModelParameterBindings(model, model_ensemble[modelid]);
        thread_model_params = thread_model_params.concat(tmparams);
    });
    return thread_model_params;
};

export const executionResultsToGQL = (results: any) => {
    const data: any = [];
    Object.keys(results).forEach((outid) => {
        const result = results[outid];
        data.push({
            model_io_id: outid,
            resource: getResourceData(result)
        });
    });
    return data;
};

export const executionResultsToGQLv2 = (results: Execution_Result[]) => {
    const data: any = [];
    Object.keys(results).forEach((outid) => {
        const result = results[outid];
        data.push({
            model_io_id: outid,
            resource: getResourceData(result)
        });
    });
    return data;
};
