import { getResource, postFormResource, postJSONResource } from "./xhr-requests";
import {IdMap, IdNameObject, MintPreferences, ExecutableEnsemble, Pathway, Model, DataResource} from "../mint/mint-types";
import { WingsComponent, WingsTemplatePackage, WingsTemplate, WingsDataBindings, WingsParameterBindings, WingsTemplateMetadata, WingsPort, WingsPortRole, WingsDataVariable, WingsParameterVariable, WingsNode, WingsComponentVariable, WingsTemplateSeed, WingsParameterTypes } from "./wings-types";

export const loginToWings = async(config: MintPreferences) : Promise<void> => {
    let config_wings = config.wings;
    return new Promise<void>((resolve, reject) => {
        getResource({
            url: config_wings.server + '/login',
            onLoad: function(e: any) {
              var txt = e.target.responseText;
              if(txt.match(/j_security_check/)) {
                var data = {
                  j_username: config_wings.username,
                  j_password: config_wings.password
                };
                postFormResource({
                  url: config_wings.server + '/j_security_check',
                  onLoad: function(e2: any) {
                    getResource({
                        // Try to access the login page again
                        url: config_wings.server + '/login',
                        onLoad: function(e3: any) {
                            var txt2 = e2.target.responseText;
                            if(txt2.match(/j_security_check/)) {
                                reject();
                            }
                            else {
                                // Success: Logged in
                                resolve();
                                //console.log("Success !! Logged in");
                            }
                        },
                        onError: function() {
                            console.log("Cannot login");
                            reject();
                        }
                    });
                  },
                  onError: function() {
                    console.log("Cannot login");
                    getResource({
                      url: config_wings.server + '/login',
                      onLoad: function(e2: any) {
                        var match = /USER_ID\s*=\s*"(.+)"\s*;/.exec(e2.target.responseText);
                        if(match) {
                          let userid = match[1];
                          resolve();
                          //console.log("Logged in as " + userid + " !");
                        }
                      },
                      onError: function(){
                          reject();
                      }
                    });
                  }
                }, data, true);
              } else {
                var match = /USER_ID\s*=\s*"(.+)"\s*;/.exec(txt);
                if(match) {
                  let userid = match[1];
                  resolve();
                  //console.log("Already Logged in as " + userid + " !");
                }
              }
            },
            onError: function(e: any) {
                reject();
                console.log("Cannot connect to wings");
            }
          });
    });
}

export const fetchWingsComponent = async(cname: string, config: MintPreferences) : Promise<WingsComponent> => {
    let config_wings = config.wings;
    return new Promise<WingsComponent>((resolve, reject) => {
        var purl = config_wings.server + "/users/" + config_wings.username + "/" + config_wings.domain;
        var exurl = config_wings.export_url + "/export/users/" + config_wings.username + "/" + config_wings.domain;
        var cid = exurl + "/components/library.owl#" + cname;

        getResource({
            url: purl + "/components/getComponentJSON?cid=" + escape(cid),
            onLoad: function(e: any) {
                let comp = JSON.parse(e.target.responseText) as WingsComponent;
                resolve(comp);
            },
            onError: function(e: any) {
                reject("Could not get component");
            }
        });
    });
}

export const logoutFromWings = async(config: MintPreferences) : Promise<void> => {
    let config_wings = config.wings;
    return new Promise<void>((resolve, reject) => {
        getResource({
        url: config_wings.server + '/jsp/login/logout.jsp',
        onLoad: function(e: any) {
            resolve();
            //console.log("Logged out");
        },
        onError: function(e: any) {
            reject("Could not logout !");
            //console.log("Could not logout !");
        }
        });
    });
}

export const fetchWingsTemplatesList = async(config: MintPreferences) : Promise<string[]> => {
    let config_wings = config.wings;
    return new Promise<string[]>((resolve, reject) => {
        var purl = config_wings.server + "/users/" + config_wings.username + "/" + config_wings.domain;
        getResource({
            url: purl + "/workflows/getTemplatesListJSON",
            onLoad: function(e: any) {
                let list = JSON.parse(e.target.responseText)
                resolve(list);
            },
            onError: function(e: any) {
                reject("Could not get templates list");
            }
        });
    });
}

