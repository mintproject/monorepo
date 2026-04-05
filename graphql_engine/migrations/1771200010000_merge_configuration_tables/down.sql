BEGIN;

-- ============================================================================
-- Reverse migration: Recreate the two original tables and copy data back,
-- then drop modelcatalog_configuration.
-- ============================================================================

-- STEP 1: Recreate modelcatalog_model_configuration
CREATE TABLE modelcatalog_model_configuration (
    id TEXT PRIMARY KEY,
    software_version_id TEXT REFERENCES modelcatalog_software_version(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    keywords TEXT,
    usage_notes TEXT,
    has_component_location TEXT,
    has_implementation_script_location TEXT,
    has_software_image TEXT,
    has_model_result_table TEXT,
    author_id TEXT REFERENCES modelcatalog_person(id) ON DELETE SET NULL
);

-- STEP 2: Recreate modelcatalog_model_configuration_setup
CREATE TABLE modelcatalog_model_configuration_setup (
    id TEXT PRIMARY KEY,
    model_configuration_id TEXT REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    has_component_location TEXT,
    has_implementation_script_location TEXT,
    has_software_image TEXT,
    has_region TEXT,
    author_id TEXT REFERENCES modelcatalog_person(id) ON DELETE SET NULL,
    calibration_interval TEXT,
    calibration_method TEXT,
    parameter_assignment_method TEXT,
    valid_until TEXT
);

-- STEP 3: Copy Configuration rows back (model_configuration_id IS NULL)
INSERT INTO modelcatalog_model_configuration (
    id, software_version_id, label, description, keywords, usage_notes,
    has_component_location, has_implementation_script_location,
    has_software_image, has_model_result_table, author_id
)
SELECT
    id, software_version_id, label, description, keywords, usage_notes,
    has_component_location, has_implementation_script_location,
    has_software_image, has_model_result_table, author_id
FROM modelcatalog_configuration
WHERE model_configuration_id IS NULL;

-- STEP 4: Copy Setup rows back (model_configuration_id IS NOT NULL)
INSERT INTO modelcatalog_model_configuration_setup (
    id, model_configuration_id, label, description,
    has_component_location, has_implementation_script_location,
    has_software_image, has_region, author_id,
    calibration_interval, calibration_method,
    parameter_assignment_method, valid_until
)
SELECT
    id, model_configuration_id, label, description,
    has_component_location, has_implementation_script_location,
    has_software_image, has_region, author_id,
    calibration_interval, calibration_method,
    parameter_assignment_method, valid_until
FROM modelcatalog_configuration
WHERE model_configuration_id IS NOT NULL;

-- STEP 5: Drop unified table and indexes
DROP INDEX IF EXISTS idx_mc_config_sv;
DROP INDEX IF EXISTS idx_mc_config_parent;
DROP INDEX IF EXISTS idx_mc_config_author;
DROP TABLE modelcatalog_configuration;

-- STEP 6: Recreate original indexes
CREATE INDEX idx_mc_cfg_version ON modelcatalog_model_configuration(software_version_id);
CREATE INDEX idx_mc_setup_config ON modelcatalog_model_configuration_setup(model_configuration_id);
CREATE INDEX idx_mc_config_author ON modelcatalog_model_configuration(author_id);
CREATE INDEX idx_mc_setup_author ON modelcatalog_model_configuration_setup(author_id);

COMMIT;
