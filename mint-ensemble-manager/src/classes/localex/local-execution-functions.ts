import { Pathway, ExecutableEnsemble, MintPreferences, DataResource, Model, ModelIO, ModelParameter } from "../mint/mint-types";
import { Component, ComponentSeed } from "./local-execution-types";

import path from "path";
import fs from "fs-extra";
import request from "request";
import yauzl from "yauzl";
import yaml from "js-yaml";

import Queue from "bull";
import { CONCURRENCY, EXECUTION_QUEUE_NAME, REDIS_URL } from "../../config/redis";
import { pullImage } from "./docker-functions";
import { Md5 } from "ts-md5";

var appDir = path.dirname(require.main.filename);
let executionQueue = new Queue(EXECUTION_QUEUE_NAME, REDIS_URL);
executionQueue.process(CONCURRENCY, appDir + '/../dist/classes/localex/seed-execution.js');

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
const _unzipFile = (zipfile: string, dirname: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        if (!fs.existsSync(dirname)){
            fs.mkdirSync(dirname);
        }
        yauzl.open(zipfile, { lazyEntries: true }, function (err, zipfile) {
            if (err) throw err;
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
                        fs.mkdirSync(dirname + "/" + filename);
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
                })
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
    let zipfile = plainurl.replace(/.+\//, "");
    let compname = zipfile.replace(/\.zip/i, "");

    let codedir = prefs.localex.codedir + "/" + hashdir;
    if(!fs.existsSync(codedir))
        fs.mkdirsSync(codedir);

    let modeldir = codedir + "/" + compname;
    if (!fs.existsSync(modeldir + "/src")) {
        await _downloadAndUnzipToDirectory(url, modeldir, compname);
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
    let yml = yaml.safeLoad(fs.readFileSync(ymlfile, 'utf8'));
    let wings = yml["wings"]
    wings["inputs"].map((input: any) => {
        comp.inputs.push(input);
    })
    wings["outputs"].map((output: any) => {
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
        role: io.name,
        prefix: pfx + io.position,
        isParam: false,
        type: io.type
    }
}

const _getModelParamDetails = (param: ModelParameter) => {
    if (!param.position) {
        return null;
    }
    return {
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
    let ok = true;
    model.input_files.map((input) => {
        let details = _getModelIODetails(input, "input");
        if (!details)
            ok = false;
        else
            comp.inputs.push(details);
    })
    model.input_parameters.map((param) => {
        let details = _getModelParamDetails(param);
        if (!details)
            ok = false;
        else
            comp.inputs.push(details);
    })
    model.output_files.map((output) => {
        let details = _getModelIODetails(output, "output");
        if (!details)
            ok = false;
        else
            comp.outputs.push(details);
    })
    if (ok)
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
export const runModelEnsemblesLocally =
    async (pathway: Pathway,
        component: Component,
        ensembles: ExecutableEnsemble[],
        scenario_id: string,
        prefs: MintPreferences): Promise<Queue.Job<any>[]> => {

        let seeds: ComponentSeed[] = [];
        let registered_resources: any = {};

        let downloadInputPromises = [];

        // Get all input dataset bindings and parameter bindings
        ensembles.map((ensemble) => {
            let model = pathway.models[ensemble.modelid];
            let bindings = ensemble.bindings;
            let datasets: any = {};
            let parameters: any = {};
            let paramtypes: any = {};

            // Get input datasets
            model.input_files.map((io) => {
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
                    resources.map((res) => {
                        if (res.url) {
                            res.name = res.url.replace(/^.*(#|\/)/, '');
                            res.name = res.name.replace(/^([0-9])/, '_$1');
                            if (!res.id)
                                res.id = res.name;
                        }
                        registered_resources[res.id] = [res.name, type, res.url];
                    })
                    datasets[io.name] = resources.map((res) => res.name);
                }
            });

            // Get Input parameters
            model.input_parameters.map((ip) => {
                if (ip.value) {
                    parameters[ip.name] = ip.value;
                }
                else if (bindings[ip.id]) {
                    let value = bindings[ip.id];
                    parameters[ip.name] = value;
                }
                paramtypes[ip.name] = ip.type;
            });

            seeds.push({
                component: component,
                ensemble: ensemble,
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
        return Promise.all(seeds.map((seed) => executionQueue.add({ 
                seed: seed, 
                prefs: prefs.localex,
                scenario_id: scenario_id,
                pathway_id: pathway.id,
            }, {
            //jobId: seed.ensemble.id,
            //removeOnComplete: true,
            attempts: 2
        })));
}

export const fetchLocalRunLog = (ensembleid: string, prefs: MintPreferences) => {
    let logstdout = prefs.localex.logdir + "/" + ensembleid + ".log";
    return fs.readFileSync(logstdout).toString();
}