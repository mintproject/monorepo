import { Apps, Jobs } from "@mfosorio/tapis-typescript";
import { Execution, Execution_Result, Model, Region } from "../../mint/mint-types";
import { TapisComponent, TapisComponentSeed } from "../typing";
import { IExecutionService, ExecutionJob } from "../../../interfaces/IExecutionService";
import apiGenerator from "../utils/apiGenerator";
import { getInputsParameters } from "../helpers";
import { getInputDatasets } from "../helpers";
import { TapisJobService } from "./TapisJobService";
import errorDecoder from "../utils/errorDecoder";
import { TapisJobSubscriptionService } from "./TapisJobSubscriptionService";
import {
    getExecution,
    getModelOutputsByModelId,
    updateExecutionStatus
} from "@/classes/graphql/graphql_functions";
import { matchTapisOutputsToMintOutputs } from "../jobs";

export class TapisExecutionService implements IExecutionService {
    private appsClient: Apps.ApplicationsApi;
    private jobsClient: Jobs.JobsApi;
    private subscriptionsClient: Jobs.SubscriptionsApi;
    public seeds: TapisComponentSeed[];
    private jobService: TapisJobService;
    private jobSubscriptionService: TapisJobSubscriptionService;
    constructor(
        private token: string,
        private baseUrl: string
    ) {
        console.log("initializing TapisExecutionService");
        console.log("baseUrl", baseUrl);
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
        this.jobService = new TapisJobService(this.jobsClient, this.subscriptionsClient);
        this.jobSubscriptionService = new TapisJobSubscriptionService(this.subscriptionsClient);
    }

    async updateExecution(
        execution_id: string,
        status: string,
        external_run_id: string | undefined
    ): Promise<Execution> {
        const execution = await getExecution(execution_id);
        await this.updateExecutionStatusOnGraphQl(execution, status);
        await this.updateExecutionResultsFromJob(external_run_id, execution.id, status);
        return execution;
    }

    async getJobStatus(jobId: string): Promise<ExecutionJob> {
        const job = await errorDecoder<Jobs.RespGetJob>(() =>
            this.jobsClient.getJob({ jobUuid: jobId })
        );

        return {
            id: job.result?.uuid,
            status: this.mapStatus(job.status),
            result: job.result?.lastMessage,
            error: job.result?.lastMessage
        };
    }

    public mapStatus(tapisStatus: string): "FAILURE" | "SUCCESS" | "RUNNING" | "WAITING" {
        switch (tapisStatus) {
            case "jobs.JOB_NEW_STATUS.PENDING":
            case "jobs.JOB_NEW_STATUS.PROCESSING_INPUTS":
            case "jobs.JOB_NEW_STATUS.STAGING_INPUTS":
                return "WAITING";
            case "jobs.JOB_NEW_STATUS.RUNNING":
            case "jobs.JOB_NEW_STATUS.ARCHIVING":
                return "RUNNING";
            case "jobs.JOB_NEW_STATUS.FINISHED":
            case "jobs.JOB_NEW_STATUS.ARCHIVED":
            case "jobs.JOB_NEW_STATUS.SUCCESS":
                return "SUCCESS";
            case "jobs.JOB_NEW_STATUS.FAILED":
            case "jobs.JOB_NEW_STATUS.CANCELLED":
            case "jobs.JOB_NEW_STATUS.PAUSED":
            default:
                return "FAILURE";
        }
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
            const subscription = await this.jobSubscriptionService.subscribeToJob(
                jobId,
                seed.execution.id
            );
            return jobId;
        });
        return await Promise.all(promises);
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
            console.log(JSON.stringify(jobRequest, null, 2));
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

    private async updateExecutionStatusOnGraphQl(execution: Execution, status: string) {
        execution.status = this.mapStatus(status);
        execution.run_progress = 1;
        await updateExecutionStatus(execution);
    }

    private async getExecutionResultsFromJob(
        jobUuid: string,
        executionId: string
    ): Promise<Execution_Result[]> {
        const execution = await getExecution(executionId);
        const { result: files } = await this.getJobOutputList(jobUuid, "");
        const mintOutputs = await getModelOutputsByModelId(execution.modelid);
        return matchTapisOutputsToMintOutputs(files, mintOutputs);
    }

    private async updateExecutionResultsFromJob(
        jobUuid: string,
        executionId: string,
        status: string
    ) {
        const execution = await getExecution(executionId);
        if (status === `jobs.JOB_NEW_STATUS.FINISHED`) {
            execution.results = await this.getExecutionResultsFromJob(jobUuid, executionId);
            await updateExecutionStatus(execution);
        }
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
