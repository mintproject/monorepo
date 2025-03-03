import { Apps, Jobs } from "@mfosorio/tapis-typescript";
import { DataResource, Model } from "@/classes/mint/mint-types";
import { TapisComponentSeed } from "@/classes/tapis/typing";

export class TapisJobService {
    private static readonly ALLOCATION = "PT2050-DataX";
    private static readonly SYSTEM_LOGICAL_QUEUE = "development";
    private static readonly SYSTEM_ID = "ls6";

    constructor(
        private jobsClient: Jobs.JobsApi,
        private subscriptionsClient: Jobs.SubscriptionsApi,
        private jobShareClient: Jobs.ShareApi
    ) {}

    async shareJob(jobId: string) {
        await this.jobShareClient.shareJob({
            jobUuid: jobId,
            reqShareJob: {
                jobResource: [Jobs.ReqShareJobJobResourceEnum.Output],
                jobPermission: Jobs.ReqShareJobJobPermissionEnum.Read
            }
        });
    }

    createJobRequest = (
        app: Apps.TapisApp,
        seed: TapisComponentSeed,
        model: Model
    ): Jobs.ReqSubmitJob => {
        const jobFileInputs = this.createJobFileInputsFromSeed(seed, app, model);
        const request: Jobs.ReqSubmitJob = {
            name: seed.execution.id,
            appId: app.id,
            appVersion: app.version,
            fileInputs: jobFileInputs,
            nodeCount: 1,
            coresPerNode: 1,
            maxMinutes: 10,
            archiveSystemId: "cloud.data",
            archiveSystemDir:
                "HOST_EVAL($HOME)/tapis-jobs-archive/${JobCreateDate}/${JobName}-${JobUUID}",
            archiveOnAppError: true,
            execSystemId: TapisJobService.SYSTEM_ID,
            execSystemLogicalQueue: TapisJobService.SYSTEM_LOGICAL_QUEUE,
            parameterSet: {
                appArgs: [],
                containerArgs: [],
                schedulerOptions: [
                    {
                        name: "TACC Allocation",
                        description: "The TACC allocation associated with this job execution",
                        include: true,
                        arg: `-A ${TapisJobService.ALLOCATION}`
                    }
                ],
                envVariables: []
            }
        };

        return request;
    };

    private createJobFileInputsFromSeed(
        seed: TapisComponentSeed,
        app: Apps.TapisApp,
        model: Model
    ): Jobs.JobFileInput[] {
        const jobInputs =
            app.jobAttributes?.fileInputs?.flatMap((fileInput) => {
                const modelInput = model.input_files.find((input) => input.name === fileInput.name);

                if (!modelInput) {
                    throw new Error(`Component input not found for ${fileInput.name}`);
                }

                const datasets = seed.datasets[modelInput.id] || [];
                return datasets.map(
                    (dataset: DataResource) =>
                        ({
                            name: modelInput.name,
                            sourceUrl: dataset.url
                        }) as Jobs.JobFileInput
                );
            }) || [];

        return jobInputs;
    }
}
