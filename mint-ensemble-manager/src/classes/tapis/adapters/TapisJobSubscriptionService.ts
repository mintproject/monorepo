import { Jobs } from "@mfosorio/tapis-typescript";
import { getConfiguration } from "../../mint/mint-functions";

export class TapisJobSubscriptionService {
    constructor(private subscriptionsClient: Jobs.SubscriptionsApi) {}

    static createNotifDeliveryTarget(url: string) {
        return {
            deliveryMethod: Jobs.NotifDeliveryTargetDeliveryMethodEnum.Webhook,
            deliveryAddress: url
        };
    }

    static createRequest(executionId: string) {
        const url = TapisJobSubscriptionService.generateWebHookUrl(executionId);
        const notifDeliveryTarget = TapisJobSubscriptionService.createNotifDeliveryTarget(url);
        return {
            description: "Test subscription",
            enabled: true,
            eventCategoryFilter: Jobs.ReqSubscribeEventCategoryFilterEnum.JobNewStatus,
            deliveryTargets: [notifDeliveryTarget]
        };
    }

    async subscribeToJob(jobUuid: string, executionId: string) {
        const request = TapisJobSubscriptionService.createRequest(executionId);
        return await this.submit(jobUuid, request);
    }

    async submit(jobUuid: string, request: Jobs.ReqSubscribe) {
        return await this.subscriptionsClient.subscribe({
            jobUuid: jobUuid,
            reqSubscribe: request
        });
    }

    static generateWebHookUrl(executionId: string) {
        const prefs = getConfiguration();
        return `${prefs.ensemble_manager_api}/tapis/jobs/${executionId}/webhook`;
    }
}
