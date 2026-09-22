import crypto from "crypto";
import { getConfiguration } from "@/classes/mint/mint-functions";
import {
    createHasuraUnifiedExecutionStore,
    UnifiedExecutionRecord,
    UnifiedExecutionStore
} from "./unifiedExecutionStore";

export type UnifiedExecutor = "ensemble_manager" | "svo_adapter";

export interface UnifiedParameterDefinition {
    name: string;
    type?: string;
    required?: boolean;
    default?: unknown;
    description?: string;
    allowed_values?: unknown[];
    minimum?: number;
    maximum?: number;
    source_transform?: string;
    transform_spec_id?: string;
}

export class UnifiedExecutionError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public code?: string,
        public details?: unknown
    ) {
        super(message);
        this.name = "UnifiedExecutionError";
    }
}

interface LegacyPlan {
    executor: "ensemble_manager";
    thread_id: string;
    model_id: string;
    execution_engine: string;
    adapter_steps?: AdapterStep[];
}

interface AdapterStep {
    adapter_plan_id: string;
    model_io_id: string;
    source_resource_id: string;
}

interface AdapterChildRun {
    adapter_plan_id: string;
    model_io_id: string;
    source_resource_id: string;
    run_id: string;
    status?: string;
    output_data_object_id?: string | null;
}

interface AdapterPlanResponse {
    status?: string;
    plan_id?: string;
    plan_json?: { parameters?: UnifiedParameterDefinition[]; [key: string]: unknown };
    message?: string;
}

function adapterBaseUrl(): string {
    const prefs = getConfiguration() as { svo_adapter_api?: string };
    return (prefs.svo_adapter_api || process.env.SVO_ADAPTER_API || "").replace(/\/$/, "");
}

function unifiedPlanSecret(): string {
    const prefs = getConfiguration() as {
        unified_plan_secret?: string;
    };
    const secret = process.env.UNIFIED_PLAN_SECRET || prefs.unified_plan_secret || "";
    if (!secret) {
        throw new UnifiedExecutionError(
            503,
            "unified plan signing is not configured",
            "UNIFIED_PLAN_UNAVAILABLE"
        );
    }
    return secret;
}

