import { Apps, Jobs } from "@mfosorio/tapis-typescript";
import { Execution, Execution_Result, Model, Region } from "@/classes/mint/mint-types";
import { TapisComponent, TapisComponentSeed } from "@/classes/tapis/typing";
import { IExecutionService, ExecutionJob } from "@/interfaces/IExecutionService";
import apiGenerator from "@/classes/tapis/utils/apiGenerator";
import { getInputsParameters } from "@/classes/tapis/helpers";
import { getInputDatasets } from "@/classes/tapis/helpers";
import { TapisJobService } from "@/classes/tapis/adapters/TapisJobService";
import errorDecoder from "@/classes/tapis/utils/errorDecoder";
import { TapisJobSubscriptionService } from "@/classes/tapis/adapters/TapisJobSubscriptionService";
import {
    getExecution,
    getModelOutputsByModelId,
    incrementThreadModelSuccessfulRuns,
    incrementThreadModelFailedRuns,
    updateExecutionStatus,
    updateExecutionStatusAndResultsv2,
    getThreadModelByThreadIdExecutionId
} from "@/classes/graphql/graphql_functions";
import { matchTapisOutputsToMintOutputs } from "@/classes/tapis/jobs";
import { Status } from "@/interfaces/IExecutionService";
export class TapisExecutionService implements IExecutionService {
    private appsClient: Apps.ApplicationsApi;
    private jobsClient: Jobs.JobsApi;
    private subscriptionsClient: Jobs.SubscriptionsApi;
    public seeds: TapisComponentSeed[];
    private jobService: TapisJobService;
    private jobSubscriptionService: TapisJobSubscriptionService;
    private jobShareClient: Jobs.ShareApi;
    constructor(
        private token: string,
        private baseUrl: string
    ) {
        this.jobsClient = apiGenerator<Jobs.JobsApi>(Jobs, Jobs.JobsApi, baseUrl, token);
        this.subscriptionsClient = apiGenerator<Jobs.SubscriptionsApi>(
            Jobs,
            Jobs.SubscriptionsApi,
            baseUrl,
            token
        );
        this.appsClient = apiGenerator<Apps.ApplicationsApi>(
            Apps,
            Apps.ApplicationsApi,
            baseUrl,
            token
        );
        this.jobShareClient = apiGenerator<Jobs.ShareApi>(Jobs, Jobs.ShareApi, baseUrl, token);
        this.jobService = new TapisJobService(
            this.jobsClient,
            this.subscriptionsClient,
            this.jobShareClient
        );
        this.jobSubscriptionService = new TapisJobSubscriptionService(this.subscriptionsClient);
    }

    async submitExecutions(
        executions: Execution[],
        model: Model,
        region: Region,
        component: TapisComponent
    ) {
        const app = await this.loadTapisApp(component);

        this.seeds = this.seedExecutions(executions, model, region, component);
        const promises = this.seeds.map(async (seed) => {
            const jobRequest = this.jobService.createJobRequest(app, seed, model);
            const jobId = await this.submitJob(jobRequest);
            const subscription = TapisJobSubscriptionService.createRequest(seed.execution.id);
            await this.jobSubscriptionService.submit(jobId, subscription);
            return jobId;
        });
        return await Promise.all(promises);
    }

    async registerExecutionOutputs(executionId: string): Promise<void> {
        await this.updateExecutionResultsFromJob(executionId);
    }

    static async updateExecution(
        thread_id: string,
        execution_id: string,
        status: string
    ): Promise<Execution> {
        const execution = await getExecution(execution_id);
        const model_ensembles = await getThreadModelByThreadIdExecutionId(thread_id, execution_id);
        if (model_ensembles.length !== 1) {
            throw new Error("Expected 1 model ensemble, got " + model_ensembles.length);
        }
        const model_ensemble_id = model_ensembles[0].id;
        await TapisExecutionService.updateExecutionStatusOnGraphQl(
            execution,
            status,
            model_ensemble_id
        );
        return execution;
    }

    async getJobStatus(jobId: string): Promise<ExecutionJob> {
        const job = await errorDecoder<Jobs.RespGetJob>(() =>
            this.jobsClient.getJob({ jobUuid: jobId })
        );

        return {
            id: job.result?.uuid,
            status: TapisExecutionService.mapStatus(job.status),
            result: job.result?.lastMessage,
            error: job.result?.lastMessage
        };
    }