export const fetchWingsTemplate = async(tid: string, config: MintPreferences) : Promise<WingsTemplatePackage> => {
    let config_wings = config.wings;
    return new Promise<WingsTemplatePackage>((resolve, reject) => {
        var purl = config_wings.server + "/users/" + config_wings.username + "/" + config_wings.domain;
        //var exurl = config_wings.export_url + "/export/users/" + config_wings.username + "/" + config_wings.domain;
        //var tid = exurl + "/workflows/" + tname + ".owl#" + tname;

        getResource({
            url: purl + "/workflows/getEditorJSON?template_id=" + escape(tid),
            onLoad: function(e: any) {
                let tpl = JSON.parse(e.target.responseText) as WingsTemplatePackage;
                resolve(tpl);
            },
            onError: function(e: any) {
                reject("Could not get template");
            }
        });
    });
}

export const saveWingsTemplate = async(tpl: WingsTemplatePackage, config: MintPreferences) : Promise<void> => {
    //TODO: Get a MD5 Hash for template to check if it is already saved.
    // - To avoid cluttering up template library

    let config_wings = config.wings;
    // Get url prefix for operations
    return new Promise<void>((resolve, reject) => {
        var purl = config_wings.server + "/users/" + config_wings.username + "/" + config_wings.domain;
        var data = {
            template_id: tpl.template.id,
            constraints_json: JSON.stringify(tpl.constraints),
            json: JSON.stringify(tpl.template)
        };
        postFormResource({
            url: purl + "/workflows/saveTemplateJSON",
            onLoad: function(e: any) {
                resolve();
            },
            onError: function() {
                reject("Cannot save");
            }
        }, data, false);
    });
}

export const layoutWingsTemplate = async(tpl: WingsTemplate, config: MintPreferences) 
        : Promise<WingsTemplatePackage> => {
    
    let config_wings = config.wings;
    return new Promise<WingsTemplatePackage>((resolve, reject) => {
        // Get url prefix for operations
        var purl = config_wings.server + "/users/" + config_wings.username + "/" + config_wings.domain;
        postJSONResource({
            url: purl + "/workflows/layoutTemplate",
            onLoad: function(e: any) {
                var ntpl = JSON.parse(e.target.responseText) as WingsTemplatePackage;
                resolve(ntpl);
            },
            onError: function() {
                reject("Cannot layout template");
            }
        }, tpl);
    });
}

export const elaborateWingsTemplate = async(tpl: WingsTemplatePackage, config: MintPreferences) 
        : Promise<WingsTemplate> => {
    
    let config_wings = config.wings;
    return new Promise<WingsTemplate>((resolve, reject) => {
        // Get url prefix for operations
        var purl = config_wings.server + "/users/" + config_wings.username + "/" + config_wings.domain;
        var data = {
            template_id: tpl.template.id,
            constraints_json: JSON.stringify(tpl.constraints),
            json: JSON.stringify(tpl.template)
        }
        postFormResource({
            url: purl + "/plan/elaborateTemplateJSON",
            onLoad: function(e:any) {
                var ntpl = JSON.parse(e.target.responseText) as WingsTemplate;
                resolve(ntpl);
            },
            onError: function() {
                reject("Cannot elaborate template");
            }
        }, data, true);
    });
}

const _getComponentBindings = (tpl: WingsTemplatePackage) => {
    var cbindings = {} as any;
    for(var nid in tpl.template.Nodes) {
        var c = tpl.template.Nodes[nid].componentVariable;
        cbindings[c.id] = c.binding.id;
    }
    return cbindings;
}

