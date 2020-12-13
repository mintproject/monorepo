import os from "os";
import fs from "fs-extra";
import { Md5 } from "ts-md5";
import child_process from "child_process";
import { setExecutions, incrementThreadModelSubmittedRuns, incrementThreadModelSuccessfulRuns, incrementThreadModelFailedRuns, updateExecutionStatusAndResults } from "../graphql/graphql_functions";
import { Component, ComponentSeed, ComponentArgument } from "./local-execution-types";
import { runImage } from "./docker-functions";
import { Container } from "dockerode";
import { DEVMODE } from "../../config/app";
import { LocalExecutionPreferences, DataResource, DateRange } from "../mint/mint-types";

module.exports = async (job: any) => {
    // Run the model seed (model config + bindings)
    var seed: ComponentSeed = job.data.seed;
    var localex: LocalExecutionPreferences = job.data.prefs;
    var thread_model_id: string = job.data.thread_model_id;

    // Only increment submitted runs if this isn't a retry
    if(seed.execution.status != "FAILURE")
        incrementThreadModelSubmittedRuns(thread_model_id);

    seed.execution.start_time = new Date();

    let error = null;
    let comp : Component = seed.component;
    let inputdir = localex.datadir;
    let outputdir = localex.datadir;

    // Create temporary directory
    let ostmp = os.tmpdir();
    let tmpprefix = ostmp + "/" + seed.execution.modelid.replace(/.*\//, '');
    let tempdir = fs.mkdtempSync(tmpprefix);

    try {
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
        let time_period : DateRange = null;
        let spatial_coverage : any = null;
        comp.inputs.map((input: ComponentArgument) => {
            args.push(input.prefix);
            plainargs.push(input.prefix);
            if (input.isParam) {
                //let paramtype = seed.paramtypes[input.id];
                let paramvalue = seed.parameters[input.id];
                if (!paramvalue)
                    paramvalue = input.paramDefaultValue;
                args.push(paramvalue);
                plainargs.push(paramvalue);
            }
            else {
                let datasets = seed.datasets[input.id];
                datasets.map((ds: DataResource) => {
                    // Copy input files to tempdir
                    let ifile = inputdir + "/" + ds.name;
                    let newifile = tempdir + "/" + ds.name;
                    fs.symlinkSync(ifile, newifile);
                    //fs.copyFileSync(ifile, newifile);
                    args.push(ds.name)
                    plainargs.push(ds.name);

                    // Copy over spatio-temporal metadata from inputs
                    if(ds.time_period)
                        time_period = ds.time_period;
                    if(ds.spatial_coverage)
                        spatial_coverage = ds.spatial_coverage;
                });
            }
        })
        
        // Set the output file arguments for the command
        // Create the output file suffix based on a hash of inputs
        let opsuffix = "-" + Md5.hashAsciiStr(seed.execution.modelid + plainargs.join());
        let results: any = {};
        comp.outputs.map((output: ComponentArgument) => {
            args.push(output.prefix);
            let opid = output.id + opsuffix;
            let opfilename = output.role + opsuffix;
            if(output.format) {
                opfilename += "." + output.format;
            }
            let opfilepath = outputdir + "/" + opfilename;
            args.push(opfilename);
            let opfileurl = opfilepath.replace(localex.datadir, localex.dataurl);
            results[output.id] = {
                id: opid,
                name: opfilename,
                url: opfileurl,
                time_period: time_period ?? {},
                spatial_coverage: spatial_coverage
            } as DataResource
        });

        let logstdout = localex.logdir + "/" + seed.execution.id + ".log";

        let logstream = fs.createWriteStream(logstdout);
        logstream.write("current working directory: " + tempdir + "\n");
        logstream.write(command + " " + args.join(" ") + "\n");
        logstream.close();

        // Check if this component requires a docker image via the model definition
        // - or via the older pegasus job properties file

        let softwareImage = comp.softwareImage;
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
            Object.values(results).map((result: DataResource) => {
                var tmpfile = tempdir + "/" + result.name;
                if (fs.existsSync(tmpfile)) {
                    let opfilepath = outputdir + "/" + result.name;
                    fs.copyFileSync(tmpfile, opfilepath);
                }
                else {
                    //console.log(`${tmpfile} not found!`)
                    error = `${tmpfile} not found!`;
                }
            });
            // Set the results
            seed.execution.results = results;
        }
    }
    catch(e) {
        error = e + "";
    }

    // Set the execution status
    seed.execution.status = "SUCCESS";    
    seed.execution.end_time = new Date();
    seed.execution.run_progress = 1;
    if(error) {
        seed.execution.status = "FAILURE";
    }

    // Remove temporary directory
    fs.remove(tempdir);

    // Update execution status and results in backend
    if(!DEVMODE) {
        updateExecutionStatusAndResults(seed.execution);
    }

    // Return job execution or error
    if(seed.execution.status == "SUCCESS") {
        if(!DEVMODE)
            incrementThreadModelSuccessfulRuns(thread_model_id);
        return Promise.resolve(seed.execution);
    }
    else {
        if(!DEVMODE)
            incrementThreadModelFailedRuns(thread_model_id);
        return Promise.reject(new Error(error));
    }

}
