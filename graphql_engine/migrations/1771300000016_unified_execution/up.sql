BEGIN;

-- Parent state for the unified Ensemble Manager/SVO adapter handoff.  The
-- service owns this record; the browser only receives its opaque id and status.
CREATE TABLE public.unified_execution (
    id uuid PRIMARY KEY DEFAULT public.gen_random_uuid(),
    plan_id text NOT NULL UNIQUE,
    thread_id text NOT NULL,
    model_id text NOT NULL,
    execution_engine text NOT NULL,
    status text NOT NULL DEFAULT 'planned',
    idempotency_key text NOT NULL,
    plan_hash text NOT NULL,
    adapter_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    adapter_run_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    parameter_values jsonb NOT NULL DEFAULT '{}'::jsonb,
    model_result jsonb,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unified_execution_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX unified_execution_status_idx
    ON public.unified_execution (status);
CREATE INDEX unified_execution_thread_model_idx
    ON public.unified_execution (thread_id, model_id);

COMMIT;
