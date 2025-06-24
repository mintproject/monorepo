import { Apps, Jobs } from "@tapis/tapis-typescript";
import { Execution, Execution_Result, Model, Region } from "@/classes/mint/mint-types";
import { TapisComponent, TapisComponentSeed } from "@/classes/tapis/typing";
import { IExecutionService, ExecutionJob } from "@/interfaces/IExecutionService";
import apiGenerator from "@/classes/tapis/utils/apiGenerator";
import { getInputsParameters } from "@/classes/tapis/helpers";
import { getInputDatasets } from "@/classes/tapis/helpers";
import { TapisJobService } from "@/classes/tapis/adapters/TapisJobService";
import errorDecoder from "@/classes/tapis/utils/errorDecoder";
import { TapisJobSubscriptionService } from "@/classes/tapis/adapters/TapisJobSubscriptionService";
import { BadRequestError, NotFoundError } from "@/classes/common/errors";
import {
    getExecution,
    getModelOutputsByModelId,
    incrementThreadModelSuccessfulRuns,
    incrementThreadModelFailedRuns,
    updateExecutionStatus,
    updateExecutionStatusAndResultsv2,
    getThreadModelByThreadIdExecutionId,
    updateExecutionRunId,
    decrementThreadModelSubmittedRuns,
    handleFailedConnectionEnsemble
} from "@/classes/graphql/graphql_functions";
import { matchTapisOutputsToMintOutputs } from "@/classes/tapis/jobs";
import { Status } from "@/interfaces/IExecutionService";

export class TapisExecutionService implements IExecutionService {
    private readonly LOG_PATH = "tapisjob.out";
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

    async verifyComponent(component: TapisComponent): Promise<void> {
        await this.loadTapisApp(component);
    }

    async submitExecutions(
        executions: Execution[],
        model: Model,
        region: Region,
        component: TapisComponent,
        threadId: string,
        threadModelId: string
    ) {
        try {
            const app = await this.loadTapisApp(component);
            console.log("Submitting executions", executions);
            this.seeds = this.seedExecutions(executions, model, region, component);
            console.log("Seeds", JSON.stringify(this.seeds));

            const results: string[] = [];
            const errors: { executionId: string; error: Error }[] = [];

            for (const seed of this.seeds) {
                console.log("Processing seed", JSON.stringify(seed));
                try {
                    const name = this.generateValidJobName(app, seed.execution.id);
                    const description = "Job for " + model.name + " execution " + seed.execution.id;
                    const jobRequest = this.jobService.createJobRequest(
                        app,
                        seed,
                        model,
                        name,
                        description
                    );
                    console.log("Job request", JSON.stringify(jobRequest));
                    const jobId = await this.submitJob(jobRequest);
                    await updateExecutionRunId(seed.execution.id, jobId);
                    const subscription = TapisJobSubscriptionService.createRequest(
                        seed.execution.id,
                        threadId
                    );
                    await this.jobSubscriptionService.submit(jobId, subscription);
                    results.push(jobId);
                } catch (error) {
                    console.error(
                        `Failed to submit job for execution ${seed.execution.id}:`,
                        error
                    );
                    await decrementThreadModelSubmittedRuns(threadModelId);
                    errors.push({ executionId: seed.execution.id, error });
                }
            }
            if (errors.length > 0) {
                console.warn("Some jobs failed to submit:", errors);
            }
            if (errors.length === this.seeds.length) {
                throw new Error("All jobs failed to submit");
            }

            return results;
        } catch (error) {
            try {
                console.log("Handling failed connection ensemble");
                await handleFailedConnectionEnsemble(
                    threadId,
                    {
                        event: "UPDATE",
                        userid: "SYSTEM",
                        timestamp: new Date(),
                        notes: "All jobs failed to submit",
                        thread_id: threadId
                    },
                    [
                        {
                            total_runs: this.seeds.length,
                            submitted_runs: 0,
                            failed_runs: this.seeds.length,
                            successful_runs: 0,
                            thread_model_id: threadModelId
                        }
                    ]
                );
            } catch (error) {
                console.error("Error handling failed connection ensemble", error);
            }
            console.error("Error submitting executions", error);
            throw error;
        }
    }