    public static mapStatus(tapisStatus: string): Status {
        switch (tapisStatus) {
            case "jobs.JOB_NEW_STATUS.PENDING":
            case "jobs.JOB_NEW_STATUS.PROCESSING_INPUTS":
            case "jobs.JOB_NEW_STATUS.STAGING_INPUTS":
                return Status.WAITING;
            case "jobs.JOB_NEW_STATUS.RUNNING":
            case "jobs.JOB_NEW_STATUS.ARCHIVING":
                return Status.RUNNING;
            case "jobs.JOB_NEW_STATUS.FINISHED":
            case "jobs.JOB_NEW_STATUS.ARCHIVED":
            case "jobs.JOB_NEW_STATUS.SUCCESS":
                return Status.SUCCESS;
            case "jobs.JOB_NEW_STATUS.FAILED":
            case "jobs.JOB_NEW_STATUS.CANCELLED":
            case "jobs.JOB_NEW_STATUS.PAUSED":
            default:
                return Status.FAILURE;
        }
    }

    /** Extra methods */

    async loadTapisApp(component: TapisComponent): Promise<Apps.TapisApp> {
        const { result: app } = await this.appsClient.getApp({
            appId: component.id,
            appVersion: component.version
        });
        return app;
    }

    async submitJob(jobRequest: Jobs.ReqSubmitJob): Promise<string> {
        try {
            const jobSubmission = await errorDecoder<Jobs.RespSubmitJob>(() =>
                this.jobsClient.submitJob({ reqSubmitJob: jobRequest })
            );
            return jobSubmission.result.uuid;
        } catch (error) {
            if (error.status === 400) {
                // Handle HTTP 400 Bad Request specifically
                const errorDetails = error.response?.data?.message || error.message;
                throw new Error(`Invalid job request: ${errorDetails}`);
            }
            throw new Error(`Failed to submit job: ${error.message}`);
        }
    }

    private seedExecutions(
        executions: Execution[],
        model: Model,
        region: Region,
        component: TapisComponent
    ) {
        console.log("seeding executions", executions);
        return executions.map((execution) => {
            const bindings = execution.bindings;
            const datasets = getInputDatasets(model, bindings);
            const { parameters, parameterTypes } = getInputsParameters(model, bindings, region);
            return {
                component: component,
                execution: execution,
                datasets: datasets,
                parameters: parameters,
                paramtypes: parameterTypes
            } as TapisComponentSeed;
        });
    }

    private static async updateExecutionStatusOnGraphQl(
        execution: Execution,
        status: string,
        model_ensemble_id: string
    ) {
        execution.status = TapisExecutionService.mapStatus(status);
        if (execution.status === Status.SUCCESS) {
            execution.run_progress = 1;
            await incrementThreadModelSuccessfulRuns(model_ensemble_id);
        } else if (execution.status === Status.FAILURE) {
            execution.run_progress = 0;
            await incrementThreadModelFailedRuns(model_ensemble_id);
        } else if (execution.status === Status.RUNNING) {
            execution.run_progress = 0.5;
        } else if (execution.status === Status.WAITING) {
            execution.run_progress = 0.05;
        }
        await updateExecutionStatus(execution);
    }

    private async getExecutionResultsFromJob(
        jobUuid: string,
        execution: Execution
    ): Promise<Execution_Result[]> {
        const { result: files } = await this.getJobOutputList(jobUuid, "");
        const mintOutputs = await getModelOutputsByModelId(execution.modelid);
        return matchTapisOutputsToMintOutputs(files, mintOutputs);
    }

    private async updateExecutionResultsFromJob(executionId: string) {
        const execution = await getExecution(executionId);
        execution.results = await this.getExecutionResultsFromJob(execution.runid, execution);
        console.log("Registering execution ", executionId, execution.results.length);
        await updateExecutionStatusAndResultsv2(execution);
    }

    getJobOutputList = async (
        jobUuid: string,
        outputPath: string
    ): Promise<Jobs.RespGetJobOutputList> => {
        return await errorDecoder<Jobs.RespGetJobOutputList>(() =>
            this.jobsClient.getJobOutputList({ jobUuid: jobUuid, outputPath: outputPath })
        );
    };

    getJobOutputDownloadFile = async (jobUuid: string, outputPath: string): Promise<Blob> => {
        return await errorDecoder<Blob>(() =>
            this.jobsClient.getJobOutputDownload({ jobUuid: jobUuid, outputPath: outputPath })
        );
    };
}
