BEGIN;

CREATE TABLE modelcatalog_etl_process (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    version TEXT,
    owner_username TEXT,
    visibility TEXT NOT NULL DEFAULT 'private',
    runtime_kind TEXT NOT NULL,
    runtime_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT etl_process_visibility_check CHECK (visibility IN ('private', 'shared', 'public')),
    CONSTRAINT etl_process_runtime_check CHECK (runtime_kind IN ('tapis_function', 'tapis_app'))
);

CREATE TABLE modelcatalog_etl_process_contract (
    etl_process_id TEXT NOT NULL REFERENCES modelcatalog_etl_process(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    position INTEGER NOT NULL,
    standard_variable_uri TEXT,
    unit TEXT,
    format TEXT,
    dimensionality TEXT,
    spatial_type TEXT,
    crs_requirement TEXT,
    temporal_resolution TEXT,
    schema_requirement_json JSONB,
    PRIMARY KEY (etl_process_id, role, position),
    CONSTRAINT etl_contract_role_check CHECK (role IN ('input', 'output'))
);

CREATE INDEX idx_mc_etl_owner ON modelcatalog_etl_process(owner_username);
CREATE INDEX idx_mc_etl_contract_process ON modelcatalog_etl_process_contract(etl_process_id);

COMMIT;