export const expandAndRunWingsWorkflow = async(
    tpl: WingsTemplatePackage, 
    dataBindings: WingsDataBindings,
    parameterBindings: WingsParameterBindings,
    parameterTypes: WingsParameterBindings,
    config: MintPreferences) 
        : Promise<string> => {

    let config_wings = config.wings;
    return new Promise<string>((resolve, reject) => {
        // Get url prefix for operations
        var purl = config_wings.server + "/users/" + config_wings.username + "/" + config_wings.domain;
        var data = {
            templateId: tpl.template.id,
            parameterBindings: parameterBindings,
            parameterTypes: parameterTypes,
            componentBindings: _getComponentBindings(tpl),
            dataBindings: dataBindings            
        }
        postJSONResource({
            url: purl + "/executions/expandAndRunWorkflow",
            onLoad: function(e: any) {
                var runid = e.target.responseText;
                if(runid) {
                    resolve(runid);
                }
                else {
                    reject("Could not run workflow");
                }
              },
              onError: function() {
                reject("Cannot run workflow");
              }
            }, 
        data);
    });
}

export const fetchWingsRunsStatuses = (template_name: string, start_time: number, total_runs: number, config: MintPreferences) 
        : Promise<Map<string, any>> => {
    return new Promise<Map<string, any>>((resolve, reject) => {
        let statuses = {} as Map<string, any>;
        let promises = [];
        for(let i=0; i<total_runs; i+= 500) {
            promises.push(_fetchWingsRunsStatuses(template_name, start_time, i, 500, config));
        }
        Promise.all(promises).then((vals) => {
            vals.map((val) => {
                statuses =  Object.assign({}, statuses, val); 
            });
            resolve(statuses);
        })
    })
}

const _fetchWingsRunsStatuses = (template_name: string, start_time: number, start: number, limit: number, config: MintPreferences)
        : Promise<Map<string, any>> => {
    
    let config_wings = config.wings;
    return new Promise<Map<string, any>>((resolve, reject) => {
        var purl = config_wings.server + "/users/" + config_wings.username + "/" + config_wings.domain;
        getResource({
            url: purl + "/executions/getRunListSimple?pattern="+template_name+"&start="+start+"&limit="+limit+"&sort=startTime&dir=ASC&started_after="+start_time,
            onLoad: function(e: any) {
                let runsjson = JSON.parse(e.target.responseText);
                if(runsjson.success) {
                    let statuses: any = {};
                    let runslist : any[] = runsjson.rows;
                    runslist.map((runjson) => {
                        let runid = runjson.id;
                        statuses[runid] = runjson.runtimeInfo;
                    })
                    resolve(statuses);
                }
            },
            onError: function() {
                reject("Cannot fetch runs");
            }
        });
    });
}

export const fetchWingsRunResults = (ensemble: ExecutableEnsemble, config: MintPreferences)
        : Promise<any> => {

    let config_wings = config.wings;
    return new Promise<any>((resolve, reject) => {
        var purl = config_wings.server + "/users/" + config_wings.username + "/" + config_wings.domain;
        if(!ensemble.runid) {
            reject();
            return;
        }

        let data = {
            run_id: ensemble.runid,
        };
        postFormResource({
            url: purl + "/executions/getRunPlan",
            onLoad: function(e: any) {
                let ex = JSON.parse(e.target.responseText);
                if(ensemble.status == "SUCCESS") {                    
                    // Look for outputs that aren't inputs to any other steps
                    let outputfiles : any = {};
                    ex.plan.steps.map((step: any) => {
                        step.outputFiles.map((file: any) => {
                            outputfiles[file.id] = file;
                        })
                    })
                    ex.plan.steps.map((step: any) => {
                        step.inputFiles.map((file: any) => {
                            delete outputfiles[file.id];
                        })
                    })
                    resolve(outputfiles);
                }
            },
            onError: function() {
                reject("Cannot get run details");
            }
        }, data, true);
    });
}

