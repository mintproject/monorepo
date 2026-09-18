BEGIN;

CREATE SCHEMA IF NOT EXISTS adapter;

CREATE TABLE adapter.data_object (
    id TEXT PRIMARY KEY NOT NULL DEFAULT public.gen_random_uuid()::text,
    label TEXT NOT NULL,
    description TEXT,
    resource_uri TEXT NOT NULL,
    filename TEXT,
    format TEXT,
    extension TEXT,
    mime_type TEXT,
    checksum TEXT,
    source_catalog TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE adapter.data_object_variable (
    id TEXT PRIMARY KEY NOT NULL DEFAULT public.gen_random_uuid()::text,
    data_object_id TEXT NOT NULL REFERENCES adapter.data_object(id) ON DELETE CASCADE,
    standard_variable_uri TEXT,
    local_name TEXT,
    unit TEXT,
    dimensionality TEXT,
    spatial_type TEXT,
    crs TEXT,
    grid_id TEXT,
    grid_description TEXT,
    temporal_resolution TEXT,
    schema_json JSONB,
    metadata_json JSONB
);

CREATE TABLE adapter.transform_spec (
    id TEXT PRIMARY KEY NOT NULL DEFAULT public.gen_random_uuid()::text,
    name TEXT NOT NULL,
    version TEXT,
    description TEXT,
    transform_type TEXT,
    is_lossy BOOLEAN NOT NULL DEFAULT false,
    method TEXT,
    tapis_app_id TEXT,
    app_version TEXT,
    container_image TEXT,
    source_code_url TEXT,
    parameters_schema_json JSONB,
    stage TEXT,
    env_from_args JSONB,
    file_inputs JSONB,
    mint_model_config_id TEXT,
    mint_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT transform_spec_mint_model_config_id_key UNIQUE (mint_model_config_id)
);

CREATE TABLE adapter.transform_contract (
    id TEXT PRIMARY KEY NOT NULL DEFAULT public.gen_random_uuid()::text,
    transform_spec_id TEXT NOT NULL REFERENCES adapter.transform_spec(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    standard_variable_uri TEXT,
    format TEXT,
    unit TEXT,
    dimensionality TEXT,
    spatial_type TEXT,
    crs_requirement TEXT,
    temporal_resolution TEXT,
    schema_requirement_json JSONB,
    metadata_json JSONB,
    CONSTRAINT transform_contract_role_check CHECK (role IN ('input', 'output'))
);

CREATE TABLE adapter.transform_edge (
    id TEXT PRIMARY KEY NOT NULL DEFAULT public.gen_random_uuid()::text,
    source_contract_id TEXT NOT NULL REFERENCES adapter.transform_contract(id) ON DELETE CASCADE,
    target_contract_id TEXT NOT NULL REFERENCES adapter.transform_contract(id) ON DELETE CASCADE,
    is_lossy BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT transform_edge_pair_key UNIQUE (source_contract_id, target_contract_id)
);

CREATE TABLE adapter.readiness_assessment (
    id TEXT PRIMARY KEY NOT NULL DEFAULT public.gen_random_uuid()::text,
    data_object_id TEXT NOT NULL REFERENCES adapter.data_object(id) ON DELETE CASCADE,
    model_configuration_id TEXT,
    dataset_specification_id TEXT,
    status TEXT NOT NULL,
    missing_requirements_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE adapter.workflow_plan (
    id TEXT PRIMARY KEY NOT NULL DEFAULT public.gen_random_uuid()::text,
    source_data_object_id TEXT REFERENCES adapter.data_object(id) ON DELETE SET NULL,
    target_model_configuration_id TEXT,
    target_dataset_specification_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    tapis_workflow_definition_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE adapter.workflow_run (
    id TEXT PRIMARY KEY NOT NULL DEFAULT public.gen_random_uuid()::text,
    workflow_plan_id TEXT REFERENCES adapter.workflow_plan(id) ON DELETE SET NULL,
    execution_id TEXT,
    tapis_workflow_id TEXT,
    tapis_run_id TEXT,
    status TEXT NOT NULL DEFAULT 'submitting',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    output_data_object_id TEXT REFERENCES adapter.data_object(id) ON DELETE SET NULL,
    logs_uri TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE adapter.provenance_event (
    id TEXT PRIMARY KEY NOT NULL DEFAULT public.gen_random_uuid()::text,
    workflow_run_id TEXT REFERENCES adapter.workflow_run(id) ON DELETE CASCADE,
    data_object_id TEXT REFERENCES adapter.data_object(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX data_object_variable_data_object_id_idx
    ON adapter.data_object_variable (data_object_id);
CREATE INDEX data_object_source_catalog_idx
    ON adapter.data_object (source_catalog);
CREATE INDEX transform_contract_transform_spec_id_idx
    ON adapter.transform_contract (transform_spec_id);
CREATE INDEX transform_contract_svo_idx
    ON adapter.transform_contract (standard_variable_uri);
CREATE INDEX transform_edge_source_contract_id_idx
    ON adapter.transform_edge (source_contract_id);
CREATE INDEX transform_edge_target_contract_id_idx
    ON adapter.transform_edge (target_contract_id);
CREATE INDEX readiness_assessment_data_object_id_idx
    ON adapter.readiness_assessment (data_object_id);
CREATE INDEX workflow_plan_source_data_object_id_idx
    ON adapter.workflow_plan (source_data_object_id);
CREATE INDEX workflow_run_workflow_plan_id_idx
    ON adapter.workflow_run (workflow_plan_id);
CREATE INDEX workflow_run_status_idx
    ON adapter.workflow_run (status);
CREATE INDEX provenance_event_workflow_run_id_idx
    ON adapter.provenance_event (workflow_run_id);
CREATE INDEX provenance_event_data_object_id_idx
    ON adapter.provenance_event (data_object_id);

COMMIT;