function encodePlan(value: LegacyPlan): string {
    const encoded = Buffer.from(JSON.stringify(value), "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    const signature = crypto
        .createHmac("sha256", unifiedPlanSecret())
        .update(encoded)
        .digest("hex");
    return `em_${encoded}.${signature}`;
}

function decodePlan(planId: string): LegacyPlan {
    if (!planId.startsWith("em_")) {
        throw new UnifiedExecutionError(404, "execution plan not found", "PLAN_NOT_FOUND");
    }
    try {
        const [encoded, signature] = planId.slice(3).split(".");
        if (!encoded || !signature) throw new Error("unsigned legacy plan");
        const expected = crypto
            .createHmac("sha256", unifiedPlanSecret())
            .update(encoded)
            .digest("hex");
        if (
            signature.length !== expected.length ||
            !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
        ) {
            throw new Error("invalid legacy plan signature");
        }
        const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
        const value = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
        if (
            value?.executor !== "ensemble_manager" ||
            typeof value.thread_id !== "string" ||
            typeof value.model_id !== "string"
        ) {
            throw new Error("invalid legacy plan");
        }
        return value as LegacyPlan;
    } catch {
        throw new UnifiedExecutionError(404, "execution plan not found", "PLAN_NOT_FOUND");
    }
}

async function adapterRequest(
    path: string,
    init: { method?: string; body?: unknown },
    authorization?: string
): Promise<any> {
    const base = adapterBaseUrl();
    if (!base) {
        throw new UnifiedExecutionError(
            503,
            "SVO adapter is not configured",
            "SVO_ADAPTER_UNAVAILABLE"
        );
    }
    const response = await fetch(`${base}${path}`, {
        method: init.method || "GET",
        headers: {
            "Content-Type": "application/json",
            ...(authorization ? { Authorization: authorization } : {})
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const detail = body?.detail;
        const message =
            typeof detail === "string"
                ? detail
                : body?.message || `SVO adapter returned ${response.status}`;
        const code = typeof detail === "object" ? detail?.code : body?.code;
        throw new UnifiedExecutionError(response.status, message, code, detail);
    }
    return body;
}

function adapterPlanId(planId: string): string {
    return planId.startsWith("svo_") ? planId.slice(4) : planId;
}

function planHash(plan: LegacyPlan): string {
    return crypto.createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

function parentRunId(id: string): string {
    return `ue_${id}`;
}

function parentResponse(record: UnifiedExecutionRecord) {
    return {
        run_id: parentRunId(record.id),
        parent_execution_id: parentRunId(record.id),
        executor: "ensemble_manager",
        status: record.status,
        plan_id: record.plan_id,
        adapter_runs: record.adapter_run_ids,
        model_result: record.model_result || null,
        error_message: record.error_message || null
    };
}

export function createUnifiedExecutionService(legacyServices: {
    local: { submitExecution(body: any): Promise<any> };
    wings: { submitExecution(body: any): Promise<any> };
    tapis: { submitExecution(body: any, authorization: string): Promise<any> };
}, dependencies: { store?: UnifiedExecutionStore } = {}) {
    const store = dependencies.store || createHasuraUnifiedExecutionStore();

    const submitLegacy = async (
        plan: LegacyPlan,
        authorization: string | undefined,
        adapterResourceOverrides?: unknown[]
    ) => {
        const request = {
            thread_id: plan.thread_id,
            model_id: plan.model_id,
            ...(adapterResourceOverrides?.length
                ? { adapter_resource_overrides: adapterResourceOverrides }
                : {})
        };
        if (plan.execution_engine === "tapis") {
            try {
                return await legacyServices.tapis.submitExecution(request, authorization || "");
            } catch (error) {
                const structuredError = error as {
                    code?: string;
                    message?: unknown;
                    details?: unknown;
                };
                if (structuredError?.code === "COMPONENT_CONTRACT_MISMATCH") {
                    const message =
                        typeof structuredError.message === "string"
                            ? structuredError.message
                            : JSON.stringify(structuredError.message ?? structuredError);
                    throw new UnifiedExecutionError(
                        422,
                        message,
                        "COMPONENT_CONTRACT_MISMATCH",
                        structuredError.details
                    );
                }
                throw error;
            }
        }
        if (plan.execution_engine === "wings") {
            return legacyServices.wings.submitExecution(request);
        }
        return legacyServices.local.submitExecution(request);
    };

    const reconcileParent = async (
        record: UnifiedExecutionRecord,
        authorization?: string
    ): Promise<Record<string, unknown>> => {
        if (["model_submitted", "failed", "adapter_unknown", "model_unknown"].includes(record.status)) {
            return parentResponse(record);
        }

        const children = (record.adapter_run_ids || []) as AdapterChildRun[];
        for (const child of children) {
            if (child.status === "completed" && child.output_data_object_id) continue;
            try {
                await adapterRequest(
                    `/runs/${encodeURIComponent(child.run_id)}/poll`,
                    { method: "POST" },
                    authorization
                );
                const run = await adapterRequest(
                    `/runs/${encodeURIComponent(child.run_id)}`,
                    {},
                    authorization
                );
                child.status = run.status;
                child.output_data_object_id = run.output_data_object_id || null;
            } catch (error) {
                const updated = await store.update(record.id, {
                    status: "adapter_unknown",
                    adapter_run_ids: children,
                    error_message: error instanceof Error ? error.message : String(error)
                });
                return parentResponse(updated || { ...record, status: "adapter_unknown" });
            }
        }

        await store.update(record.id, { adapter_run_ids: children });
        if (children.some((child) => child.status === "failed")) {
            const updated = await store.update(record.id, {
                status: "failed",
                error_message: "One or more SVO adapter child runs failed",
                adapter_run_ids: children
            });
            return parentResponse(updated || { ...record, status: "failed" });
        }
        if (children.some((child) => child.status !== "completed")) {
            const updated = await store.update(record.id, {
                status: "adapter_running",
                adapter_run_ids: children
            });
            return parentResponse(updated || { ...record, status: "adapter_running" });
        }

        const overrides: Array<{
            model_io_id: string;
            resource_id: string;
            name?: string;
            url: string;
        }> = [];
        for (const child of children) {
            if (!child.output_data_object_id) {
                const updated = await store.update(record.id, {
                    status: "output_verifying",
                    adapter_run_ids: children,
                    error_message: "Adapter completed without a registered output"
                });
                return parentResponse(updated || { ...record, status: "output_verifying" });
            }
            try {
                const output = await adapterRequest(
                    `/data-objects/${encodeURIComponent(child.output_data_object_id)}`,
                    {},
                    authorization
                );
                if (!output.resource_uri) throw new Error("Adapter output has no resource URI");
                overrides.push({
                    model_io_id: child.model_io_id,
                    resource_id: output.id,
                    name: output.label,
                    url: output.resource_uri
                });
            } catch (error) {
                const updated = await store.update(record.id, {
                    status: "output_verifying",
                    adapter_run_ids: children,
                    error_message: error instanceof Error ? error.message : String(error)
                });
                return parentResponse(updated || { ...record, status: "output_verifying" });
            }
        }

        await store.update(record.id, { status: "model_dispatching", adapter_run_ids: children });
        try {
            const plan = decodePlan(record.plan_id);
            const result = await submitLegacy(plan, authorization, overrides);
            const updated = await store.update(record.id, {
                status: "model_submitted",
                model_result: result,
                error_message: null
            });
            return parentResponse(updated || { ...record, status: "model_submitted", model_result: result });
        } catch (error) {
            // The downstream request may have reached the execution engine even
            // when this process did not receive a response. Do not auto-retry it.
            const updated = await store.update(record.id, {
                status: "model_unknown",
                error_message: error instanceof Error ? error.message : String(error)
            });
            return parentResponse(updated || { ...record, status: "model_unknown" });
        }
    };

    return {
        async createPlan(body: any, authorization?: string) {
            const executor = body?.executor as UnifiedExecutor;
            if (executor === "svo_adapter") {
                const adapterBody = body.adapter_request || body.adapter;
                if (!adapterBody || typeof adapterBody !== "object") {
                    throw new UnifiedExecutionError(
                        400,
                        "adapter_request is required for an SVO adapter plan",
                        "ADAPTER_REQUEST_REQUIRED"
                    );
                }
                const result = (await adapterRequest(
                    "/plans",
                    {
                        method: "POST",
                        body: adapterBody
                    },
                    authorization
                )) as AdapterPlanResponse;
                const rawPlanId = result.plan_id;
                return {
                    ...result,
                    executor,
                    version: 1,
                    plan_id: rawPlanId ? `svo_${rawPlanId}` : null,
                    parameters: result.plan_json?.parameters || [],
                    parameter_values: {}
                };
            }

            if (executor !== "ensemble_manager") {
                throw new UnifiedExecutionError(
                    400,
                    "executor must be ensemble_manager or svo_adapter"
                );
            }
            if (typeof body.thread_id !== "string" || typeof body.model_id !== "string") {
                throw new UnifiedExecutionError(
                    400,
                    "thread_id and model_id are required",
                    "THREAD_MODEL_REQUIRED"
                );
            }
            const plan: LegacyPlan = {
                executor,
                thread_id: body.thread_id,
                model_id: body.model_id,
                execution_engine:
                    body.execution_engine || getConfiguration().execution_engine || "localex"
            };
            if (body.adapter_steps !== undefined) {
                if (!Array.isArray(body.adapter_steps)) {
                    throw new UnifiedExecutionError(400, "adapter_steps must be an array");
                }
                plan.adapter_steps = body.adapter_steps.map((step: any) => {
                    if (
                        typeof step?.adapter_plan_id !== "string" ||
                        typeof step?.model_io_id !== "string" ||
                        typeof step?.source_resource_id !== "string"
                    ) {
                        throw new UnifiedExecutionError(
                            400,
                            "each adapter step requires adapter_plan_id, model_io_id, and source_resource_id",
                            "ADAPTER_STEP_INVALID"
                        );
                    }
                    return {
                        adapter_plan_id: adapterPlanId(step.adapter_plan_id),
                        model_io_id: step.model_io_id,
                        source_resource_id: step.source_resource_id
                    };
                });
            }
            return {
                executor,
                version: 1,
                plan_id: encodePlan(plan),
                parameters: [],
                parameter_values: {},
                status: plan.adapter_steps?.length ? "adapter_ready" : "ready",
                adapter_steps: plan.adapter_steps || []
            };
        },

        async getPlan(planId: string, authorization?: string) {
            if (planId.startsWith("svo_")) {
                const result = await adapterRequest(
                    `/plans/${encodeURIComponent(adapterPlanId(planId))}`,
                    {},
                    authorization
                );
                return {
                    ...result,
                    executor: "svo_adapter",
                    version: 1,
                    plan_id: planId,
                    parameters: result.plan_json?.parameters || []
                };
            }
            const plan = decodePlan(planId);
            return {
                ...plan,
                version: 1,
                plan_id: planId,
                parameters: [],
                status: plan.adapter_steps?.length ? "adapter_ready" : "ready"
            };
        },

        async getRun(runId: string, authorization?: string) {
            if (runId.startsWith("ue_")) {
                const record = await store.getById(runId.slice(3));
                if (!record) {
                    throw new UnifiedExecutionError(404, "execution run not found", "RUN_NOT_FOUND");
                }
                return reconcileParent(record, authorization);
            }
            const result = await adapterRequest(
                `/runs/${encodeURIComponent(runId)}`,
                {},
                authorization
            );
            return {
                ...result,
                executor: "svo_adapter",
                child_execution_id: runId
            };
        },

        async submit(body: any, authorization: string | undefined) {
            if (typeof body?.plan_id !== "string") {
                throw new UnifiedExecutionError(400, "plan_id is required", "PLAN_ID_REQUIRED");
            }
            if (body.plan_id.startsWith("svo_")) {
                const result = await adapterRequest(
                    "/workflows/submit",
                    {
                        method: "POST",
                        body: {
                            plan_id: adapterPlanId(body.plan_id),
                            args: body.parameter_values || {},
                            run_name: body.run_name,
                            recreate: body.recreate,
                            dry_run: body.dry_run,
                            execution_id: body.execution_id
                        }
                    },
                    authorization
                );
                return {
                    ...result,
                    executor: "svo_adapter",
                    parent_execution_id: body.execution_id || null,
                    child_execution_id: result.run_id || null
                };
            }

            const plan = decodePlan(body.plan_id);
            if (plan.adapter_steps?.length) {
                const existing = await store.getByPlanId(body.plan_id);
                if (existing) return parentResponse(existing);

                const parent = await store.insert({
                    plan_id: body.plan_id,
                    thread_id: plan.thread_id,
                    model_id: plan.model_id,
                    execution_engine: plan.execution_engine,
                    status: "adapter_dispatching",
                    idempotency_key: body.idempotency_key || body.plan_id,
                    plan_hash: planHash(plan),
                    adapter_steps: plan.adapter_steps,
                    adapter_run_ids: [],
                    parameter_values: body.adapter_parameter_values || {}
                });
                const children: AdapterChildRun[] = [];
                for (const step of plan.adapter_steps) {
                    const values =
                        body.adapter_parameter_values?.[step.adapter_plan_id] ||
                        (plan.adapter_steps.length === 1 ? body.parameter_values || {} : {});
                    try {
                        const result = await adapterRequest(
                            "/workflows/submit",
                            {
                                method: "POST",
                                body: {
                                    plan_id: step.adapter_plan_id,
                                    args: values,
                                    execution_id: parentRunId(parent.id)
                                }
                            },
                            authorization
                        );
                        children.push({
                            ...step,
                            run_id: result.run_id,
                            status: result.status || "running"
                        });
                        await store.update(parent.id, { adapter_run_ids: children });
                    } catch (error) {
                        // Validation/authentication errors happen before a child
                        // workflow is accepted. Preserve the adapter's 4xx
                        // response so the caller can fix parameters instead of
                        // receiving an ambiguous parent run.
                        if (
                            children.length === 0 &&
                            error instanceof UnifiedExecutionError &&
                            error.statusCode >= 400 &&
                            error.statusCode < 500
                        ) {
                            await store.update(parent.id, {
                                status: "failed",
                                adapter_run_ids: children,
                                error_message: error.message
                            });
                            throw error;
                        }
                        const updated = await store.update(parent.id, {
                            status: "adapter_unknown",
                            adapter_run_ids: children,
                            error_message: error instanceof Error ? error.message : String(error)
                        });
                        return parentResponse(updated || { ...parent, status: "adapter_unknown" });
                    }
                }
                const updated = await store.update(parent.id, {
                    status: "adapter_running",
                    adapter_run_ids: children
                });
                return parentResponse(updated || { ...parent, status: "adapter_running", adapter_run_ids: children });
            }
            const result = await submitLegacy(plan, authorization);
            return { ...result, executor: "ensemble_manager", parent_execution_id: plan.thread_id };
        }
    };
}
