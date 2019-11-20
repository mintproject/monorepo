import { Pathway, ExecutableEnsemble, MintPreferences, DataResource } from "../mint/mint-types";
import { Component, ComponentArgument, ComponentSeed } from "./local-execution-types";

import fs from "fs-extra";
import request from "request";
import yauzl from "yauzl";
import yaml from "js-yaml";
import { Md5 } from "ts-md5";
import os from "os";

import child_process, { ChildProcess } from "child_process";
import { updatePathwayEnsembles } from "../mint/firebase-functions";

const _downloadFile = (url: string, filepath: string) : Promise<void> => {
    const file = fs.createWriteStream(filepath);
    return new Promise<void>((resolve, reject) => {
        request.get(url).on('response', (res)=> {
            res.pipe(file);
            res.on( 'end', function(){
                resolve();
            });
        });
    });
}

// TODO: Unzip the wcm zip file
const _unzipFile = (zipfile: string, dirname: string, topdir: string) : Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        fs.mkdirSync(dirname);
        yauzl.open(zipfile, {lazyEntries: true}, function(err, zipfile) {
            if (err) throw err;
            zipfile.readEntry();
            zipfile.on("entry", function(entry) {
                // Ignore some files/directories
                if(entry.fileName.match(/__MACOSX/) || entry.fileName.match(/.DS_Store/i)) {
                    zipfile.readEntry();
                    return;
                }
                // Only process if this is a subtree from the required topdir
                if(entry.fileName.indexOf(topdir) == 0) {
                    let filename = entry.fileName.substr(topdir.length+1);
                    if(!filename) {
                        zipfile.readEntry();
                        return;
                    }
                    if (/\/$/.test(filename)) {
                        // Directories
                        zipfile.readEntry();
                        fs.mkdirSync(dirname + "/" + filename);
                    } else {
                        // Files
                        zipfile.openReadStream(entry, function(err, readStream) {
                            if (err) throw err;
                            readStream.on("end", function() {
                                zipfile.readEntry();
                            });
                            let filepath = dirname + "/" +filename;
                            let outstream = fs.createWriteStream(filepath)
                            readStream.pipe(outstream);
                            readStream.on( 'end', () => {
                                // Make it executable
                                outstream.close();
                                fs.chmodSync(filepath, "755");
                            });
                        });
                    }
                }

            });
            zipfile.once("end", function() {
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
            if(fs.existsSync(zipfile)) {
                _unzipFile(zipfile, modeldir, compname).then(() => {
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
    // Get zip file name from url
    let plainurl = url.replace(/\?.*$/, '');
    let zipfile = plainurl.replace(/.+\//, "");
    let compname = zipfile.replace(/\.zip/i, "");

    let codedir = prefs.localex.codedir;
    let modeldir = codedir + "/" + compname;
    if(!fs.existsSync(modeldir)) {
        await _downloadAndUnzipToDirectory(url, modeldir, compname);
    }
    return modeldir;
}

const _getModelDetails = (modeldir: string) => {
    let ymlfile = modeldir + "/wings-component.yml";
    let comp : Component = {
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

export const loadModelWCM = async(url: string, prefs: MintPreferences) => {
    let modeldir = await _downloadWCM(url, prefs);
    return _getModelDetails(modeldir);
}

export const runModelLocally = (seed: ComponentSeed, prefs: MintPreferences) => {
    return new Promise<ExecutableEnsemble>((resolve, reject) => {
        let comp = seed.component;
        let inputdir = prefs.localex.datadir;
        let outputdir = prefs.localex.datadir;
    
        // Create temporary directory
        let ostmp = os.tmpdir();
        let tmpprefix = ostmp + "/" + seed.ensemble.modelid.replace(/.*\//, '');
        let tempdir = fs.mkdtempSync(tmpprefix);
    
        // Copy component run directory to tempdir
        fs.copySync(comp.rundir, tempdir);
    
        // Set the execution engine used for this ensemble
        seed.ensemble.execution_engine = "localex";

        // Data/Parameter arguments to the script (will be setup below)        
        let args : string[] = [];
        let plainargs : string[] = [];

        // Default invocation is via Bash
        let command = "bash";

        // Check if a singularity image is present
        // If so, change invocation command to singularity
        let pegasus_jobprops_file = comp.rundir + "/__pegasus-job.properties";
        if(fs.existsSync(pegasus_jobprops_file)) {
            let jobprops = fs.readFileSync(pegasus_jobprops_file);
            let matches : RegExpMatchArray = jobprops.toString().match(/SingularityImage = "(.+)"/);
            if(matches.length > 1) {
                command = "singularity";
                args.push("exec");
                args.push(matches[1]);
            }
        }

        // The entry point of the component (run script)
        args.push("./run");

        // Set the Input file/parameter arguments for the command
        comp.inputs.map((input) => {
            args.push(input.prefix);
            plainargs.push(input.prefix);
            if(input.isParam) {
                //let paramtype = seed.paramtypes[input.role];
                let paramvalue = seed.parameters[input.role];
                if(!paramvalue)
                    paramvalue = input.paramDefaultValue;
                args.push(paramvalue);
                plainargs.push(paramvalue);
            }
            else {
                let datasets = seed.datasets[input.role];
                datasets.map((ds) => {
                    // Copy input files to tempdir
                    let ifile = inputdir + "/" + ds;
                    let newifile = tempdir + "/" + ds;
                    fs.copyFileSync(ifile, newifile);
                    args.push(ds)
                    plainargs.push(ds);
                });
            }
        })
        // Set the output file arguments for the command
        // Create the output file suffix based on a hash of inputs
        let opsuffix = Md5.hashAsciiStr(seed.ensemble.modelid + plainargs.join());
        let results : any = {};
        comp.outputs.map((output) => {
            args.push(output.prefix);
            let opfilename = output.role + "-" + opsuffix;
            let opfilepath = outputdir + "/" + opfilename;
            args.push(opfilename);
            let opfileurl = opfilepath.replace(prefs.localex.datadir, prefs.localex.dataurl);
            results[output.role] = {
                id: output.role,
                name: opfilename,
                url: opfileurl,
                location: opfilepath
            }
        });

        (async () => {
            // Setup log file
            let logstdout = prefs.localex.logdir + "/" + seed.ensemble.id + ".log";            
            let logstream = fs.createWriteStream(logstdout);

            logstream.write(command + " " + args.join(" "));
            
            // Spawn the process & pipe stdout and stderr
            let proc: ChildProcess = child_process.spawn(command, args, {
                detached: true,
                shell: true,
                stdio: 'pipe',
                cwd: tempdir
            });            
            proc.stdout.on('data', (data) => {
                if(logstream && !logstream.writableEnded)
                    logstream.write(`${data}`);
            })
            proc.stderr.on('data', (data) => {
                if(logstream && !logstream.writableEnded)
                    logstream.write(`${data}`);
            })

            // Set the ensemble status (results) on process exit and resolve the promise
            proc.on('exit', (code) => {
                logstream.close();
                seed.ensemble.run_progress = 1;        
                if(code == 0) {
                    seed.ensemble.status = "SUCCESS";
                    // Copy output files from tempdir to output dir
                    Object.values(results).map((result: any) => {
                        fs.copyFileSync(tempdir + "/" + result.name, result.location);
                    });
                    // Remove tempdir
                    fs.remove(tempdir);
                    // Set the results
                    seed.ensemble.results = results;
                }
                else {
                    seed.ensemble.status = "FAILURE";
                }
                // Resolve the promise with this ensemble
                resolve(seed.ensemble);
                //console.log(`Finished with code ${code}`);
            })
        })()
        .catch(e =>
            console.error(e)
        );
    });
}

export const runModelEnsemblesLocally = 
    async(pathway: Pathway, 
        component: Component,
        ensembles: ExecutableEnsemble[], 
        prefs: MintPreferences) : Promise<ExecutableEnsemble[]> => {

    let seeds : ComponentSeed[] = [];
    let registered_resources: any = {};

    let downloadInputPromises = [];

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
                    registered_resources[res.id] = [res.name, type, res.url];
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
            component: component,
            ensemble: ensemble,
            datasets: datasets,
            parameters: parameters,
            paramtypes: paramtypes
        } as ComponentSeed);
    });

    // Register any datasets that need to be registered
    for(let resid in registered_resources) {
        let args = registered_resources[resid];
        let inputpath = prefs.localex.datadir + "/" + args[0];
        let inputurl = args[2];
        if(!fs.existsSync(inputpath))
            downloadInputPromises.push(_downloadFile(inputurl, inputpath));
    }

    // Download all datasets
    if(downloadInputPromises.length > 0)
        await Promise.all(downloadInputPromises);    

    // Run all seed locally - Call the execution function for the seed
    // - Returns a promise that waits for all of them to finish
    return Promise.all(seeds.map((seed) => runModelLocally(seed, prefs)));
}

export const fetchLocalRunLog = (ensembleid:string, prefs: MintPreferences) => {
    let logstdout = prefs.localex.logdir + "/" + ensembleid + ".log";
    return fs.readFileSync(logstdout);
}