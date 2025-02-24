import { Apps, Jobs } from "@mfosorio/tapis-typescript";
import { DataResource, Model } from "../../../classes/mint/mint-types";
import { TapisComponentSeed } from "../typing";
import { TapisNotification } from "./notification";
import { IExecutionService, ExecutionJob } from "../../../interfaces/IExecutionService";

export class TapisAdapter implements IExecutionService {
    private apps: Apps.TapisApp;
    private jobsClient: Jobs.JobsClient;

    constructor(
        private apiKey: string,
        private baseUrl: string,
        private model: Model
    ) {
        // Initialize Tapis clients here
        // Note: You'll need to implement the actual client initialization
    }

    async submitJob(code: string, params: Record<string, any>): Promise<string> {
        const seed: TapisComponentSeed = this.createSeedFromParams(params);
        const jobRequest = TapisAdapter.createJobRequest(this.apps, seed, this.model);

        const response = await this.jobsClient.submitJob(jobRequest);
        return response.uuid;
    }

    async getJobStatus(jobId: string): Promise<ExecutionJob> {
        const job = await this.jobsClient.getJob(jobId);

        return {
            id: job.uuid,
            status: this.mapTapisStatus(job.status),
            result: job.lastMessage,
            error: job.errorMessage
        };
    }

    async cancelJob(jobId: string): Promise<boolean> {
        try {
            await this.jobsClient.cancelJob(jobId);
            return true;
        } catch (error) {
            console.error(`Failed to cancel job ${jobId}:`, error);
            return false;
        }
    }

    private mapTapisStatus(tapisStatus: string): "pending" | "running" | "completed" | "failed" {
        switch (tapisStatus.toLowerCase()) {
            case "pending":
            case "processing_inputs":
            case "staging_inputs":
                return "pending";
            case "running":
            case "archiving":
                return "running";
            case "finished":
            case "archived":
                return "completed";
            case "failed":
            case "cancelled":
            case "paused":
            default:
                return "failed";
        }
    }

    private createSeedFromParams(params: Record<string, any>): TapisComponentSeed {
        // Implementation to convert generic params to TapisComponentSeed
        // You'll need to implement this based on your specific needs
        return {
            component: { id: params.componentId },
            datasets: params.datasets || {}
        } as TapisComponentSeed;
    }

    // Existing static methods
    private static readonly ALLOCATION = "PT2050-DataX";
    private static readonly SYSTEM_LOGICAL_QUEUE = "development";
    private static readonly SYSTEM_ID = "ls6";

    private static createJobRequest(
        app: Apps.TapisApp,
        seed: TapisComponentSeed,
        model: Model
    ): Jobs.ReqSubmitJob {
        const jobFileInputs = this.createJobFileInputsFromSeed(seed, app, model);

        return {
            name: seed.component.id,
            appId: app.id,
            appVersion: app.version,
            archiveSystemId: TapisAdapter.SYSTEM_ID,
            memoryMB: app.jobAttributes?.memoryMB || 1000,
            maxMinutes: app.jobAttributes?.maxMinutes || 10,
            nodeCount: app.jobAttributes?.nodeCount || 1,
            coresPerNode: app.jobAttributes?.coresPerNode || 1,
            fileInputs: jobFileInputs,
            parameterSet: { appArgs: [] },
            execSystemId: TapisAdapter.SYSTEM_ID,
            execSystemLogicalQueue: TapisAdapter.SYSTEM_LOGICAL_QUEUE,
            execSystemExecDir: "HOST_EVAL($SCRATCH)",
            archiveSystemDir: "HOST_EVAL($WORK)",
            tags: [`allocation:${TapisAdapter.ALLOCATION}`]
        };
    }

    private static createJobFileInputsFromSeed(
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
                return datasets.map((dataset: DataResource) => {
                    return {
                        name: modelInput.name,
                        sourceUrl: dataset.url
                    } as Jobs.JobFileInput;
                });
            }) || [];

        return jobInputs;
    }

    public static processNotification(notification: TapisNotification): {
        status: string;
        jobId: string;
    } {
        return {
            status: notification.type.split(".")[2],
            jobId: notification.subject
        };
    }
}
