import { Execution } from "../mint/mint-types";
import { getExecution, updateExecutionStatus } from "../graphql/graphql_functions";
import { getExecutionResultsFromJob } from "./jobs";
import Queue from "bull";
import { DOWNLOAD_TAPIS_OUTPUT_QUEUE_NAME, REDIS_URL } from "../../config/redis";
import { getConfiguration } from "../mint/mint-functions";
import { TapisNotification } from "./adapters/notification";

const prefs = getConfiguration();

const downloadQueue =
    prefs.execution_engine === "tapis"
        ? new Queue(DOWNLOAD_TAPIS_OUTPUT_QUEUE_NAME, REDIS_URL)
        : null;

if (prefs.execution_engine === "tapis") {
    downloadQueue.process(prefs.tapis.parallelism, __dirname + "/downloadTapisOutputQueue.js");
}

const handleExecutionEvent = async (event: TapisNotification, executionId: string) => {
    const execution = await getExecution(executionId);
    const jobUuid = event.subject;
    const statusType = event.type;
    if (execution !== undefined) {
        await updateJobStatusOnGraphQL(execution, statusType);
        await updateExecutionResultsFromJob(jobUuid, execution.id, statusType);
    }
    return execution;
};

const updateExecutionResultsFromJob = async (
    jobUuid: string,
    executionId: string,
    status: string
) => {
    console.log(
        `Updating results for job ${jobUuid} - execution ${executionId} - status ${status}`
    );
    const execution = await getExecution(executionId);
    if (downloadQueue && status === `jobs.JOB_NEW_STATUS.FINISHED`) {
        console.log(`Getting results for job ${jobUuid} - execution ${executionId}`);
        execution.results = await getExecutionResultsFromJob(jobUuid, execution);
        console.log(JSON.stringify(execution.results));
        downloadQueue.add({ jobUuid, executionId, execution: execution });
    }
};

const updateJobStatusOnGraphQL = async (execution: Execution, status: string) => {
    execution.status = adapterTapisStatusToMintStatus(status);
    execution.run_progress = 1;
    await updateExecutionStatus(execution);
};

const adapterTapisStatusToMintStatus = (status: string) => {
    // Example of status: jobs.JOB_NEW_STATUS.FINISHED
    switch (status) {
        case "jobs.JOB_NEW_STATUS.PENDING":
            return "WAITING";
        case "jobs.JOB_NEW_STATUS.PROCESSING_INPUTS":
            return "RUNNING";
        case "jobs.JOB_NEW_STATUS.STAGING_INPUTS":
            return "RUNNING";
        case "jobs.JOB_NEW_STATUS.STAGING_JOB":
            return "RUNNING";
        case "jobs.JOB_NEW_STATUS.SUBMITTING_JOB":
            return "WAITING";
        case "jobs.JOB_NEW_STATUS.QUEUED":
            return "WAITING";
        case "jobs.JOB_NEW_STATUS.RUNNING":
            return "RUNNING";
        case "jobs.JOB_NEW_STATUS.ARCHIVING":
            return "RUNNING";
        case "jobs.JOB_NEW_STATUS.BLOCKED":
            return "WAITING";
        case "jobs.JOB_NEW_STATUS.PAUSED":
            return "WAITING";
        case "jobs.JOB_NEW_STATUS.FINISHED":
            return "SUCCESS";
        case "jobs.JOB_NEW_STATUS.CANCELLED":
            return "FAILURE";
        case "jobs.JOB_NEW_STATUS.FAILED":
            return "FAILURE";
        default:
            return "WAITING";
    }
};

export default handleExecutionEvent;