    async registerExecutionOutputs(executionId: string): Promise<Execution_Result[]> {
        return await this.updateExecutionResultsFromJob(executionId);
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

    async getLog(jobId: string): Promise<string> {
        const history = await this.getJobHistory(jobId);
        try {
            const file = await this.getJobOutputDownloadFile(jobId, this.LOG_PATH);
            return await file.text();
        } catch (error) {
            let log = "";
            for (const result of history.result) {
                log += `[${result.created} - ${result.event}] ${result.eventDetail}\n`;
            }
            return log;
        }
    }

    async getJobHistory(jobId: string): Promise<Jobs.RespJobHistory> {
        return await errorDecoder<Jobs.RespJobHistory>(() =>
            this.jobsClient.getJobHistory({ jobUuid: jobId })
        );
    }

    async getJobStatus(jobId: string): Promise<ExecutionJob> {
        const job = await errorDecoder<Jobs.RespGetJob>(() =>
            this.jobsClient.getJob({ jobUuid: jobId })
        );
        try {
            if (job.result?.status === Jobs.JobStatusEnum.Failed) {
                return {
                    id: job.result?.uuid,
                    status: Status.FAILURE,
                    error: job.result?.lastMessage
                };
            }
            return {
                id: job.result?.uuid,
                status: TapisExecutionService.mapJobStatusEnum(job.result?.status),
                result: job.result?.lastMessage
            };
        } catch (error) {
            console.error("Error getting job status");
            throw error;
        }
    }

    public static mapJobStatusEnum(tapisStatus: Jobs.JobStatusEnum): Status {
        switch (tapisStatus) {
            case Jobs.JobStatusEnum.Pending:
                return Status.WAITING;
            case Jobs.JobStatusEnum.ProcessingInputs:
                return Status.WAITING;
            case Jobs.JobStatusEnum.StagingInputs:
                return Status.WAITING;
            case Jobs.JobStatusEnum.StagingJob:
                return Status.WAITING;
            case Jobs.JobStatusEnum.SubmittingJob:
                return Status.WAITING;
            case Jobs.JobStatusEnum.Queued:
                return Status.WAITING;
            case Jobs.JobStatusEnum.Running:
                return Status.RUNNING;
            case Jobs.JobStatusEnum.Archiving:
                return Status.RUNNING;
            case Jobs.JobStatusEnum.Blocked:
                return Status.WAITING;
            case Jobs.JobStatusEnum.Paused:
                return Status.WAITING;
            case Jobs.JobStatusEnum.Finished:
                return Status.SUCCESS;
            case Jobs.JobStatusEnum.Cancelled:
                return Status.FAILURE;
            case Jobs.JobStatusEnum.Failed:
                return Status.FAILURE;
            default:
                throw new Error("Unrecognized Tapis status: " + tapisStatus);
        }
    }

    public static mapStatus(tapisStatus: string): Status {
        switch (tapisStatus) {
            case "jobs.JOB_NEW_STATUS.PENDING":
            case "jobs.JOB_NEW_STATUS.PROCESSING_INPUTS":
            case "jobs.JOB_NEW_STATUS.STAGING_INPUTS":
            case "jobs.JOB_NEW_STATUS.STAGING_JOB":
            case "jobs.JOB_NEW_STATUS.SUBMITTING_JOB":
            case "jobs.JOB_NEW_STATUS.QUEUED":
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
                return Status.FAILURE;
            default:
                throw new Error("Unrecognized Tapis status: " + tapisStatus);
        }
    }

    /** Extra methods */

    async loadTapisApp(component: TapisComponent): Promise<Apps.TapisApp> {
        if (component === undefined) {
            throw new Error("Component is undefined");
        }
        const { result: app } = await this.appsClient.getApp({
            appId: component.id,
            appVersion: component.version
        });
        return app;
    }

    async submitJob(jobRequest: Jobs.ReqSubmitJob): Promise<string> {
        try {
            const { result: jobSubmission } = await errorDecoder<Jobs.RespSubmitJob>(() =>
                this.jobsClient.submitJob({ reqSubmitJob: jobRequest })
            );
            console.log(`Job submitted with id ${jobSubmission.uuid}`);
            return jobSubmission.uuid;
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
        try {
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
        } catch (error) {
            console.error("Error updating execution status on GraphQL", error);
            throw error;
        }
    }

    private async getExecutionResultsFromJob(
        jobUuid: string,
        execution: Execution
    ): Promise<Execution_Result[]> {
        const files = [];
        try {
            const { result: files1 } = await this.getJobOutputList(jobUuid, "");
            files.push(...files1);
        } catch (error) {
            console.log("No files found for model in default path" + execution.modelid);
        }
        try {
            const { result: files2 } = await this.getJobOutputList(jobUuid, "outputs");
            files.push(...files2);
        } catch (error) {
            console.log("No files found for model in outputs path" + execution.modelid);
        }

        const mintOutputs = await getModelOutputsByModelId(execution.modelid);

        if (mintOutputs.length === 0 && files.length === 0) {
            throw new NotFoundError(
                "No outputs found and no mint outputs found for model " + execution.modelid
            );
        } else if (mintOutputs.length === 0) {
            throw new NotFoundError("No mint outputs found for model " + execution.modelid);
        } else if (files.length === 0) {
            throw new NotFoundError("No files found for model " + execution.modelid);
        }
        return matchTapisOutputsToMintOutputs(files, mintOutputs);
    }

    private async updateExecutionResultsFromJob(executionId: string): Promise<Execution_Result[]> {
        const execution = await getExecution(executionId);
        if (execution === null) {
            throw new NotFoundError("Execution not found");
        }
        if (execution.status !== Status.SUCCESS) {
            throw new BadRequestError("Execution is not successful");
        }
        execution.results = await this.getExecutionResultsFromJob(execution.runid, execution);
        console.log("Registering execution ", executionId, execution.results.length);
        await updateExecutionStatusAndResultsv2(execution);
        return execution.results;
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

    private generateValidJobName(app: Apps.TapisApp, executionId: string): string {
        const MAX_LENGTH = 64;
        const SEPARATOR = "-";

        // Start with the essential parts
        const name = `${app.id}${SEPARATOR}${app.version}${SEPARATOR}${executionId}`;

        // If we're under the limit, return as is
        if (name.length <= MAX_LENGTH) {
            return name;
        }

        // Calculate how much we need to trim
        const excess = name.length - MAX_LENGTH;

        // If executionId is long enough, trim it
        if (executionId.length > excess) {
            const trimmedExecutionId = executionId.slice(0, executionId.length - excess);
            return `${app.id}${SEPARATOR}${app.version}${SEPARATOR}${trimmedExecutionId}`;
        }

        // If we still need to trim, start trimming from the app.id
        const remainingExcess = excess - executionId.length;
        const trimmedAppId = app.id.slice(0, app.id.length - remainingExcess);
        return `${trimmedAppId}${SEPARATOR}${app.version}${SEPARATOR}${executionId}`;
    }
}
