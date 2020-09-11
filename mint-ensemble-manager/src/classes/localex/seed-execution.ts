import os from "os";
import fs from "fs-extra";
import { Md5 } from "ts-md5";
import child_process from "child_process";
import { saveExecution } from "../graphql/graphql_functions";
import { Component } from "./local-execution-types";
import { runImage } from "./docker-functions";
import { Container } from "dockerode";
import { DEVMODE } from "../../config/app";

module.exports = async (job: any) => {
    // Run the model seed (model config + bindings)
    var seed: any = job.data.seed;
    var localex: any = job.data.prefs;

    let comp : Component = seed.component;
    let inputdir = localex.datadir;
    let outputdir = localex.datadir;

    // Create temporary directory
    let ostmp = os.tmpdir();
    let tmpprefix = ostmp + "/" + seed.execution.modelid.replace(/.*\//, '');
    let tempdir = fs.mkdtempSync(tmpprefix);

    // Copy component run directory to tempdir
    fs.copySync(comp.rundir, tempdir);

    // Set the execution engine used for this execution
    seed.execution.execution_engine = "localex";

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
    let opsuffix = Md5.hashAsciiStr(seed.execution.modelid + plainargs.join());
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

    let logstdout = localex.logdir + "/" + seed.execution.id + ".log";

    let logstream = fs.createWriteStream(logstdout);
    logstream.write("current working directory: " + tempdir + "\n");
    logstream.write(command + " " + args.join(" ") + "\n");
    logstream.close();

    // Check if this component requires a docker image via the model definition
    // - or via the older pegasus job properties file

    let softwareImage = comp.softwareImage;
    let error = null;
    let statusCode = 0;
    if (softwareImage != null) {
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
        seed.execution.results = results;
    }

    // Set the execution status
    seed.execution.status = "SUCCESS";    
    seed.execution.run_progress = 1;
    if(error) {
        seed.execution.status = "FAILURE";
    }

    // Remove temporary directory
    fs.remove(tempdir);

    // Update execution status and results in backend
    if(!DEVMODE)
        await saveExecution(seed.execution);

    // Return job execution or error
    if(seed.execution.status == "SUCCESS")
        return Promise.resolve(seed.execution);
    else
        return Promise.reject(new Error(error));

}