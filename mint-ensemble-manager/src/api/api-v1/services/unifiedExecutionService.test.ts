import { createUnifiedExecutionService } from "./unifiedExecutionService";
import { UnifiedExecutionRecord, UnifiedExecutionStore } from "./unifiedExecutionStore";

jest.mock("@/classes/mint/mint-functions", () => ({
    getConfiguration: jest.fn().mockReturnValue({
        execution_engine: "tapis",
        svo_adapter_api: "http://adapter.local",
        unified_plan_secret: "test-secret"
    })
}));

describe("unifiedExecutionService", () => {
    const legacy = {
        local: { submitExecution: jest.fn() },
        wings: { submitExecution: jest.fn() },
        tapis: { submitExecution: jest.fn() }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
    });

    function fakeStore(): UnifiedExecutionStore {
        const records = new Map<string, UnifiedExecutionRecord>();
        return {
            async getByPlanId(planId) {
                return [...records.values()].find((record) => record.plan_id === planId) || null;
            },
            async getById(id) {
                return records.get(id) || null;
            },
            async insert(input) {
                const record = { id: "parent-1", ...input } as UnifiedExecutionRecord;
                records.set(record.id, record);
                return record;
            },
            async update(id, set) {
                const record = records.get(id);
                if (!record) return null;
                Object.assign(record, set);
                return record;
            }
        };
    }

    it("normalizes an adapter plan and preserves its parameter contract", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                status: "transform_required",
                plan_id: "adapter-plan-1",
                plan_json: { parameters: [{ name: "start_date", required: true }] }
            })
        });
        const service = createUnifiedExecutionService(legacy);

        const result = await service.createPlan(
            {
                executor: "svo_adapter",
                adapter_request: { data_object_id: "source-1", target_contract: {} }
            },
            "Bearer user-token"
        );

        expect(result).toMatchObject({
            executor: "svo_adapter",
            plan_id: "svo_adapter-plan-1",
            parameters: [{ name: "start_date", required: true }]
        });
        expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("http://adapter.local/plans");
    });

    it("dispatches a legacy plan to the configured execution engine", async () => {
        legacy.tapis.submitExecution.mockResolvedValue({ submittedExecutions: ["run-1"] });
        const service = createUnifiedExecutionService(legacy);
        const plan = await service.createPlan({
            executor: "ensemble_manager",
            thread_id: "thread-1",
            model_id: "model-1",
            execution_engine: "tapis"
        });

        const result = await service.submit({ plan_id: plan.plan_id }, "Bearer user-token");

        expect(legacy.tapis.submitExecution).toHaveBeenCalledWith(
            { thread_id: "thread-1", model_id: "model-1" },
            "Bearer user-token"
        );
        expect(result).toMatchObject({ executor: "ensemble_manager" });
    });

    it("returns a validation error when the Tapis app and model contracts differ", async () => {
        legacy.tapis.submitExecution.mockRejectedValue(
            Object.assign(new Error("Tapis app and model input contract differ"), {
                code: "COMPONENT_CONTRACT_MISMATCH"
            })
        );
        const service = createUnifiedExecutionService(legacy);
        const plan = await service.createPlan({
            executor: "ensemble_manager",
            thread_id: "thread-1",
            model_id: "model-1",
            execution_engine: "tapis"
        });

        await expect(service.submit({ plan_id: plan.plan_id }, "Bearer user-token")).rejects.toMatchObject({
            statusCode: 422,
            code: "COMPONENT_CONTRACT_MISMATCH"
        });
    });

    it("preserves a serialized contract error message instead of returning object text", async () => {
        legacy.tapis.submitExecution.mockRejectedValue({
            code: "COMPONENT_CONTRACT_MISMATCH",
            message: "Tapis app requires mf6-nam, but the model provides a simulation archive"
        });
        const service = createUnifiedExecutionService(legacy);
        const plan = await service.createPlan({
            executor: "ensemble_manager",
            thread_id: "thread-1",
            model_id: "model-1",
            execution_engine: "tapis"
        });

        await expect(service.submit({ plan_id: plan.plan_id }, "Bearer user-token")).rejects.toMatchObject({
            statusCode: 422,
            code: "COMPONENT_CONTRACT_MISMATCH",
            message: "Tapis app requires mf6-nam, but the model provides a simulation archive"
        });
    });

    it("rejects a tampered legacy plan identifier", async () => {
        const service = createUnifiedExecutionService(legacy);
        const plan = await service.createPlan({
            executor: "ensemble_manager",
            thread_id: "thread-1",
            model_id: "model-1",
            execution_engine: "tapis"
        });
        const tampered = `${plan.plan_id}x`;

        await expect(
            service.submit({ plan_id: tampered }, "Bearer user-token")
        ).rejects.toMatchObject({
            statusCode: 404,
            code: "PLAN_NOT_FOUND"
        });
    });

    it("forwards adapter parameter values through the server boundary", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ run_id: "adapter-run-1", status: "running" })
        });
        const service = createUnifiedExecutionService(legacy);

        const result = await service.submit(
            {
                plan_id: "svo_plan-1",
                parameter_values: { start_date: "2024-01-01" },
                execution_id: "parent-1"
            },
            "Bearer user-token"
        );

        expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
            "http://adapter.local/workflows/submit"
        );
        expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toMatchObject({
            plan_id: "plan-1",
            args: { start_date: "2024-01-01" },
            execution_id: "parent-1"
        });
        expect(result).toMatchObject({
            executor: "svo_adapter",
            child_execution_id: "adapter-run-1",
            parent_execution_id: "parent-1"
        });
    });

    it("reconciles adapter output before dispatching the downstream model", async () => {
        legacy.tapis.submitExecution.mockResolvedValue({ submittedExecutions: ["model-run-1"] });
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ run_id: "adapter-run-1", status: "running" })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ status: "completed" })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: "adapter-run-1",
                    status: "completed",
                    output_data_object_id: "output-1"
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: "output-1",
                    label: "springflow output",
                    resource_uri: "https://example.test/springflow.csv"
                })
            });

        const service = createUnifiedExecutionService(legacy, { store: fakeStore() });
        const plan = await service.createPlan({
            executor: "ensemble_manager",
            thread_id: "thread-1",
            model_id: "model-1",
            execution_engine: "tapis",
            adapter_steps: [
                {
                    adapter_plan_id: "adapter-plan-1",
                    model_io_id: "springflow-input",
                    source_resource_id: "source-1"
                }
            ]
        });

        const submitted = await service.submit(
            {
                plan_id: plan.plan_id,
                adapter_parameter_values: { "adapter-plan-1": { start_date: "2024-01-01" } }
            },
            "Bearer user-token"
        );
        expect(submitted).toMatchObject({ status: "adapter_running", run_id: "ue_parent-1" });

        const reconciled = await service.getRun("ue_parent-1", "Bearer user-token");
        expect(reconciled).toMatchObject({ status: "model_submitted" });
        expect(legacy.tapis.submitExecution).toHaveBeenCalledWith(
            {
                thread_id: "thread-1",
                model_id: "model-1",
                adapter_resource_overrides: [
                    {
                        model_io_id: "springflow-input",
                        resource_id: "output-1",
                        name: "springflow output",
                        url: "https://example.test/springflow.csv"
                    }
                ]
            },
            "Bearer user-token"
        );
    });

    it("blocks parent submission when the first adapter child rejects parameters", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 422,
            json: async () => ({
                detail: {
                    code: "INVALID_PARAMETERS",
                    message: "start_date is required"
                }
            })
        });
        const service = createUnifiedExecutionService(legacy, { store: fakeStore() });
        const plan = await service.createPlan({
            executor: "ensemble_manager",
            thread_id: "thread-1",
            model_id: "model-1",
            execution_engine: "tapis",
            adapter_steps: [
                {
                    adapter_plan_id: "adapter-plan-1",
                    model_io_id: "springflow-input",
                    source_resource_id: "source-1"
                }
            ]
        });

        await expect(
            service.submit({ plan_id: plan.plan_id, adapter_parameter_values: {} }, "Bearer user-token")
        ).rejects.toMatchObject({ statusCode: 422, code: "INVALID_PARAMETERS" });
        expect(legacy.tapis.submitExecution).not.toHaveBeenCalled();
        await expect(service.getRun("ue_parent-1")).resolves.toMatchObject({ status: "failed" });
    });
});
