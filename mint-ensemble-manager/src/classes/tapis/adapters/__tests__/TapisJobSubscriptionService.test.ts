import { TapisJobSubscriptionService } from "@/classes/tapis/adapters/TapisJobSubscriptionService";
import { getConfiguration } from "@/classes/mint/mint-functions";

jest.mock("@/classes/mint/mint-functions", () => ({
    getConfiguration: jest.fn()
}));

const mockedGetConfiguration = getConfiguration as jest.MockedFunction<typeof getConfiguration>;

describe("TapisJobSubscriptionService.generateWebHookUrl", () => {
    afterEach(() => {
        mockedGetConfiguration.mockReset();
    });

    it("falls back to ensemble_manager_api when tapis_webhook_base_url is unset", () => {
        mockedGetConfiguration.mockReturnValue({
            ensemble_manager_api: "http://ensemble-manager.mint.local/v1"
        } as never);

        const url = TapisJobSubscriptionService.generateWebHookUrl("thread-1", "exec-1");

        expect(url).toBe(
            "http://ensemble-manager.mint.local/v1/tapis/threads/thread-1/executions/exec-1/webhook"
        );
    });

    it("uses tapis_webhook_base_url when configured", () => {
        mockedGetConfiguration.mockReturnValue({
            ensemble_manager_api: "http://ensemble-manager.mint.local/v1",
            tapis_webhook_base_url: "https://webhook.site/9737af49-1569-49b1-bec2-615386dccdc7"
        } as never);

        const url = TapisJobSubscriptionService.generateWebHookUrl("thread-1", "exec-1");

        expect(url).toBe(
            "https://webhook.site/9737af49-1569-49b1-bec2-615386dccdc7/threads/thread-1/executions/exec-1/webhook"
        );
    });

    it("trims trailing slash from tapis_webhook_base_url", () => {
        mockedGetConfiguration.mockReturnValue({
            ensemble_manager_api: "http://ensemble-manager.mint.local/v1",
            tapis_webhook_base_url: "https://webhook.site/abc/"
        } as never);

        const url = TapisJobSubscriptionService.generateWebHookUrl("t", "e");

        expect(url).toBe("https://webhook.site/abc/threads/t/executions/e/webhook");
    });
});
