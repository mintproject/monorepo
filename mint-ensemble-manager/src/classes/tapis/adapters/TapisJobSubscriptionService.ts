import { Jobs } from "@mfosorio/tapis-typescript";
import { getConfiguration } from "../../mint/mint-functions";

export class TapisJobSubscriptionService {
    constructor(private subscriptionsClient: Jobs.SubscriptionsApi) {}

    createNotifDeliveryTarget(executionId: string) {
        return {
            deliveryMethod: Jobs.NotifDeliveryTargetDeliveryMethodEnum.Webhook,
            deliveryAddress: this.generateWebHookUrl(executionId)
        };
    }

    createRequest(notifDeliveryTarget: Jobs.NotifDeliveryTarget) {
        return {
            description: "Test subscription",
            enabled: true,
            eventCategoryFilter: Jobs.ReqSubscribeEventCategoryFilterEnum.JobNewStatus,
            deliveryTargets: [notifDeliveryTarget]
        };
    }

    async subscribeToJob(jobUuid: string, executionId: string) {
        const notifDeliveryTarget = this.createNotifDeliveryTarget(executionId);
        const request = this.createRequest(notifDeliveryTarget);
        return await this.submit(jobUuid, request);
    }

    async submit(jobUuid: string, request: Jobs.ReqSubscribe) {
        return await this.subscriptionsClient.subscribe({
            jobUuid: jobUuid,
            reqSubscribe: request
        });
    }

    private generateWebHookUrl(executionId: string) {
        const prefs = getConfiguration();
        return `${prefs.ensemble_manager_api}/tapis/jobs/${executionId}/webhook`;
    }
}
