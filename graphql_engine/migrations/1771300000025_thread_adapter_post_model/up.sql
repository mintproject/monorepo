BEGIN;

ALTER TABLE public.thread_adapter_plan
    ADD COLUMN stage TEXT NOT NULL DEFAULT 'pre_model',
    ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'resource',
    ADD COLUMN source_contract JSONB,
    ADD COLUMN source_contract_hash TEXT,
    ADD COLUMN parameter_schema_hash TEXT,
    ADD COLUMN plan_revision INTEGER;

ALTER TABLE public.thread_adapter_plan
    DROP CONSTRAINT thread_adapter_plan_binding_key;

ALTER TABLE public.thread_adapter_plan
    ALTER COLUMN source_resource_id DROP NOT NULL;

ALTER TABLE public.thread_adapter_plan
    ADD CONSTRAINT thread_adapter_plan_stage_check
        CHECK (stage IN ('pre_model', 'post_model')),
    ADD CONSTRAINT thread_adapter_plan_source_kind_check
        CHECK (source_kind IN ('resource', 'model_output'));

CREATE UNIQUE INDEX thread_adapter_plan_input_binding_key
    ON public.thread_adapter_plan (thread_model_id, model_io_id, source_resource_id)
    WHERE stage = 'pre_model';

CREATE UNIQUE INDEX thread_adapter_plan_post_model_binding_key
    ON public.thread_adapter_plan (thread_model_id, model_io_id, adapter_plan_id, plan_revision)
    WHERE stage = 'post_model';

COMMIT;
