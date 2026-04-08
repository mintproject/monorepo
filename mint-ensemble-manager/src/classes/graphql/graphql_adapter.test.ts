import { executionToGQL, executionFromGQL } from "@/classes/graphql/graphql_adapter";
import { Execution } from "@/classes/mint/mint-types";

const makeExecution = (overrides: Partial<Execution> = {}): Execution => ({
    id: "abc123",
    modelid: "https://w3id.org/okn/i/mint/test-config",
    bindings: {},
    start_time: new Date("2024-01-01T00:00:00Z"),
    status: "WAITING",
    run_progress: 0,
    results: [],
    selected: false,
    ...overrides
});

describe("executionToGQL", () => {
    it("maps modelid to modelcatalog_configuration_id", () => {
        const ex = makeExecution({ modelid: "https://w3id.org/okn/i/mint/test-config" });
        const result = executionToGQL(ex);
        expect(result.modelcatalog_configuration_id).toBe("https://w3id.org/okn/i/mint/test-config");
        expect(result).not.toHaveProperty("model_id");
    });

    it("preserves status, run_progress, and other fields", () => {
        const ex = makeExecution({
            id: "exec-001",
            status: "RUNNING",
            run_progress: 42,
            execution_engine: "tapis",
            runid: "run-xyz"
        });
        const result = executionToGQL(ex);
        expect(result.status).toBe("RUNNING");
        expect(result.run_progress).toBe(42);
        expect(result.execution_engine).toBe("tapis");
        expect(result.run_id).toBe("run-xyz");
        expect(result.id).toBe("exec-001");
    });
});

describe("executionFromGQL", () => {
    const makeGQLExecution = (overrides: Record<string, any> = {}) => ({
        id: "abc-123",
        modelcatalog_configuration_id: "https://w3id.org/okn/i/mint/test-config",
        status: "SUCCESS",
        start_time: "2024-01-01T00:00:00Z",
        end_time: null,
        execution_engine: "localex",
        run_progress: 100,
        run_id: "run-abc",
        parameter_bindings: [],
        data_bindings: [],
        results: [],
        ...overrides
    });

    it("reads modelcatalog_configuration_id into Execution.modelid", () => {
        const gqlEx = makeGQLExecution({ modelcatalog_configuration_id: "https://w3id.org/okn/i/mint/test-config" });
        const result = executionFromGQL(gqlEx);
        expect(result.modelid).toBe("https://w3id.org/okn/i/mint/test-config");
    });

    it("returns undefined for modelid when modelcatalog_configuration_id is missing", () => {
        const gqlEx = makeGQLExecution();
        delete gqlEx.modelcatalog_configuration_id;
        const result = executionFromGQL(gqlEx);
        expect(result.modelid).toBeUndefined();
    });
});
