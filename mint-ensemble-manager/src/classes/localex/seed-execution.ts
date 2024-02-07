import yaml from "js-yaml";
import os, { type } from "os";
import fs from "fs-extra";
import { Md5 } from "ts-md5";
import child_process from "child_process";
import {
    incrementThreadModelSubmittedRuns,
    incrementThreadModelSuccessfulRuns,
    incrementThreadModelFailedRuns,
    updateExecutionStatusAndResults,
    updateExecutionStatus
} from "../graphql/graphql_functions";
import { Component, ComponentSeed, ComponentArgument } from "./local-execution-types";
import { runImage } from "./docker-functions";
import { Container } from "dockerode";
import { DEVMODE } from "../../config/app";
import { LocalExecutionPreferences, DataResource, DateRange } from "../mint/mint-types";

import { KeycloakAdapter } from "../../config/keycloak-adapter";
import { fetchMintConfig } from "../mint/mint-functions";

module.exports = async (job: any) => {
    // Run the model seed (model config + bindings)

    // Clone the job data object
    job.data = JSON.parse(JSON.stringify(job.data));

    const seed: ComponentSeed = job.data.seed;
    const localex: LocalExecutionPreferences = job.data.prefs;
    const thread_model_id: string = job.data.thread_model_id;

    const prefs = await fetchMintConfig();
    await KeycloakAdapter.signIn(prefs.graphql.username, prefs.graphql.password);

    // Only increment submitted runs if this isn't a retry
    if (seed.execution.status != "FAILURE" && !DEVMODE)
        incrementThreadModelSubmittedRuns(thread_model_id);

    seed.execution.start_time = new Date();

    // Initialize log file
    if (!fs.existsSync(localex.logdir)) fs.mkdirsSync(localex.logdir);
    const logstdout = localex.logdir + "/" + seed.execution.id + ".log";
    fs.removeSync(logstdout);

    // Setup execution
    let error = null;
    const comp: Component = seed.component;
    const inputdir = localex.datadir;
    let outputdir = localex.datadir;

    // Create temporary directory
    const ostmp = localex.tempdir;
    if (!fs.existsSync(ostmp)) fs.mkdirsSync(ostmp);
    const tmpprefix = ostmp + "/" + seed.execution.modelid.replace(/.*\//, "");
    const tempdir = fs.mkdtempSync(tmpprefix);
    console.log(tempdir);

    try {
        // Copy component run directory to tempdir
        fs.copySync(comp.rundir, tempdir);

        // Set the execution engine used for this execution
        seed.execution.execution_engine = "localex";

        // Data/Parameter arguments to the script (will be setup below)
        const args: string[] = [];
        const plainargs: string[] = [];

        // Default invocation is via Bash
        let command = "bash";

        // The entry point of the component (run script)
        args.push("./run");

        // Set the Input file/parameter arguments for the command
        let time_period: DateRange = null;
        let spatial_coverage: any = null;
        comp.inputs.map((input: ComponentArgument) => {
            args.push(input.prefix);
            plainargs.push(input.prefix);
            if (input.isParam) {
                //let paramtype = seed.paramtypes[input.id];
                let paramvalue = seed.parameters[input.id];
                if (!paramvalue) paramvalue = input.paramDefaultValue;
                args.push(paramvalue);
                plainargs.push(paramvalue);
            } else {
                const datasets = seed.datasets[input.id] || [];
                datasets.map((ds: DataResource) => {
                    // Copy input files to tempdir
                    const ifile = inputdir + "/" + ds.name;
                    const newifile = tempdir + "/" + ds.name;
                    fs.symlinkSync(ifile, newifile);
                    //fs.copyFileSync(ifile, newifile);
                    args.push(ds.name);
                    plainargs.push(ds.name);

                    // Copy over spatio-temporal metadata from inputs
                    if (ds.time_period) time_period = ds.time_period;
                    if (ds.spatial_coverage) spatial_coverage = ds.spatial_coverage;
                });
            }
        });

        // Set the output file arguments for the command
        // Create the output file suffix based on a hash of inputs
        const opsuffix = "-" + Md5.hashAsciiStr(seed.execution.modelid + plainargs.join());
        const results: any = {};
        comp.outputs.map((output: ComponentArgument) => {
            args.push(output.prefix);
            const opid = output.id + opsuffix;
            let opfilename = output.role + opsuffix;
            if (output.format) {
                opfilename += "." + output.format;
            }
            const opfilepath = outputdir + "/" + opfilename;
            args.push(opfilename);
            const opfileurl = opfilepath.replace(localex.datadir, localex.dataurl);
            results[output.id] = {
                id: opid,
                name: opfilename,
                url: opfileurl,
                role: output.role,
                time_period: time_period ?? {},
                spatial_coverage: spatial_coverage
            } as DataResource;
        });

        let logstream = fs.createWriteStream(logstdout);
        logstream.write("current working directory: " + tempdir + "\n");
        logstream.write(command + " " + args.join(" ") + "\n");
        logstream.close();

        // Check if this component requires a docker image via the model definition
        // - or via the older pegasus job properties file

        const softwareImage = comp.softwareImage;
        let statusCode = 0;

        const cwl_file = comp.rundir + "/run.cwl";
        let cwl_outputs: any = {};
        let is_cwl = false;

        if (!fs.existsSync(tempdir)) fs.mkdirsSync(tempdir);

        if (fs.existsSync(cwl_file)) {
            console.log("Running cwl:");
            is_cwl = true;

            // Create cwl output directory
            const output_suffix_cwl = Md5.hashAsciiStr(seed.execution.modelid + plainargs.join());
            outputdir = outputdir + "/" + output_suffix_cwl;
            if (!fs.existsSync(outputdir)) {
                fs.mkdirsSync(outputdir);
            }

            const cwl_values_file = write_cwl_values(
                comp,
                seed,
                results,
                inputdir,
                tempdir,
                outputdir,
                plainargs
            );
            const cwl_args: string[] = [];
            const cwl_command = "cwltool";
            cwl_args.push("--no-read-only");
            cwl_args.push("--copy-outputs");
            cwl_args.push("--no-match-user");
            //cwl_args.push("--user-space-docker-cmd")
            //cwl_args.push("docker")
            cwl_args.push(cwl_file);
            cwl_args.push(cwl_values_file);
            console.log("running a new execution " + logstdout);
            console.log("temporary directory " + tempdir);

            console.log(cwl_command + " " + cwl_args.join(" ") + "\n");
            const spawnResult = child_process.spawnSync(cwl_command, cwl_args, {
                cwd: tempdir,
                shell: true,
                maxBuffer: 1024 * 1024 * 50 // 50 MB of log cutoff
            });

            // Write log file
            logstream = fs.createWriteStream(logstdout, { flags: "a" });
            logstream.write("\n------- STDOUT ---------\n");
            logstream.write(spawnResult.stdout);
            if (spawnResult.error) logstream.write(spawnResult.error.message);
            logstream.write("\n------- STDERR ---------\n");
            logstream.write(spawnResult.stderr);
            logstream.close();
            if (spawnResult.error) {
                error = spawnResult.error.message;
            }
            statusCode = spawnResult.status;
            if (statusCode == 0) {
                cwl_outputs = JSON.parse(spawnResult.stdout.toString());
            }
        } else if (softwareImage != null) {
            console.log("Running as a Docker Image:");
            logstream = fs.createWriteStream(logstdout, { flags: "a" });

            // Run command in docker image
            const folderBindings = [`${tempdir}:${tempdir}`, `${localex.datadir}:${localex.datadir}`];
            const data = await runImage(args, softwareImage, logstream, tempdir, folderBindings);
            const output = data[0];
            const container: Container = data[1];
            statusCode = output.StatusCode;

            // Clean up
            logstream.close();
            await container.remove({ force: true });
        } else {
            console.log("Running as a Singularity Information");
            const pegasus_jobprops_file = comp.rundir + "/__pegasus-job.properties";
            if (fs.existsSync(pegasus_jobprops_file)) {
                const jobprops = fs.readFileSync(pegasus_jobprops_file);
                const matches: RegExpMatchArray = jobprops
                    .toString()
                    .match(/SingularityImage = "(.+)"/);
                if (matches.length > 1) {
                    command = "singularity";
                    args.push("exec");
                    args.push(matches[1]);
                }
            }

            // Spawn the process & pipe stdout and stderr
            const spawnResult = child_process.spawnSync(command, args, {
                cwd: tempdir,
                shell: true,
                maxBuffer: 1024 * 1024 * 50 // 50 MB of log cutoff
            });

            // Write log file
            logstream = fs.createWriteStream(logstdout, { flags: "a" });
            logstream.write("\n------- STDOUT ---------\n");
            logstream.write(spawnResult.stdout);
            if (spawnResult.error) logstream.write(spawnResult.error.message);
            logstream.write("\n------- STDERR ---------\n");
            logstream.write(spawnResult.stderr);
            logstream.close();
            if (spawnResult.error) {
                error = spawnResult.error.message;
            }
            statusCode = spawnResult.status;
        }

        // Check for Errors & Process Results
        if (statusCode != 0) {
            error = "Execution returned with non-zero status code";
        } else {
            // Process Results
            Object.values(results).map((result: any) => {
                // Rename temporary output files to desired output name
                let desired_output_file = null;
                let tmp_output_file = null;
                if (is_cwl) {
                    result.name = result.role;
                    if (result.role !== undefined && result.role in cwl_outputs) {
                        const cwl_output = cwl_outputs[result.role];
                        desired_output_file = outputdir + "/" + cwl_output["basename"];
                        tmp_output_file = cwl_output["path"];
                    }
                } else {
                    tmp_output_file = tempdir + "/" + result.name;
                    desired_output_file = outputdir + "/" + result.name;
                }
                // Copy over the tempfile to desired output file
                if (tmp_output_file && desired_output_file) {
                    if (fs.existsSync(tmp_output_file)) {
                        fs.copyFileSync(tmp_output_file, desired_output_file);
                    }
                    const url = desired_output_file.replace(localex.datadir, localex.dataurl);
                    result.url = url;
                }
            });
            seed.execution.results = results;
        }

        // Remove temporary directory
        fs.removeSync(tempdir);
    } catch (e) {
        error = "ERROR: " + e;
        const logstream = fs.createWriteStream(logstdout);
        logstream.write("ERROR in Execution: \n");
        logstream.write(error + "\n");
        logstream.close();
    }

    // Set the execution status
    seed.execution.status = "SUCCESS";
    seed.execution.end_time = new Date();
    seed.execution.run_progress = 1;
    if (error) {
        seed.execution.status = "FAILURE";
    }

    // Update execution status and results in backend
    if (!DEVMODE) await updateExecutionStatusAndResults(seed.execution);

    // Return job execution or error
    if (seed.execution.status == "SUCCESS") {
        if (!DEVMODE) await incrementThreadModelSuccessfulRuns(thread_model_id);
        return Promise.resolve(seed.execution);
    } else {
        if (!DEVMODE) await incrementThreadModelFailedRuns(thread_model_id);
        return Promise.reject(new Error(error));
    }
};

const write_cwl_values = (
    comp: Component,
    seed: any,
    results: any,
    inputdir: string,
    tempdir: string,
    outputdir: string,
    plainargs: string[]
) => {
    const execution_dir = comp.rundir;
    interface CwlValueFile {
        class: string;
        location: string;
    }
    const data: Record<string, string | CwlValueFile> = {};
    comp.inputs.map((input: any) => {
        if (input.isParam) {
            const paramtype = seed.paramtypes[input.id];
            let paramvalue = seed.parameters[input.id];
            if (!paramvalue) paramvalue = input.paramDefaultValue;
            if (paramtype == "int") paramvalue = parseInt(paramvalue);
            else if (paramtype == "float") paramvalue = parseFloat(paramvalue);
            else if (paramtype == "boolean")
                paramvalue = paramvalue.toString().toLowerCase() == "true";
            else paramvalue = paramvalue.toString();
            data[input.role] = paramvalue;
        } else {
            const datasets = seed.datasets[input.id] || [];
            datasets.map((ds: string) => {
                // Copy input files to tempdir
                data[input.role] = { class: "File", location: ds["url"] };
            });
            console.log(datasets);
        }
    });

    // Set output file names
    Object.values(results).map((result: any) => {
        data[result.role] = { class: "File", location: result.name };
    });

    const valuesFile = tempdir + "/values.yml";
    const ymlStr = yaml.safeDump(data);
    fs.writeFileSync(valuesFile, ymlStr, "utf8");
    console.log("writing the values file " + valuesFile);
    return valuesFile;
};
