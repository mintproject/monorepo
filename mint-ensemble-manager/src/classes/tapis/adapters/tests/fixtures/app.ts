import { Apps } from "@tapis/tapis-typescript";

export default {
    id: "modflow-2005",
    version: "0.0.4",
    description: "Run an non-interactive script on TACC using docker.",
    owner: "${apiUserId}",
    enabled: true,
    runtime: "SINGULARITY",
    runtimeVersion: null,
    runtimeOptions: ["SINGULARITY_RUN"],
    containerImage: "docker://ghcr.io/mosoriob/cookbook-modflow:0.0.4",
    jobType: "BATCH",
    maxJobs: -1,
    maxJobsPerUser: -1,
    strictFileInputs: true,
    jobAttributes: {
        description: null,
        dynamicExecSystem: false,
        execSystemConstraints: null,
        execSystemId: "ls6",
        execSystemExecDir: "${JobWorkingDir}",
        execSystemInputDir: "${JobWorkingDir}",
        execSystemOutputDir: "${JobWorkingDir}/output",
        execSystemLogicalQueue: "development",
        archiveSystemId: "ls6",
        archiveSystemDir:
            "HOST_EVAL($WORK)/tapis-jobs-archive/${JobCreateDate}/${JobName}-${JobUUID}",
        archiveOnAppError: true,
        isMpi: false,
        mpiCmd: null,
        cmdPrefix: "mkdir $PWD/work $PWD/home $PWD/scratch;",
        parameterSet: {
            appArgs: [],
            schedulerOptions: [
                {
                    name: "TACC Scheduler Profile",
                    description: "Scheduler profile for HPC clusters at TACC",
                    inputMode: "FIXED",
                    arg: "--tapis-profile tacc-apptainer",
                    notes: {
                        isHidden: true
                    }
                },
                {
                    name: "TAP Session Substring",
                    description:
                        "TAP Functions require the substring 'tap_' and in the slurm job name in order to function.",
                    inputMode: "FIXED",
                    arg: "--job-name ${JobName}-tap_",
                    notes: {
                        isHidden: true
                    }
                }
            ],
            envVariables: [],
            archiveFilter: {
                includes: [],
                excludes: [],
                includeLaunchFiles: true
            }
        },
        fileInputs: [
            {
                name: "bas6",
                description: "Basic Package Input for the Groundwater Flow Process",
                inputMode: "REQUIRED",
                autoMountLocal: true,
                sourceUrl: null,
                targetPath: "input.ba6"
            },
            {
                name: "dis",
                description: "Discretization file",
                inputMode: "REQUIRED",
                autoMountLocal: true,
                sourceUrl: null,
                targetPath: "input.dis"
            },
            {
                name: "bcf6",
                description: "Block centered flow package file",
                inputMode: "REQUIRED",
                autoMountLocal: true,
                sourceUrl: null,
                targetPath: "input.bc6"
            },
            {
                name: "oc",
                description: "Output control file",
                inputMode: "REQUIRED",
                autoMountLocal: true,
                sourceUrl: null,
                targetPath: "input.dat"
            },
            {
                name: "wel",
                description: "Well file",
                inputMode: "REQUIRED",
                autoMountLocal: true,
                sourceUrl: null,
                targetPath: "input.dat"
            },
            {
                name: "drn",
                description: "Drain package file",
                inputMode: "REQUIRED",
                autoMountLocal: true,
                sourceUrl: null,
                targetPath: "input.dat"
            },
            {
                name: "hfb6",
                description: "Horizontal flow barrier file",
                inputMode: "REQUIRED",
                autoMountLocal: true,
                sourceUrl: null,
                targetPath: "input.hf6"
            },
            {
                name: "sip",
                description: "Strongly Implicit Procedure package file",
                inputMode: "REQUIRED",
                autoMountLocal: true,
                sourceUrl: null,
                targetPath: "input.dat"
            },
            {
                name: "rch",
                description: "Recharge file",
                inputMode: "REQUIRED",
                autoMountLocal: true,
                sourceUrl: null,
                targetPath: "input.rch"
            }
        ],
        fileInputArrays: [],
        nodeCount: 1,
        coresPerNode: 1,
        memoryMB: 1000,
        maxMinutes: 10,
        subscriptions: [],
        tags: []
    },
    tags: ["portalName: ALL"],
    notes: {
        label: "MODFLOW 2005",
        helpUrl: "https://github.com/In-For-Disaster-Analytics/cookbook-conda-template",
        helpText:
            "Modflow is a popular open-source groundwater flow model distributed by the U.S. Geological survey",
        hideNodeCountAndCoresPerNode: true,
        isInteractive: false,
        icon: "jupyter",
        category: "Data Processing",
        queueFilter: ["development", "normal"]
    }
} as Apps.TapisApp;
