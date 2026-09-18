import { getGraphqlUri } from "@/config/graphql";

describe("getGraphqlUri", () => {
    it("uses a full HTTPS endpoint without adding another protocol", () => {
        expect(getGraphqlUri("https://graphql.example/v1/graphql", true)).toBe(
            "https://graphql.example/v1/graphql"
        );
    });

    it("uses a full HTTP endpoint without adding another protocol", () => {
        expect(getGraphqlUri("http://localhost:8080/v1/graphql", true)).toBe(
            "http://localhost:8080/v1/graphql"
        );
    });

    it("adds the configured protocol to a host-only endpoint", () => {
        expect(getGraphqlUri("graphql.example/v1/graphql", true)).toBe(
            "https://graphql.example/v1/graphql"
        );
        expect(getGraphqlUri("graphql.example/v1/graphql", false)).toBe(
            "http://graphql.example/v1/graphql"
        );
    });

    it("trims whitespace around the endpoint", () => {
        expect(getGraphqlUri("  https://graphql.example/v1/graphql  ", false)).toBe(
            "https://graphql.example/v1/graphql"
        );
    });
});
