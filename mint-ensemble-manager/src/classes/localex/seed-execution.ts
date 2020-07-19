import os from "os";
import fs from "fs-extra";
import { Md5 } from "ts-md5";
import child_process from "child_process";
import { incrementPathwaySuccessfulRuns, updatePathwayEnsembleStatus, incrementPathwayFailedRuns, saveEnsemble } from "../mint/firebase-functions";

module.exports = function (job: any) {
    // Run the model seed (model config + bindings)
    var scenario_id: string = job.data.scenario_id;
    var pathway_id: string = job.data.pathway_id;
    var seed: any = job.data.seed;
    var localex: any = job.data.prefs;

    let comp = seed.component;
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

    // Check if a singularity image is present
    // If so, change invocation command to singularity
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
    logstream.write(command + " " + args.join(" ") + "\n");
    logstream.close();

    // Spawn the process & pipe stdout and stderr
    child_process.execFile(command, args, {
        cwd: tempdir,
        shell: true,
        maxBuffer: 1024 * 1024 * 50 // 50 MB of log cutoff
    }, (error, stdout, stderr) => {
        // Write log file
        let logstream = fs.createWriteStream(logstdout, { 'flags': 'a' });
        logstream.write("\n------- STDERR ---------\n");
        logstream.write(stderr);
        if (error) {
            logstream.write(error.message);
        }
        logstream.write("\n------- STDOUT ---------\n");
        logstream.write(stdout);
        logstream.close();

        // Update ensemble status
        seed.ensemble.run_progress = 1;
        if (error) {
            seed.ensemble.status = "FAILURE";
        }
        else {
            seed.ensemble.status = "SUCCESS";

            // Copy output files from tempdir to output dir
            Object.values(results).map((result: any) => {
                var tmpfile = tempdir + "/" + result.name;
                if (fs.existsSync(tmpfile)) {
                    fs.copyFileSync(tmpfile, result.location);
                }
                else {
                    console.log(`${tmpfile} not found!`)
                    seed.ensemble.status = "FAILURE";
                }
            });

            // Set the results
            seed.ensemble.results = results;
        }

        // Remove temporary directory
        fs.remove(tempdir);

        // Update ensemble status and results
        saveEnsemble(seed.ensemble);
        // updatePathwayEnsembleStatus(seed.ensemble);

        // Increment number of successful/failed runs
        // - Doing this in another monitor job, otherwise it results in too many updates
        /*
        if(seed.ensemble.status == "SUCCESS")
            incrementPathwaySuccessfulRuns(scenario_id, pathway_id, ensemble.modelid)
        if(seed.ensemble.status == "FAILURE")
            incrementPathwayFailedRuns(scenario_id, pathway_id, ensemble.modelid) 
            */

        return Promise.resolve(seed.ensemble);
    });

}