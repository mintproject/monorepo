import { convertToUrlToCustomUrl, convertApiUrlToW3Id } from "../model-catalog-functions";
import { getConfiguration } from "../mint-functions";
import { ModelConfigurationType } from "../model-catalog-functions";

// Mock getConfiguration
jest.mock("../mint-functions", () => ({
    getConfiguration: jest.fn().mockReturnValue({
        model_catalog_api: "https://api.models.mint.local/v1.8.0/",
        auth_server: "https://auth.mint.local",
        auth_realm: "mint",
        auth_client_id: "mint-client",
        graphql: {
            endpoint: "http://localhost:8080/v1/graphql",
            secret: "test-secret",
            enable_ssl: false
        }
    })
}));

describe("convertToUrlToCustomUrl", () => {
    it("should convert a model configuration URL to a custom URL with query parameters for ModelConfiguration type", () => {
        const input =
            "https://api.models.mint.local/v1.8.0/modelconfigurations/26603296-1530-4f95-9655-ef51e44a5d7c?username=mint%40isi.edu";
        const expected =
            "https://api.models.mint.local/v1.8.0/custom/modelconfigurations/26603296-1530-4f95-9655-ef51e44a5d7c?username=mint%40isi.edu";

        expect(convertToUrlToCustomUrl(input, ModelConfigurationType.ModelConfiguration)).toBe(
            expected
        );
    });

    it("should convert a model configuration URL to a custom URL with query parameters for ModelConfigurationSetup type", () => {
        const input =
            "https://api.models.mint.local/v1.8.0/modelconfigurations/26603296-1530-4f95-9655-ef51e44a5d7c?username=mint%40isi.edu";
        const expected =
            "https://api.models.mint.local/v1.8.0/custom/modelconfigurationsetups/26603296-1530-4f95-9655-ef51e44a5d7c?username=mint%40isi.edu";

        expect(convertToUrlToCustomUrl(input, ModelConfigurationType.ModelConfigurationSetup)).toBe(
            expected
        );
    });

    it("should convert a model configuration URL to a custom URL without query parameters for ModelConfiguration type", () => {
        const input =
            "https://api.models.mint.local/v1.8.0/modelconfigurations/26603296-1530-4f95-9655-ef51e44a5d7c";
        const expected =
            "https://api.models.mint.local/v1.8.0/custom/modelconfigurations/26603296-1530-4f95-9655-ef51e44a5d7c";

        expect(convertToUrlToCustomUrl(input, ModelConfigurationType.ModelConfiguration)).toBe(
            expected
        );
    });

    it("should handle URLs with different hostnames for ModelConfigurationSetup type", () => {
        const input = "https://custom-api.example.com/v1/modelconfigurations/abc123";
        const expected = "https://custom-api.example.com/v1/custom/modelconfigurationsetups/abc123";

        expect(convertToUrlToCustomUrl(input, ModelConfigurationType.ModelConfigurationSetup)).toBe(
            expected
        );
    });

    it("should handle URLs with multiple query parameters for ModelConfiguration type", () => {
        const input =
            "https://api.models.mint.local/v1.8.0/modelconfigurations/26603296-1530-4f95-9655-ef51e44a5d7c?username=mint%40isi.edu&type=test&version=1.0";
        const expected =
            "https://api.models.mint.local/v1.8.0/custom/modelconfigurations/26603296-1530-4f95-9655-ef51e44a5d7c?username=mint%40isi.edu&type=test&version=1.0";

        expect(convertToUrlToCustomUrl(input, ModelConfigurationType.ModelConfiguration)).toBe(
            expected
        );
    });
});

describe("convertApiUrlToW3Id", () => {
    it("should convert HTTP API URL to W3ID URI", () => {
        const input =
            "http://api.models.mint.local/v1.8.0/modelconfigurations/46ce03cf-4e89-4d09-80b4-d34eca18f02e?username=mint@isi.edu";
        const expected = "https://w3id.org/okn/i/mint/46ce03cf-4e89-4d09-80b4-d34eca18f02e";

        expect(convertApiUrlToW3Id(input)).toBe(expected);
    });

    it("should convert HTTPS API URL to W3ID URI", () => {
        const input =
            "https://api.models.mint.local/v1.8.0/modelconfigurations/46ce03cf-4e89-4d09-80b4-d34eca18f02e?username=mint@isi.edu";
        const expected = "https://w3id.org/okn/i/mint/46ce03cf-4e89-4d09-80b4-d34eca18f02e";

        expect(convertApiUrlToW3Id(input)).toBe(expected);
    });

    it("should convert URL without query parameters to W3ID URI", () => {
        const input =
            "https://api.models.mint.local/v1.8.0/modelconfigurations/46ce03cf-4e89-4d09-80b4-d34eca18f02e";
        const expected = "https://w3id.org/okn/i/mint/46ce03cf-4e89-4d09-80b4-d34eca18f02e";

        expect(convertApiUrlToW3Id(input)).toBe(expected);
    });

    it("should handle URLs with different paths", () => {
        const input =
            "https://api.models.mint.local/v1.8.0/modelconfigurationsetups/abc123?param=value";
        const expected = "https://w3id.org/okn/i/mint/abc123";

        expect(convertApiUrlToW3Id(input)).toBe(expected);
    });
});
