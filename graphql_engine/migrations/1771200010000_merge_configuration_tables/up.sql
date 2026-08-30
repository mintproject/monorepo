BEGIN;

-- ============================================================================
-- Migration: Merge modelcatalog_model_configuration and
-- modelcatalog_model_configuration_setup into a single modelcatalog_configuration
-- table. Configuration rows have model_configuration_id IS NULL; Setup rows
-- have model_configuration_id populated (self-FK pointing to their parent
-- Configuration).
-- ============================================================================

-- STEP 1: Create the unified modelcatalog_configuration table
-- Column set is a superset of both old tables.
-- model_configuration_id is the self-FK that distinguishes Setup rows (non-NULL)
-- from Configuration rows (NULL).
CREATE TABLE modelcatalog_configuration (
    id TEXT PRIMARY KEY,
    software_version_id TEXT REFERENCES modelcatalog_software_version(id) ON DELETE CASCADE,
    model_configuration_id TEXT REFERENCES modelcatalog_configuration(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    keywords TEXT,
    usage_notes TEXT,
    has_component_location TEXT,
    has_implementation_script_location TEXT,
    has_software_image TEXT,
    has_model_result_table TEXT,
    has_region TEXT,
    calibration_interval TEXT,
    calibration_method TEXT,
    parameter_assignment_method TEXT,
    valid_until TEXT,
    author_id TEXT REFERENCES modelcatalog_person(id) ON DELETE SET NULL
);

-- STEP 2: Insert Configuration rows (model_configuration_id = NULL)
-- Columns present in modelcatalog_model_configuration:
--   id, software_version_id, label, description, keywords, usage_notes,
--   has_component_location, has_implementation_script_location, has_software_image,
--   has_model_result_table, author_id
INSERT INTO modelcatalog_configuration (
    id,
    software_version_id,
    model_configuration_id,
    label,
    description,
    keywords,
    usage_notes,
    has_component_location,
    has_implementation_script_location,
    has_software_image,
    has_model_result_table,
    author_id
)
SELECT
    id,
    software_version_id,
    NULL,
    label,
    description,
    keywords,
    usage_notes,
    has_component_location,
    has_implementation_script_location,
    has_software_image,
    has_model_result_table,
    author_id
FROM modelcatalog_model_configuration;

-- STEP 3: Insert Setup rows (model_configuration_id = non-NULL self-FK)
-- Columns present in modelcatalog_model_configuration_setup:
--   id, model_configuration_id, label, description, has_component_location,
--   has_implementation_script_location, has_software_image, has_region,
--   author_id, calibration_interval, calibration_method,
--   parameter_assignment_method, valid_until
INSERT INTO modelcatalog_configuration (
    id,
    model_configuration_id,
    label,
    description,
    has_component_location,
    has_implementation_script_location,
    has_software_image,
    has_region,
    author_id,
    calibration_interval,
    calibration_method,
    parameter_assignment_method,
    valid_until
)
SELECT
    id,
    model_configuration_id,
    label,
    description,
    has_component_location,
    has_implementation_script_location,
    has_software_image,
    has_region,
    author_id,
    calibration_interval,
    calibration_method,
    parameter_assignment_method,
    valid_until
FROM modelcatalog_model_configuration_setup;

-- STEP 4: Create indexes on FK columns
-- Use unique names to avoid collision with existing indexes on old tables
CREATE INDEX idx_mc_configuration_sv ON modelcatalog_configuration(software_version_id);
CREATE INDEX idx_mc_configuration_parent ON modelcatalog_configuration(model_configuration_id);
CREATE INDEX idx_mc_configuration_author ON modelcatalog_configuration(author_id);

COMMIT;
