import { Jobs } from "@tapis/tapis-typescript";
import { getConfiguration } from "@/classes/mint/mint-functions";
import errorDecoder from "@/classes/tapis/utils/errorDecoder";

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
        console.log(
            `Subscribing to job ${jobUuid} with delivery target(s):`,
            request.deliveryTargets?.map((t) => t.deliveryAddress)
        );
        try {
            return await errorDecoder(() =>
                this.subscriptionsClient.subscribe({
                    jobUuid: jobUuid,
                    reqSubscribe: request
                })
            );
        } catch (error) {
            console.error(
                `Tapis subscribe failed for job ${jobUuid}:`,
                error instanceof Error ? error.message : String(error)
            );
            throw error;
        }
    }

    static generateWebHookUrl(threadId: string, executionId: string) {
        const prefs = getConfiguration();
        const override = prefs.tapis_webhook_base_url?.replace(/\/+$/, "");
        const base = override || `${prefs.ensemble_manager_api}/tapis`;
        return `${base}/threads/${threadId}/executions/${executionId}/webhook`;
    }
}
