BEGIN;

-- Adapter plans are orchestration state.  They must not be written to
-- thread_model_parameter, whose model_parameter_id is foreign-keyed to the
-- MINT catalog parameter table.
CREATE TABLE public.thread_adapter_plan (
    id uuid PRIMARY KEY DEFAULT public.gen_random_uuid(),
    thread_model_id uuid NOT NULL REFERENCES public.thread_model(id) ON DELETE CASCADE,
    model_io_id text NOT NULL,
    source_resource_id text NOT NULL,
    executor text NOT NULL DEFAULT 'svo_adapter',
    adapter_plan_id text,
    status text NOT NULL DEFAULT 'draft',
    plan_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    parameter_values jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT thread_adapter_plan_binding_key
        UNIQUE (thread_model_id, model_io_id, source_resource_id)
);

CREATE INDEX thread_adapter_plan_thread_model_idx
    ON public.thread_adapter_plan (thread_model_id);

COMMIT;