export const fetchWingsRunLog = (runid: string, config: MintPreferences)
        : Promise<any> => {

    let config_wings = config.wings;
    return new Promise<any>((resolve, reject) => {
        var purl = config_wings.server + "/users/" + config_wings.username + "/" + config_wings.domain;
        let data = {
            run_id: runid,
        };
        postFormResource({
            url: purl + "/executions/getRunDetails",
            onLoad: function(e: any) {
                let response = JSON.parse(e.target.responseText);
                let ex = response.execution;
                let log = ex.runtimeInfo.log;
                log += "\n----------------------------------------------\n";
                ex.queue.steps.map((step: any) => {
                    log += step.id.replace(/.*#/, '') + "\n"
                    log += step.runtimeInfo.log;
                    log += "\n----------------------------------------------\n";
                })
                resolve(log);
            },
            onError: function() {
                reject("Cannot get run details");
            }
        }, data, true);
    });
}

export const createSingleComponentTemplate = (comp: WingsComponent, config: MintPreferences) : WingsTemplate => {
    let config_wings = config.wings;
    var cname = comp.id.replace(/^.+#/, '');
    var exurl = config_wings.export_url + "/export/users/" + config_wings.username + "/" + config_wings.domain;
    var tname = "workflow_" + cname;
    var tns = exurl + "/workflows/" + tname + ".owl#";
    var tid = tns + tname;

    var storage = config_wings.storage;
    var dotpath = config_wings.dotpath;
    var ontpfx = config_wings.onturl;

    var clibns = exurl + "/components/library.owl#";
    var usfx = "/users/" + config_wings.username + "/" + config_wings.domain;
    var purl = config_wings.server + usfx;
    var pdir = storage + usfx;

    let tpl : WingsTemplate = {
        id: tid,
        Nodes: {},
        Links: {},
        Variables: {},
        inputRoles: {},
        outputRoles: {},
        onturl: ontpfx + "/workflow.owl",
        wflowns: ontpfx + "/workflow.owl#",
        version: 0,
        subtemplates: {},
        metadata: {
            documentation: "",
            contributors: []
        } as WingsTemplateMetadata,
        rules: {},
        props: {
          "lib.concrete.url": exurl + "/components/library.owl",
          "lib.domain.execution.url": exurl + "/executions/library.owl",
          "lib.domain.code.storage": pdir + "/code/library",
          "domain.workflows.dir.url": exurl + "/workflows",
          "user.id": config_wings.username,
          "tdb.repository.dir": storage + "/TDB",
          "viewer.id": config_wings.username,
          "domain.executions.dir.url": exurl + "/executions",
          "lib.domain.data.url": exurl + "/data/library.owl",
          "ont.domain.data.url": exurl + "/data/ontology.owl",
          "lib.abstract.url": exurl + "/components/abstract.owl",
          "lib.provenance.url": config_wings.export_url + "/export/common/provenance/library.owl",
          "ont.data.url": ontpfx + "/data.owl",
          "lib.domain.data.storage": pdir + "/data",
          "lib.domain.workflow.url": exurl + "/workflows/library.owl",
          "lib.resource.url": config_wings.export_url + "/export/common/resource/library.owl",
          "ont.component.url": ontpfx + "/component.owl",
          "ont.workflow.url": ontpfx + "/workflow.owl",
          "ont.dir.url": ontpfx,
          "dot.path": dotpath,
          "ont.domain.component.ns": clibns,
          "ont.execution.url": ontpfx + "/execution.owl",
          "ont.resource.url": ontpfx + "/resource.owl"
        }
    };

    let nodeid = tns + cname + "_node";
    let inputPorts : IdMap<WingsPort> = {};
    let outputPorts : IdMap<WingsPort> = {};

    comp.inputs.map((arg) => {
        let portid = nodeid + "_" + arg.role;
        inputPorts[portid] = {
            id: portid,
            role: {
                type: arg.isParam ? 2 : 1,
                roleid: arg.role,
                dimensionality: arg.dimensionality,
                id: portid + "_role"
            } as WingsPortRole
        }
        let varid = tns + arg.role;
        tpl.Variables[varid] = {
            id: varid,
            type: arg.isParam ? 2 : 1,
        } as WingsDataVariable | WingsParameterVariable;

        tpl.inputRoles[varid] = {
            type: arg.isParam ? 2 : 1,
            roleid: portid,
            dimensionality: arg.dimensionality,
            id: varid + "_trole"
        };

        let linkid = portid + "_input";
        tpl.Links[linkid] = {
            id: linkid,
            toNode: { id: nodeid },
            toPort: { id: portid },
            variable: { id: varid }
        }
    });
    comp.outputs.map((arg) => {
        let portid = nodeid + "_" + arg.role;
        outputPorts[portid] = {
            id: portid,
            role: {
                type: arg.isParam ? 2 : 1,
                roleid: arg.role,
                dimensionality: arg.dimensionality,
                id: portid + "_role"
            } as WingsPortRole
        }
        let varid = tns + arg.role;
        tpl.Variables[varid] = {
            id: varid,
            type: arg.isParam ? 2 : 1,
        } as WingsDataVariable | WingsParameterVariable;
        
        tpl.outputRoles[varid] = {
            type: arg.isParam ? 2 : 1,
            roleid: portid,
            dimensionality: arg.dimensionality,
            id: varid + "_trole"
        };

        let linkid = portid + "_output";
        tpl.Links[linkid] = {
            id: linkid,
            fromNode: { id: nodeid },
            fromPort: { id: portid },
            variable: { id: varid }
        }
    });   

    let node : WingsNode = {
        id: nodeid,
        componentVariable: {
            id: nodeid + "_comp",
            isConcrete: true,
            binding: {
                id: comp.id,
                type: "uri"
            },
            type: 3
        } as WingsComponentVariable,
        inputPorts: inputPorts,
        outputPorts: outputPorts,
        crule: {
            type: 'WTYPE'
        },
        prule: {
            type: 'STYPE'
        }
    }
    tpl.Nodes[nodeid] = node;

    return tpl;
}

/* WCM API based Wings calls */
export const registerWingsComponent = async(name: string, uri: string, config: MintPreferences) 
        : Promise<string> => {

    let config_wings = config.wings;
    let data = {
        id: name,
        model_catalog_uri: uri,
        wings_instance: {
            server: config_wings.server,
            export_url: config_wings.export_url,
            domain: config_wings.domain,
            username: config_wings.username,
            password: config_wings.password
        }
    }
    return new Promise<string>((resolve, reject) => {
        postJSONResource({
            url: config_wings.api + "/components",
            onLoad: function(e: any) {
                let compjson = JSON.parse(e.target.responseText);
                resolve(compjson.id);
            },
            onError: function() {
                reject("Cannot create component");
            }
        }, data);
    });
}

export const registerWingsDataset = async(dcid: string, name: string, type: string, uri: string, config: MintPreferences) 
        : Promise<void> => {

    let config_wings = config.wings;
    let data = {
        data_catalog_id: dcid,
        id: name,
        type: type,
        url: uri,
        wings_instance: {
            server: config_wings.server,
            export_url: config_wings.export_url,
            domain: config_wings.domain,
            username: config_wings.username,
            password: config_wings.password
        }
    }
    return new Promise<void>((resolve, reject) => {
        postJSONResource({
            url: config_wings.api + "/datasets",
            onLoad: function(e: any) {
                resolve();
            },
            onError: function() {
                reject("Cannot create component");
            }
        }, data);
    });
}

const _createModelTemplate = (
    cname: string,
    prefs: MintPreferences) : Promise<string> => {

    return new Promise((resolve, reject) => {
        let config = prefs.wings;
        let expfx = config.export_url + "/export/users/" + config.username + "/" + config.domain;

        
        let tname = "workflow_" + cname;
        let tns = expfx + "/workflows/" + tname + ".owl#";
        let tid = tns + tname;

        fetchWingsTemplatesList(prefs).then((list) => {
            if(list.indexOf(tid) >= 0) {
                //console.log(tid + " template already exists");
                resolve(tid);
            }
            else {
                // Create template
                fetchWingsComponent(cname, prefs).then((comp) => {
                    let tpl = createSingleComponentTemplate(comp, prefs);
                    layoutWingsTemplate(tpl, prefs).then((tpl_package) => {
                        saveWingsTemplate(tpl_package, prefs).then(() => {
                            console.log("Template saved as " + tpl.id);
                            resolve(tpl.id);
                        })
                    });
                });
            }
        });
    });
}

const _runModelTemplates = (
    seeds: WingsTemplateSeed[],
    tpl_package: WingsTemplatePackage,
    prefs: MintPreferences) : Promise<string[]> => {
        
    let config = prefs.wings;
    let expfx = config.export_url + "/export/users/" + config.username + "/" + config.domain;
    return Promise.all(
        seeds.map((seed) => {
            let tns = seed.tid.replace(/#.*$/, "#");

            let dataBindings = {} as WingsDataBindings;
            let parameterBindings = {} as WingsParameterBindings;
            let parameterTypes = {} as WingsParameterTypes;
            for(let varname in seed.datasets) {
                let varid = tns + varname;
                dataBindings[varid] = seed.datasets[varname].map((ds: string)=> expfx + "/data/library.owl#" + ds);
            }
            for(let varname in seed.parameters) {
                let varid = tns + varname;
                parameterBindings[varid] = seed.parameters[varname];
                parameterTypes[varid] = "http://www.w3.org/2001/XMLSchema#" + seed.paramtypes[varname];
            }

            return expandAndRunWingsWorkflow(tpl_package, 
                dataBindings, 
                parameterBindings, 
                parameterTypes, prefs);
        })
    );
}

export const setupModelWorkflow = async(model: Model, pathway: Pathway, prefs: MintPreferences) => {
    let cname = model.model_configuration;
    let compid = await registerWingsComponent(cname, model.wcm_uri, prefs);
    let compname = compid.replace(/^.*#/, '');
    let templateid = await _createModelTemplate(compname, prefs);
    return templateid;
}

export const runModelEnsembles = async(pathway: Pathway, 
    ensembles: ExecutableEnsemble[], 
    existing_registered_resources: any,
    tpl_package: WingsTemplatePackage,
    prefs: MintPreferences) => {
    let registerDatasetPromises = [];
    let seeds : WingsTemplateSeed[] = [];
    let registered_resources: any = {};

    // Get all input dataset bindings and parameter bindings
    ensembles.map((ensemble) => {
        let model = pathway.models[ensemble.modelid];
        let bindings = ensemble.bindings;
        let datasets : any = {};
        let parameters : any = {};
        let paramtypes : any= {};

        // Get input datasets
        model.input_files.map((io) => {
            let resources : DataResource[] = [];
            let dsid = null;
            if(bindings[io.id]) {
                // We have a dataset binding from the user for it
                resources = [ bindings[io.id] as DataResource ];
            }
            else if(io.value) {
                // There is a hardcoded value in the model itself
                dsid = io.value.id;
                resources = io.value.resources;
            }
            if(resources.length > 0) {
                let type = io.type.replace(/^.*#/, '');
                resources.map((res) => {
                    if(res.url) {
                        res.name =  res.url.replace(/^.*(#|\/)/, '');
                        res.name = res.name.replace(/^([0-9])/, '_$1');
                        if(!res.id)
                            res.id = res.name;
                    }
                    if(!existing_registered_resources[res.id]) {
                        registered_resources[res.id] = [res.name, type, res.url];
                    }
                })
                datasets[io.name] = resources.map((res) => res.name);
            }
        });

        // Get Input parameters
        model.input_parameters.map((ip) => {
            if(ip.value) {
                parameters[ip.name] = ip.value;
            }
            else if(bindings[ip.id]) {
                let value = bindings[ip.id];
                parameters[ip.name] = value;
            }
            paramtypes[ip.name] = ip.type;
        });

        seeds.push({
            tid: tpl_package.template.id,
            datasets: datasets,
            parameters: parameters,
            paramtypes: paramtypes
        } as WingsTemplateSeed);
    })

    // Register any datasets that need to be registered
    for(let resid in registered_resources) {
        let args = registered_resources[resid];
        existing_registered_resources[resid] = args;
        registerDatasetPromises.push(registerWingsDataset(resid, args[0], args[1], args[2], prefs));
    }

    // Register all datasets
    if(registerDatasetPromises.length > 0)
        await Promise.all(registerDatasetPromises);

    let runids = await _runModelTemplates(seeds, tpl_package, prefs);
    return runids;
}

export const matchVariables = (variables1: string[], variables2: string[], fullmatch: boolean) => {
let matched = fullmatch ? true: false;
    variables1.map((var1compound) => {
        var1compound.split(/\s*,\s/).map((var1) => {
            if (!fullmatch && variables2.indexOf(var1) >= 0) {
                matched = true;
            }
            if(fullmatch && variables2.indexOf(var1) < 0) {
                matched = false;
            }
        });
    });
    return matched;
}
