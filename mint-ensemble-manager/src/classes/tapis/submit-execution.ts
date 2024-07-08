import { Thread, Execution, Model } from "../mint/mint-types";
import { Region } from "../mint/mint-types";
import { getInputsParameters, getInputDatasets } from "./helpers";
import { createJobRequest } from "./adapters/jobs";
import submit from "./api/jobs/submit";
import { Jobs } from "@mfosorio/tapis-typescript";
import subscribe from "./api/jobs/subscribe";
import { TapisComponent, TapisComponentSeed } from "./typing";
import { getTapisToken } from "./authenticator";
import { getTapisApp } from "./apps";
import { getConfiguration } from "../mint/mint-functions";
import {
    incrementThreadModelFailedRuns,
    updateExecutionStatus
} from "../graphql/graphql_functions";

const prefs = getConfiguration();

// Create Jobs (Seeds) and Queue them
export const queueModelExecutions = async (
    thread: Thread,
    modelid: string,
    component: TapisComponent,
    region: Region,
    executions: Execution[]
): Promise<Jobs.RespSubmitJob[]> => {
    const model = thread.models[modelid];
    if (model === undefined) {
        markExecutionsAsFailed(executions, thread.id);
        throw new Error(`Model ${modelid} not found in thread`);
    }
    const seeds = createSeedsExecution(executions, model, region, component);
    const { token, basePath } = await getTapisToken();
    const { result: app } = await getTapisApp(
        component.id,
        component.version,
        token.access_token,
        basePath
    );

    const promises = seeds.map(async (seed) => {
        try {
            const jobRequest = createJobRequest(app, seed, model);
            const jobSubmission = await submitTapisJob(jobRequest, token);
            await subscribeTapisJob(jobSubmission.result.uuid, token);
            return jobSubmission;
        } catch (error) {
            console.error(`Error submitting job for execution ${seed.execution.id}`);
            console.error(error);
            markExecutionAsFailed(seed.execution, thread.id);
        }
    });
    return await Promise.all(promises);
};

const markExecutionsAsFailed = async (executions: Execution[], thread_id: string) => {
    executions.forEach((execution) => {
        markExecutionAsFailed(execution, thread_id);
    });
};

const markExecutionAsFailed = async (execution: Execution, thread_id: string) => {
    execution.status = "FAILURE";
    updateExecutionStatus(execution);
    incrementThreadModelFailedRuns(thread_id);
};

const generateWebHookUrl = (jobUuid: string) => {
    return `${prefs.ensemble_manager_api}/tapis/jobs/${jobUuid}`;
};

async function subscribeTapisJob(jobUuid: string, token) {
    const basePath = prefs.tapis.basePath;
    const notifDeliveryTarget: Jobs.NotifDeliveryTarget = {
        deliveryMethod: Jobs.NotifDeliveryTargetDeliveryMethodEnum.Webhook,
        deliveryAddress: generateWebHookUrl(jobUuid)
    };

    const request: Jobs.ReqSubscribe = {
        description: "Test subscription",
        enabled: true,
        eventCategoryFilter: Jobs.ReqSubscribeEventCategoryFilterEnum.JobNewStatus,
        deliveryTargets: [notifDeliveryTarget]
    };
    const response = await subscribe(request, basePath, jobUuid, token.access_token);
    return response;
}

async function submitTapisJob(request: Jobs.ReqSubmitJob, token) {
    const basePath = prefs.tapis.basePath;
    const response = await submit(request, basePath, token.access_token);
    return response;
}

function createSeedsExecution(
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
