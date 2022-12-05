import { Thread, Execution, MintPreferences, DataResource, Model, ModelIO, ModelParameter, Wcm } from "../mint/mint-types";
import { Component, ComponentSeed, ComponentParameterBindings, ComponentDataBindings, ComponentParameterTypes } from "./local-execution-types";

import path from "path";
import fs from "fs-extra";
import request from "request";
import yauzl from "yauzl";
import yaml from "js-yaml";

import Queue from "bull";
import { EXECUTION_QUEUE_NAME, REDIS_URL } from "../../config/redis";
import { pullImage } from "./docker-functions";
import { Md5 } from "ts-md5";
import { getConfiguration } from "../mint/mint-functions";

let prefs = getConfiguration();

let executionQueue = new Queue(EXECUTION_QUEUE_NAME, REDIS_URL);
executionQueue.process(prefs.localex.parallelism, __dirname + '/execution.js');

// You can listen to global events to get notified when jobs are processed
/*executionQueue.on('global:completed', (jobId, result) => {
    console.log(`Job completed with result ${result}`);
});*/

const _downloadFile = (url: string, filepath: string): Promise<void> => {
    const file = fs.createWriteStream(filepath);
    return new Promise<void>((resolve, reject) => {
        request.get(url).on('response', (res) => {
            res.pipe(file);
            res.on('end', function () {
                resolve();
            });
        });
    });
}

// TODO: Unzip the wcm zip file
const _unzipFile = (zipfilename: string, dirname: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        if (!fs.existsSync(dirname)){
            fs.mkdirsSync(dirname);
        }
        yauzl.open(zipfilename, { lazyEntries: true }, function (err, zipfile) {
            if (err) {
                console.log(err);
                reject();
                return;
            }
            zipfile.readEntry();
            zipfile.on("entry", function (entry) {
                // Ignore some files/directories
                if (entry.fileName.match(/__MACOSX/) || entry.fileName.match(/.DS_Store/i)) {
                    zipfile.readEntry();
                    return;
                }
                // If this is a directory, then copy its contents to dirname
                if(entry.fileName.indexOf("/") >= 0) {
                let filename = entry.fileName.substr(entry.fileName.indexOf("/") + 1);
                    if (!filename) {
                        zipfile.readEntry();
                        return;
                    }
                    if (/\/$/.test(filename)) {
                        // Directories
                        zipfile.readEntry();
                        if(!fs.existsSync(dirname + "/" + filename))
                            fs.mkdirsSync(dirname + "/" + filename);
                    } else {
                        // Files
                        zipfile.openReadStream(entry, function (err, readStream) {
                            if (err) throw err;
                            readStream.on("end", function () {
                                zipfile.readEntry();
                            });
                            let filepath = dirname + "/" + filename;
                            let outstream = fs.createWriteStream(filepath)
                            readStream.pipe(outstream);
                            readStream.on('end', () => {
                                // Make it executable
                                outstream.close();
                                if(fs.existsSync(filepath))
                                    fs.chmodSync(filepath, "755");
                            });
                        });
                    }
                }

            });
            zipfile.once("end", function () {
                resolve(dirname);
                zipfile.close();
            });
        });
    });
}

const _downloadAndUnzipToDirectory = (url: string, modeldir: string, compname: string) => {
    let zipfile = modeldir + ".zip";
    return new Promise<void>((resolve, reject) => {
        _downloadFile(url, zipfile).then(() => {
            // Unzip file
            if (fs.existsSync(zipfile)) {
                _unzipFile(zipfile, modeldir).then(() => {
                    resolve();
                }).catch((e) => {
                    console.log(e);
                    reject();
                })
            }
            else {
                reject();
            }
        });
    });
}

const _downloadCwlToDirectory = (url: string, modeldir: string) => {
    let cwlfile = modeldir + '/run.cwl'
    return new Promise<void>((resolve, reject) => {
        _downloadFile(url, cwlfile).then(() => {
            // Unzip file
            if (fs.existsSync(cwlfile)) {
                    resolve();
            }
            else {
                reject();
            }
        });
    });
}

