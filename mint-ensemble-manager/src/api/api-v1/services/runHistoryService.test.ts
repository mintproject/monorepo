jest.mock("@/classes/graphql/graphql_functions_v2", () => ({
    getThread: jest.fn(),
    getExecutionHistory: jest.fn()
}));

jest.mock("./unifiedExecutionStore", () => ({
    createHasuraUnifiedExecutionStore: jest.fn()
}));

jest.mock("@/utils/authUtils", () => ({
    getTokenFromAuthorizationHeader: jest.fn().mockReturnValue("token")
}));

jest.mock("@/classes/mint/mint-functions", () => ({
    getConfiguration: jest.fn().mockReturnValue({})
}));

import { getExecutionHistory, getThread } from "@/classes/graphql/graphql_functions_v2";
import { createHasuraUnifiedExecutionStore } from "./unifiedExecutionStore";
import { createRunHistoryService } from "./runHistoryService";

describe("runHistoryService", () => {
    it("merges only the exact persisted model child and keeps legacy runs standalone", async () => {
        (getThread as jest.Mock).mockResolvedValue({
            id: "thread-1",
            thread_models: [
                {
                    id: "thread-model-1",
                    modelcatalog_configuration_id: "model-1",
                    modelcatalog_configuration: { label: "MODFLOW" }
                }
            ]
        });
        (getExecutionHistory as jest.Mock).mockResolvedValue({
            executions: [
                {
                    execution: {
                        id: "execution-1",
                        run_id: "child-1",
                        status: "SUCCESS",
                        start_time: "2026-09-24T12:00:00Z",
                        end_time: "2026-09-24T12:01:00Z",
                        modelcatalog_configuration_id: "model-1",
                        parameter_bindings: [{ model_parameter_id: "rate", parameter_value: "1" }],
                        data_bindings: [],
                        results: []
                    }
                },
                {
                    execution: {
                        id: "execution-2",
                        run_id: "unmatched-child",
                        status: "FAILURE",
                        start_time: "2026-09-23T12:00:00Z",
                        modelcatalog_configuration_id: "model-1",
                        parameter_bindings: [],
                        data_bindings: [],
                        results: []
                    }
                }
            ]
        });
        (createHasuraUnifiedExecutionStore as jest.Mock).mockReturnValue({
            listByThread: jest.fn().mockResolvedValue([
                {
                    id: "parent-1",
                    plan_id: "plan-1",
                    thread_id: "thread-1",
                    model_id: "model-1",
                    execution_engine: "svo_adapter",
                    status: "completed",
                    idempotency_key: "key-1",
                    plan_hash: "hash-1",
                    adapter_steps: [],
                    adapter_run_ids: [{ run_id: "adapter-1" }],
                    parameter_values: { rate: 1 },
                    model_child_id: "child-1",
                    created_at: "2026-09-24T12:00:01Z",
                    updated_at: "2026-09-24T12:01:01Z"
                }
            ])
        });

        const service = createRunHistoryService();
        const response = await service.list("thread-1", "Bearer token", { limit: 10 });

        expect(response.runs).toHaveLength(2);
        expect(response.runs[0]).toMatchObject({
            source: "workflow",
            execution_id: "execution-1",
            model_child_id: "child-1"
        });
        expect(response.runs[1]).toMatchObject({
            source: "legacy_execution",
            execution_id: "execution-2"
        });
        expect(response.runs[0].tapis_workflow).toMatchObject({
            provider: "tapis-workflows",
            workflow_id: null,
            run_id: null,
            stage_count: 0
        });

        const detail = await service.detail("thread-1", response.runs[0].run_key, "Bearer token");
        expect(detail.workflow?.adapter_runs).toEqual([{ run_id: "adapter-1" }]);
        expect(detail.parameters[0]).toMatchObject({ parameter_id: "rate", executed_value: 1 });
    });
});
