BEGIN;

-- The original ETL contract migration may be marked applied on a persistent
-- database even when its contract table was never created or exposed. Keep
-- this repair additive and idempotent so it is safe for both cases.
CREATE TABLE IF NOT EXISTS modelcatalog_etl_process_contract (
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

CREATE INDEX IF NOT EXISTS idx_mc_etl_contract_process
    ON modelcatalog_etl_process_contract(etl_process_id);

COMMIT;
