BEGIN;

ALTER TABLE public.unified_execution
    ADD COLUMN parameter_values_hash TEXT,
    ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN state_revision INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN model_child_id TEXT,
    ADD COLUMN model_output_id TEXT,
    ADD COLUMN output_handoff JSONB,
    ADD COLUMN failure_code TEXT;

CREATE TABLE public.unified_execution_step (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES public.unified_execution(id) ON DELETE CASCADE,
    step_key TEXT NOT NULL,
    stage TEXT NOT NULL,
    external_id TEXT,
    idempotency_key TEXT NOT NULL,
    plan_hash TEXT NOT NULL,
    parameter_values_hash TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    attempt INTEGER NOT NULL DEFAULT 0,
    output_reference JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unified_execution_step_key UNIQUE (execution_id, step_key),
    CONSTRAINT unified_execution_step_launch_key UNIQUE (
        execution_id, step_key, plan_hash, parameter_values_hash
    )
);

CREATE INDEX unified_execution_step_execution_idx
    ON public.unified_execution_step (execution_id);
CREATE INDEX unified_execution_step_status_idx
    ON public.unified_execution_step (status);

COMMIT;
