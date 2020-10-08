import yaml from "js-yaml";
import os, { type } from "os";
import fs from "fs-extra";
import { Md5 } from "ts-md5";
import child_process, { spawn } from "child_process";
import { incrementPathwaySuccessfulRuns, updatePathwayEnsembleStatus, incrementPathwayFailedRuns, saveEnsemble } from "../mint/firebase-functions";
import { Component } from "./local-execution-types";
import { runImage } from "./docker-functions";
import { Container } from "dockerode";
import { DEVMODE } from "../../config/app";
import { YAMLException } from "js-yaml";
import { deleteModelInputCacheLocally } from "../mint/mint-local-functions";
import path from "path";

module.exports = async function (job: any) {
    // Run the model seed (model config + bindings)
    var scenario_id: string = job.data.scenario_id;
    var pathway_id: string = job.data.pathway_id;
    var seed: any = job.data.seed;
    var localex: any = job.data.prefs;

    let comp : Component = seed.component;
    let inputdir = localex.datadir;
    let outputdir = localex.datadir;

    // Create temporary directory
    let ostmp = os.tmpdir();
    let tmpprefix = ostmp + "/" + seed.ensemble.modelid.replace(/.*\//, '');
    let tempdir = fs.mkdtempSync(tmpprefix);

    // Copy component run directory to tempdir
    fs.copySync(comp.rundir, tempdir);

    // Set the execution engine used for this ensemble
    seed.ensemble.execution_engine = "localex";

    // Data/Parameter arguments to the script (will be setup below)        
    let args: string[] = [];
    let plainargs: string[] = [];

    // Default invocation is via Bash
    let command = "bash";

    // The entry point of the component (run script)
    args.push("./run");

    // Set the Input file/parameter arguments for the command
    comp.inputs.map((input: any) => {
        args.push(input.prefix);
        plainargs.push(input.prefix);
        if (input.isParam) {
            //let paramtype = seed.paramtypes[input.role];
            let paramvalue = seed.parameters[input.role];
            if (!paramvalue)
                paramvalue = input.paramDefaultValue;
            args.push(paramvalue);
            plainargs.push(paramvalue);
        }
        else {
            let datasets = seed.datasets[input.role];
            datasets.map((ds: string) => {
                // Copy input files to tempdir
                let ifile = inputdir + "/" + ds;
                let newifile = tempdir + "/" + ds;
                //fs.symlinkSync(ifile, newifile);
                fs.copyFileSync(ifile, newifile);
                args.push(ds)
                plainargs.push(ds);
            });
        }
    })
    
    // Set the output file arguments for the command
    // Create the output file suffix based on a hash of inputs
    let opsuffix = Md5.hashAsciiStr(seed.ensemble.modelid + plainargs.join());
    let results: any = {};
    comp.outputs.map((output: any) => {
        args.push(output.prefix);
        let opfilename = output.role + "-" + opsuffix;
        let opfilepath = outputdir + "/" + opfilename;
        args.push(opfilename);
        let opfileurl = opfilepath.replace(localex.datadir, localex.dataurl);
        results[output.role] = {
            id: output.role,
            name: opfilename,
            url: opfileurl,
            location: opfilepath
        }
    });

    let logstdout = localex.logdir + "/" + seed.ensemble.id + ".log";

    let logstream = fs.createWriteStream(logstdout);
    logstream.write("current working directory: " + tempdir + "\n");
    logstream.close();

    // Check if this component requires a docker image via the model definition
    // - or via the older pegasus job properties file

    let softwareImage = comp.softwareImage;
    let error = null;
    let statusCode = 0;

    let cwl_file = comp.rundir + "/run.cwl";
    console.log(cwl_file)
    let cwl_outputs: any = {}
    if (fs.existsSync(cwl_file)) {
        if (! fs.existsSync(tempdir))
            fs.mkdirSync(tempdir)
        let cwl_values_file = write_cwl_values(comp, seed, inputdir, tempdir, outputdir, plainargs)
        let cwl_args: string[] = [];
        let cwl_command = "cwltool"
        cwl_args.push("--copy-outputs")
        cwl_args.push("--debug")
        cwl_args.push("--enable-pull")
        cwl_args.push(cwl_file)
        cwl_args.push(cwl_values_file)
        console.log("running a new execution " + logstdout)
        console.log("temporal directory " + tempdir)

        console.log(cwl_command + " " + cwl_args.join(" ") + "\n");
        let spawnResult = child_process.spawnSync(cwl_command, cwl_args, {
            cwd: tempdir,
            shell: true,
            maxBuffer: 1024 * 1024 * 50 // 50 MB of log cutoff
        });
        
        // Write log file
        logstream = fs.createWriteStream(logstdout, { 'flags': 'a' });
        logstream.write("\n------- STDOUT ---------\n");
        logstream.write(spawnResult.stdout);
        if (spawnResult.error)
            logstream.write(spawnResult.error.message);
        logstream.write("\n------- STDERR ---------\n");
        logstream.write(spawnResult.stderr);    
        logstream.close();
        if (spawnResult.error) {
            error = spawnResult.error.message;
        }
        statusCode = spawnResult.status;
        if (statusCode == 0){
            cwl_outputs = JSON.parse(spawnResult.stdout.toString())
        }
    }
    else if (softwareImage != null) {
        logstream = fs.createWriteStream(logstdout, { 'flags': 'a' });
        
        // Run command in docker image
        let folderBindings = [`${tempdir}:${tempdir}`, `${localex.datadir}:${localex.datadir}`];
        let data = await runImage(args, softwareImage, logstream, tempdir, folderBindings);
        var output = data[0];
        var container: Container = data[1];
        statusCode = output.StatusCode;
        
        // Clean up
        logstream.close();
        await container.remove({force: true});
    }
    else {
        let pegasus_jobprops_file = comp.rundir + "/__pegasus-job.properties";
        if (fs.existsSync(pegasus_jobprops_file)) {
            let jobprops = fs.readFileSync(pegasus_jobprops_file);
            let matches: RegExpMatchArray = jobprops.toString().match(/SingularityImage = "(.+)"/);
            if (matches.length > 1) {
                command = "singularity";
                args.push("exec");
                args.push(matches[1]);
            }
        }

        // Spawn the process & pipe stdout and stderr
        let spawnResult = child_process.spawnSync(command, args, {
            cwd: tempdir,
            shell: true,
            maxBuffer: 1024 * 1024 * 50 // 50 MB of log cutoff
        });
        
        // Write log file
        logstream = fs.createWriteStream(logstdout, { 'flags': 'a' });
        logstream.write("\n------- STDOUT ---------\n");
        logstream.write(spawnResult.stdout);
        if (spawnResult.error)
            logstream.write(spawnResult.error.message);
        logstream.write("\n------- STDERR ---------\n");
        logstream.write(spawnResult.stderr);    
        logstream.close();
        if (spawnResult.error) {
            error = spawnResult.error.message;
        }
        statusCode = spawnResult.status;
    }

    // Check for Errors
    if(statusCode != 0) {
        error = "Execution returned with non-zero status code";
    }
    else if (fs.existsSync(cwl_file)) {
        Object.values(results).map((result: any) => {
            let tmpfile = cwl_outputs[result.id]["path"];
            let extension = path.extname(tmpfile);
            result.location = result.location + extension;
            result.url = result.url + extension;
            if (fs.existsSync(tmpfile)) {
                fs.copyFileSync(tmpfile, result.location);
            }
            else {
                //console.log(`${tmpfile} not found!`)
                error = `${tmpfile} not found!`;
            }
        });
        // Set the results
        seed.ensemble.results = results;
    }
    else {
        // Check results (output files)
        // - Copy output files from tempdir to output dir
        // - Mark an error if any output file is missing
        Object.values(results).map((result: any) => {
            var tmpfile = tempdir + "/" + result.name;
            if (fs.existsSync(tmpfile)) {
                fs.copyFileSync(tmpfile, result.location);
            }
            else {
                //console.log(`${tmpfile} not found!`)
                error = `${tmpfile} not found!`;
            }
        });
        // Set the results
        seed.ensemble.results = results;
    }

    // Set the ensemble status
    seed.ensemble.status = "SUCCESS";    
    seed.ensemble.run_progress = 1;
    if(error) {
        seed.ensemble.status = "FAILURE";
    }

    // Remove temporary directory
    fs.remove(tempdir);

    // Update ensemble status and results in backend
    if(!DEVMODE)
        await saveEnsemble(seed.ensemble);

    // Return job ensemble or error
    if(seed.ensemble.status == "SUCCESS")
        return Promise.resolve(seed.ensemble);
    else
        return Promise.reject(new Error(error));

}


const write_cwl_values = (comp: Component, seed: any, inputdir: string, 
    tempdir: string, outputdir: string, plainargs: string[]) => {
    let execution_dir = comp.rundir 
    interface CwlValueFile {
        class: string,
        location: string
    }
    let data : Record<string, string | CwlValueFile> = {}

    comp.inputs.map((input: any) => {
        if (input.isParam) {
            //let paramtype = seed.paramtypes[input.role];
            let paramvalue = seed.parameters[input.role];
            if (!paramvalue)
                paramvalue = input.paramDefaultValue;
            data[input.role] = paramvalue
        }
        else {
            let datasets = seed.datasets[input.role];
            datasets.map((ds: string) => {
                // Copy input files to tempdir
                let ifile = inputdir + "/" + ds;
                let newifile = tempdir + "/" + ds;
                //fs.symlinkSync(ifile, newifile);
                fs.copyFileSync(ifile, newifile);
                data[input.role] = {"class": "File", "location": newifile}
            });
        }
    })

    // Set the output file arguments for the command
    // Create the output file suffix based on a hash of inputs
    let opsuffix = Md5.hashAsciiStr(seed.ensemble.modelid + plainargs.join());
    let results: any = {};
    comp.outputs.map((output: any) => {
        let opfilename = output.role + "-" + opsuffix;
        let opfilepath = outputdir + "/" + opfilename;
        data[output.role] = {"class": "File", "location": opfilename}
    });

    let valuesFile = execution_dir + "/values.yml";
    let ymlStr = yaml.safeDump(data);
    fs.writeFileSync(valuesFile, ymlStr, 'utf8')
    console.log("writing the values file " + valuesFile);
    return valuesFile
}