const _downloadWCM = async (url: string, prefs: MintPreferences) => {
    let hashdir = Md5.hashStr(url).toString();
    
    // Get zip file name from url
    let plainurl = url.replace(/\?.*$/, '');
    let component_file = plainurl.replace(/.+\//, "");
    let extension = path.extname(component_file)
    let compname = path.basename(component_file, extension)

    let codedir = prefs.localex.codedir + "/" + hashdir;
    if(!fs.existsSync(codedir))
        fs.mkdirsSync(codedir);

    let modeldir = codedir + "/" + compname;
    let src_dir = modeldir + "/" + "src"
    if (!fs.existsSync(src_dir)) {
        if (extension == ".zip")
            await _downloadAndUnzipToDirectory(url, modeldir, compname);
        else if (extension == ".cwl"){
            if(!fs.existsSync(modeldir))
                fs.mkdirsSync(modeldir)
            fs.mkdirsSync(src_dir)
            await _downloadCwlToDirectory(url, src_dir);
        }
    }
    return modeldir;
}

const _getModelDetailsFromYAML = (modeldir: string) => {
    let ymlfile = modeldir + "/wings-component.yml";
    if (!fs.existsSync(ymlfile)) {
        ymlfile = modeldir + "/wings-component.yaml";
    }
    let comp: Component = {
        rundir: modeldir + "/src",
        inputs: [],
        outputs: [],
    };
    let yml = yaml.safeLoad(fs.readFileSync(ymlfile, 'utf8')) as Wcm;
    let wings = yml["wings"]
    wings.inputs.map((input: any) => {
        comp.inputs.push(input);
    })
    wings.outputs.map((output: any) => {
        comp.outputs.push(output);
    })
    return comp;
}

const _getModelIODetails = (io: ModelIO, iotype: string) => {
    if (!io.position) {
        return null;
    }
    let pfx = (iotype == "input") ? "-i" : "-o";
    return {
        id: io.id,
        role: io.name,
        prefix: pfx + io.position,
        isParam: false,
        format: io.format,
        type: io.type
    }
}

const _getModelParamDetails = (param: ModelParameter) => {
    if (!param.position) {
        return null;
    }
    return {
        id: param.id,
        role: param.name,
        prefix: "-p" + param.position,
        isParam: true,
        type: param.type
    }
}

const _getModelDetails = (model: Model, modeldir: string) => {
    let comp: Component = {
        rundir: modeldir + "/src",
        softwareImage: model.software_image,
        inputs: [],
        outputs: [],
    };
    let okinput = true;
    let okparam = true;
    let okoutput = true;
    model.input_files.map((input) => {
        let details = _getModelIODetails(input, "input");
        if (!details)
            okinput = false;
        else
            comp.inputs.push(details);
    })
    model.input_parameters.map((param) => {
        let details = _getModelParamDetails(param);
        if (!details)
            okparam = false;
        else
            comp.inputs.push(details);
    })
    model.output_files.map((output) => {
        let details = _getModelIODetails(output, "output");
        if (!details)
            okoutput = false;
        else
            comp.outputs.push(details);
    })
    if (okoutput)
        return comp;
    else
        return null;
}


export const getModelCacheDirectory = (url: string, prefs: MintPreferences) => {
    let hashdir = Md5.hashStr(url).toString();

    // Get zip file name from url
    let plainurl = url.replace(/\?.*$/, '');
    let zipfile = plainurl.replace(/.+\//, "");
    let compname = zipfile.replace(/\.zip/i, "");

    let codedir = prefs.localex.codedir;
    let modeldir = codedir + "/" + hashdir + "/" + compname;
    return modeldir;
}

export const loadModelWCM = async (url: string, model: Model, prefs: MintPreferences) => {
    let modeldir = await _downloadWCM(url, prefs);
    if(model.software_image != null) {
        // Pull docker image if needed
        await pullImage(model.software_image);
    }
    let details = _getModelDetails(model, modeldir);
    // If we cannot get the details from just the model cache, then try to get it from the yaml
    if (!details) {
        details = _getModelDetailsFromYAML(modeldir);
    }
    return details;
}

// Create Jobs (Seeds) and Queue them
export const queueModelExecutionsLocally =
    async (thread: Thread,
        modelid: string,
        component: Component,
        executions: Execution[],
        prefs: MintPreferences): Promise<Queue.Job<any>[]> => {

        let seeds: ComponentSeed[] = [];
        let registered_resources: any = {};
        let downloadInputPromises = [];

        let model = thread.models[modelid];
        let thread_model_id = thread.model_ensembles[modelid].id;

        // Get all input dataset bindings and parameter bindings
        executions.map((execution) => {
            let bindings = execution.bindings;
            let datasets: ComponentDataBindings = {};
            let parameters: ComponentParameterBindings = {};
            let paramtypes: ComponentParameterTypes = {};

            // Get input datasets
            model.input_files.map((io: ModelIO) => {
                let resources: DataResource[] = [];
                let dsid = null;
                if (bindings[io.id]) {
                    // We have a dataset binding from the user for it
                    resources = [bindings[io.id] as DataResource];
                }
                else if (io.value) {
                    // There is a hardcoded value in the model itself
                    dsid = io.value.id;
                    resources = io.value.resources;
                }
                if (resources.length > 0) {
                    let type = io.type.replace(/^.*#/, '');
                    let newresources: any = {};
                    resources.map((res) => {
                        let resid = res.id;
                        let resname = res.name;
                        if (res.url) {
                            resname = res.url.replace(/^.*(#|\/)/, '');
                            resname = resname.replace(/^([0-9])/, '_$1');
                            if (!resid)
                                resid = resname;
                        }
                        newresources[resid] = {
                            id: resid,
                            url: res.url,
                            name: resname,
                            time_period: res.time_period,
                            spatial_coverage: res.spatial_coverage
                        } as DataResource
                        registered_resources[resid] = [resname, type, res.url];
                    })
                    datasets[io.id] = resources.map((res) => newresources[res.id]);
                }
            });

            // Get Input parameters
            model.input_parameters.map((ip) => {
                if (ip.value) {
                    parameters[ip.id] = ip.value.toString();
                }
                else if (bindings[ip.id]) {
                    let value = bindings[ip.id];
                    parameters[ip.id] = value.toString();
                }
                paramtypes[ip.id] = ip.type;
            });

            seeds.push({
                component: component,
                execution: execution,
                datasets: datasets,
                parameters: parameters,
                paramtypes: paramtypes
            } as ComponentSeed);
        });

        // Add Download Job to Queue (if it doesn't already exist)
        for (let resid in registered_resources) {
            let args = registered_resources[resid];
            let inputpath = prefs.localex.datadir + "/" + args[0];
            let inputurl = args[2];
            if (!fs.existsSync(inputpath))
                downloadInputPromises.push(_downloadFile(inputurl, inputpath));
        }

        // Download all datasets
        if (downloadInputPromises.length > 0)
            await Promise.all(downloadInputPromises);

        // Once all Downloads are finished, Add all execution jobs (seeds) to queue
        let numseeds = seeds.length;
        let priority = numseeds < 10 ? 1 : 
            numseeds < 50 ? 2 : numseeds < 200 ? 3 :
            numseeds < 500 ? 4 : 5;

        return Promise.all(seeds.map((seed) => executionQueue.add({ 
                seed: seed, 
                prefs: prefs.localex,
                thread_id: thread.id,
                thread_model_id: thread_model_id
            }, {
                priority: priority
            //jobId: seed.execution.id,
            //removeOnComplete: true,
            //attempts: 2
        })));
}

export const fetchLocalRunLog = (executionid: string, prefs: MintPreferences) => {
    let logstdout = prefs.localex.logdir + "/" + executionid + ".log";
    if(fs.existsSync(logstdout))
        return fs.readFileSync(logstdout).toString();
    return "Job not yet started running";
}
