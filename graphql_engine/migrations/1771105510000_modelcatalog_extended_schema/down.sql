BEGIN;

-- ============================================================================
-- Reverse migration for modelcatalog_extended_schema
-- Order: junction tables -> indexes -> columns -> entity tables
-- ============================================================================

-- ============================================================================
-- SECTION 1: Drop junction tables (14 tables)
-- ============================================================================

DROP TABLE IF EXISTS modelcatalog_diagram_part;
DROP TABLE IF EXISTS modelcatalog_parameter_intervention;
DROP TABLE IF EXISTS modelcatalog_setup_calibration_target;
DROP TABLE IF EXISTS modelcatalog_setup_calibrated_variable;
DROP TABLE IF EXISTS modelcatalog_setup_author;
DROP TABLE IF EXISTS modelcatalog_configuration_region;
DROP TABLE IF EXISTS modelcatalog_configuration_time_interval;
DROP TABLE IF EXISTS modelcatalog_configuration_causal_diagram;
DROP TABLE IF EXISTS modelcatalog_software_version_output_variable;
DROP TABLE IF EXISTS modelcatalog_software_version_input_variable;
DROP TABLE IF EXISTS modelcatalog_software_version_image;
DROP TABLE IF EXISTS modelcatalog_software_version_grid;
DROP TABLE IF EXISTS modelcatalog_software_version_process;
DROP TABLE IF EXISTS modelcatalog_software_version_category;

-- ============================================================================
-- SECTION 2: Drop indexes on FK columns in existing tables
-- ============================================================================

-- Drop index on author_id before dropping the column
DROP INDEX IF EXISTS idx_mc_setup_author;

-- ============================================================================
-- SECTION 3: Drop columns from existing tables (11 columns)
-- ============================================================================

-- Remove columns from modelcatalog_model_configuration_setup (5 columns)
ALTER TABLE modelcatalog_model_configuration_setup DROP COLUMN IF EXISTS valid_until;
ALTER TABLE modelcatalog_model_configuration_setup DROP COLUMN IF EXISTS parameter_assignment_method;
ALTER TABLE modelcatalog_model_configuration_setup DROP COLUMN IF EXISTS calibration_method;
ALTER TABLE modelcatalog_model_configuration_setup DROP COLUMN IF EXISTS calibration_interval;
ALTER TABLE modelcatalog_model_configuration_setup DROP COLUMN IF EXISTS author_id;

-- Remove column from modelcatalog_model_configuration (1 column)
ALTER TABLE modelcatalog_model_configuration DROP COLUMN IF EXISTS has_model_result_table;

-- Remove columns from modelcatalog_software_version (5 columns)
ALTER TABLE modelcatalog_software_version DROP COLUMN IF EXISTS theoretical_basis;
ALTER TABLE modelcatalog_software_version DROP COLUMN IF EXISTS runtime_estimation;
ALTER TABLE modelcatalog_software_version DROP COLUMN IF EXISTS parameterization;
ALTER TABLE modelcatalog_software_version DROP COLUMN IF EXISTS limitations;
ALTER TABLE modelcatalog_software_version DROP COLUMN IF EXISTS short_description;

-- ============================================================================
-- SECTION 4: Drop entity tables (10 tables)
-- ============================================================================
-- Note: Indexes on these tables are automatically dropped when tables are dropped

DROP TABLE IF EXISTS modelcatalog_grid;
DROP TABLE IF EXISTS modelcatalog_intervention;
DROP TABLE IF EXISTS modelcatalog_variable_presentation;
DROP TABLE IF EXISTS modelcatalog_image;
DROP TABLE IF EXISTS modelcatalog_causal_diagram;
DROP TABLE IF EXISTS modelcatalog_time_interval;
DROP TABLE IF EXISTS modelcatalog_process;
DROP TABLE IF EXISTS modelcatalog_region;
DROP TABLE IF EXISTS modelcatalog_model_category;
DROP TABLE IF EXISTS modelcatalog_person;

COMMIT;
