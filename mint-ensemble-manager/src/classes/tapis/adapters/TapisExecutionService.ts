import { Apps, Jobs } from "@mfosorio/tapis-typescript";
import { DataResource, Model } from "../../mint/mint-types";
import { TapisComponentSeed } from "../typing";
import { TapisNotification } from "./notification";
import { IExecutionService, ExecutionJob } from "../../../interfaces/IExecutionService";
import apiGenerator from "../utils/apiGenerator";
import errorDecoder from "../utils/errorDecoder";

export class TapisExecutionService implements IExecutionService {
    private apps: Apps.TapisApp;
    private jobsClient: Jobs.JobsApi;

    constructor(
        private token: string,
        private baseUrl: string
    ) {
        this.jobsClient = apiGenerator<Jobs.JobsApi>(Jobs, Jobs.JobsApi, baseUrl, token);
    }

    async submitJob(code: string, params: Record<string, any>): Promise<string> {
        return "123";
        // const seed: TapisComponentSeed = this.createSeedFromParams(params);
        // const jobRequest = TapisExecutionService.createJobRequest(this.apps, seed, this.model);
        // try {
        //     const response = await errorDecoder<Jobs.RespSubmitJob>(() =>
        //         this.jobsClient.submitJob({ reqSubmitJob: jobRequest })
        //     );
        //     return response.result?.uuid;
        // } catch (error) {
        //     console.error(`Failed to submit job:`, error);
        //     throw error;
        // }
    }

    async getJobStatus(jobId: string): Promise<ExecutionJob> {
        try {
            const job = await this.jobsClient.getJob({ jobUuid: jobId });
            return {
                id: job.result?.uuid,
                status: this.mapTapisStatus(job.status),
                result: job.result?.lastMessage,
                error: job.result?.lastMessage
            };
        } catch (error) {
            console.error(`Failed to get job status:`, error);
            throw error;
        }
    }

    async cancelJob(jobId: string): Promise<boolean> {
        try {
            await this.jobsClient.cancelJob({ jobUuid: jobId });
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
            archiveSystemId: TapisExecutionService.SYSTEM_ID,
            memoryMB: app.jobAttributes?.memoryMB || 1000,
            maxMinutes: app.jobAttributes?.maxMinutes || 10,
            nodeCount: app.jobAttributes?.nodeCount || 1,
            coresPerNode: app.jobAttributes?.coresPerNode || 1,
            fileInputs: jobFileInputs,
            parameterSet: { appArgs: [] },
            execSystemId: TapisExecutionService.SYSTEM_ID,
            execSystemLogicalQueue: TapisExecutionService.SYSTEM_LOGICAL_QUEUE,
            execSystemExecDir: "HOST_EVAL($SCRATCH)",
            archiveSystemDir: "HOST_EVAL($WORK)",
            tags: [`allocation:${TapisExecutionService.ALLOCATION}`]
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
