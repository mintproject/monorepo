import { Apps, Jobs } from "@mfosorio/tapis-typescript";
import { DataResource, Model, ModelIO } from "../../../classes/mint/mint-types";
import { TapisComponentSeed } from "../typing";

const ALLOCATION = "PT2050-DataX";
const SYSTEM_LOGICAL_QUEUE = "development";
const SYSTEM_ID = "ls6";

const createJobRequest = (
    app: Apps.TapisApp,
    seed: TapisComponentSeed,
    model: Model
): Jobs.ReqSubmitJob => {
    const jobFileInputs = createJobFileInputsFromSeed(seed, app, model);
    const request: Jobs.ReqSubmitJob = {
        name: seed.execution.id,
        appId: app.id,
        appVersion: app.version,
        fileInputs: jobFileInputs,
        nodeCount: 1,
        coresPerNode: 1,
        maxMinutes: 10,
        archiveSystemId: "ls6",
        archiveSystemDir:
            "HOST_EVAL($WORK)/tapis-jobs-archive/${JobCreateDate}/${JobName}-${JobUUID}",
        archiveOnAppError: true,
        execSystemId: SYSTEM_ID,
        execSystemLogicalQueue: SYSTEM_LOGICAL_QUEUE,
        parameterSet: {
            appArgs: [],
            containerArgs: [],
            schedulerOptions: [
                {
                    name: "TACC Allocation",
                    description: "The TACC allocation associated with this job execution",
                    include: true,
                    arg: `-A ${ALLOCATION}`
                }
            ],
            envVariables: []
        }
    };
    return request;
};

const createJobFileInputsFromSeed = (
    seed: TapisComponentSeed,
    app: Apps.TapisApp,
    model: Model
): Array<Jobs.JobFileInput> => {
    const jobInputs = app.jobAttributes.fileInputs.flatMap((fileInput: Apps.AppFileInput) => {
        const modelInput = model.input_files.find((modelInputFile: ModelIO) => {
            return modelInputFile.name.toLowerCase() === fileInput.name.toLowerCase();
        });
        if (!modelInput) {
            throw new Error(`Component input not found for ${fileInput.name}`);
        }
        const datasets = seed.datasets[modelInput.id] || [];
        return datasets.map((dataset: DataResource) => {
            return {
                name: modelInput.name,
                sourceUrl: dataset.url
            } as Jobs.JobFileInput;
        });
    });
    return jobInputs;
};

export { createJobRequest, createJobFileInputsFromSeed };
