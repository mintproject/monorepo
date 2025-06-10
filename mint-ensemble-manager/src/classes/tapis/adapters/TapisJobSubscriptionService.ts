import { Jobs } from "@tapis/tapis-typescript";
import { getConfiguration } from "@/classes/mint/mint-functions";

export class TapisJobSubscriptionService {
    constructor(private subscriptionsClient: Jobs.SubscriptionsApi) {}

    static createNotifDeliveryTarget(url: string) {
        return {
            deliveryMethod: Jobs.NotifDeliveryTargetDeliveryMethodEnum.Webhook,
            deliveryAddress: url
        };
    }

    static createRequest(executionId: string, threadId: string) {
        const url = TapisJobSubscriptionService.generateWebHookUrl(threadId, executionId);
        const notifDeliveryTarget = TapisJobSubscriptionService.createNotifDeliveryTarget(url);
        return {
            description: "Test subscription",
            enabled: true,
            eventCategoryFilter: Jobs.ReqSubscribeEventCategoryFilterEnum.JobNewStatus,
            deliveryTargets: [notifDeliveryTarget]
        };
    }

    async submit(jobUuid: string, request: Jobs.ReqSubscribe) {
        return await this.subscriptionsClient.subscribe({
            jobUuid: jobUuid,
            reqSubscribe: request
        });
    }

    static generateWebHookUrl(threadId: string, executionId: string) {
        const prefs = getConfiguration();
        return `${prefs.ensemble_manager_api}/tapis/threads/${threadId}/executions/${executionId}/webhook`;
    }
}
