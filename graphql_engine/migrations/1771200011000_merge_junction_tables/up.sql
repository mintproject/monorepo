BEGIN;

-- ============================================================================
-- Migration: Consolidate all junction tables to reference modelcatalog_configuration
-- instead of the old modelcatalog_model_configuration /
-- modelcatalog_model_configuration_setup tables. Merge setup-side junctions
-- into the corresponding configuration-side junctions, rename setup-only
-- junctions, and drop all old entity tables and their junctions.
-- ============================================================================

-- ============================================================================
-- SECTION 1: Overlapping junctions — re-FK + merge setup rows + drop setup table
-- ============================================================================

-- 1a. modelcatalog_configuration_input
--     Old FK: configuration_id -> modelcatalog_model_configuration(id)
--     New FK: configuration_id -> modelcatalog_configuration(id)

ALTER TABLE modelcatalog_configuration_input
    DROP CONSTRAINT modelcatalog_configuration_input_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_input
    ADD CONSTRAINT modelcatalog_configuration_input_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_configuration(id) ON DELETE CASCADE;

INSERT INTO modelcatalog_configuration_input (configuration_id, input_id)
SELECT setup_id, input_id FROM modelcatalog_setup_input
ON CONFLICT DO NOTHING;

DROP TABLE modelcatalog_setup_input;

-- 1b. modelcatalog_configuration_output
--     Old FK: configuration_id -> modelcatalog_model_configuration(id)
--     New FK: configuration_id -> modelcatalog_configuration(id)

ALTER TABLE modelcatalog_configuration_output
    DROP CONSTRAINT modelcatalog_configuration_output_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_output
    ADD CONSTRAINT modelcatalog_configuration_output_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_configuration(id) ON DELETE CASCADE;

INSERT INTO modelcatalog_configuration_output (configuration_id, output_id)
SELECT setup_id, output_id FROM modelcatalog_setup_output
ON CONFLICT DO NOTHING;

DROP TABLE modelcatalog_setup_output;

-- 1c. modelcatalog_configuration_parameter
--     Old FK: configuration_id -> modelcatalog_model_configuration(id)
--     New FK: configuration_id -> modelcatalog_configuration(id)

ALTER TABLE modelcatalog_configuration_parameter
    DROP CONSTRAINT modelcatalog_configuration_parameter_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_parameter
    ADD CONSTRAINT modelcatalog_configuration_parameter_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_configuration(id) ON DELETE CASCADE;

INSERT INTO modelcatalog_configuration_parameter (configuration_id, parameter_id)
SELECT setup_id, parameter_id FROM modelcatalog_setup_parameter
ON CONFLICT DO NOTHING;

DROP TABLE modelcatalog_setup_parameter;

-- 1d. modelcatalog_configuration_author
--     Old FK: configuration_id -> modelcatalog_model_configuration(id)
--     New FK: configuration_id -> modelcatalog_configuration(id)

ALTER TABLE modelcatalog_configuration_author
    DROP CONSTRAINT modelcatalog_configuration_author_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_author
    ADD CONSTRAINT modelcatalog_configuration_author_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_configuration(id) ON DELETE CASCADE;

INSERT INTO modelcatalog_configuration_author (configuration_id, person_id)
SELECT setup_id, person_id FROM modelcatalog_setup_author
ON CONFLICT DO NOTHING;

DROP TABLE modelcatalog_setup_author;

-- ============================================================================
-- SECTION 2: Category junctions — create merged table, migrate data, drop old tables
-- ============================================================================

-- The old tables used non-standard FK column names:
--   modelcatalog_modelconfiguration_category: model_configuration_id -> modelcatalog_model_configuration
--   modelcatalog_modelconfigurationsetup_category: model_configuration_setup_id -> modelcatalog_model_configuration_setup
-- New table uses standard: configuration_id -> modelcatalog_configuration

CREATE TABLE modelcatalog_configuration_category (
    configuration_id TEXT REFERENCES modelcatalog_configuration(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES modelcatalog_model_category(id) ON DELETE CASCADE,
    PRIMARY KEY (configuration_id, category_id)
);

INSERT INTO modelcatalog_configuration_category (configuration_id, category_id)
SELECT model_configuration_id, category_id
FROM modelcatalog_modelconfiguration_category
ON CONFLICT DO NOTHING;

INSERT INTO modelcatalog_configuration_category (configuration_id, category_id)
SELECT model_configuration_setup_id, category_id
FROM modelcatalog_modelconfigurationsetup_category
ON CONFLICT DO NOTHING;

DROP TABLE modelcatalog_modelconfiguration_category;
DROP TABLE modelcatalog_modelconfigurationsetup_category;

CREATE INDEX idx_mc_config_cat_cfg ON modelcatalog_configuration_category(configuration_id);
CREATE INDEX idx_mc_config_cat_cat ON modelcatalog_configuration_category(category_id);

-- ============================================================================
-- SECTION 3: Configuration-only junctions — re-FK to modelcatalog_configuration
-- ============================================================================

-- 3a. modelcatalog_configuration_causal_diagram
--     Old FK: configuration_id -> modelcatalog_model_configuration(id)
--     New FK: configuration_id -> modelcatalog_configuration(id)

ALTER TABLE modelcatalog_configuration_causal_diagram
    DROP CONSTRAINT modelcatalog_configuration_causal_diagram_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_causal_diagram
    ADD CONSTRAINT modelcatalog_configuration_causal_diagram_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_configuration(id) ON DELETE CASCADE;

-- 3b. modelcatalog_configuration_time_interval
--     Old FK: configuration_id -> modelcatalog_model_configuration(id)
--     New FK: configuration_id -> modelcatalog_configuration(id)

ALTER TABLE modelcatalog_configuration_time_interval
    DROP CONSTRAINT modelcatalog_configuration_time_interval_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_time_interval
    ADD CONSTRAINT modelcatalog_configuration_time_interval_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_configuration(id) ON DELETE CASCADE;

-- 3c. modelcatalog_configuration_region
--     Old FK: configuration_id -> modelcatalog_model_configuration(id)
--     New FK: configuration_id -> modelcatalog_configuration(id)

ALTER TABLE modelcatalog_configuration_region
    DROP CONSTRAINT modelcatalog_configuration_region_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_region
    ADD CONSTRAINT modelcatalog_configuration_region_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_configuration(id) ON DELETE CASCADE;

-- ============================================================================
-- SECTION 4: Setup-only junctions — rename to configuration_* and re-FK
-- ============================================================================

-- 4a. modelcatalog_setup_calibrated_variable -> modelcatalog_configuration_calibrated_variable
ALTER TABLE modelcatalog_setup_calibrated_variable
    RENAME TO modelcatalog_configuration_calibrated_variable;

ALTER TABLE modelcatalog_configuration_calibrated_variable
    RENAME COLUMN setup_id TO configuration_id;

ALTER TABLE modelcatalog_configuration_calibrated_variable
    DROP CONSTRAINT modelcatalog_setup_calibrated_variable_setup_id_fkey;

ALTER TABLE modelcatalog_configuration_calibrated_variable
    ADD CONSTRAINT modelcatalog_configuration_calibrated_variable_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_configuration(id) ON DELETE CASCADE;

-- 4b. modelcatalog_setup_calibration_target -> modelcatalog_configuration_calibration_target
ALTER TABLE modelcatalog_setup_calibration_target
    RENAME TO modelcatalog_configuration_calibration_target;

ALTER TABLE modelcatalog_configuration_calibration_target
    RENAME COLUMN setup_id TO configuration_id;

ALTER TABLE modelcatalog_configuration_calibration_target
    DROP CONSTRAINT modelcatalog_setup_calibration_target_setup_id_fkey;

ALTER TABLE modelcatalog_configuration_calibration_target
    ADD CONSTRAINT modelcatalog_configuration_calibration_target_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_configuration(id) ON DELETE CASCADE;

-- ============================================================================
-- SECTION 5: Drop old entity tables (data already migrated in migration 10000)
-- ============================================================================

-- Drop FK constraints from execution and thread_model that reference the old tables
-- (these will be re-added pointing to modelcatalog_configuration in migration 12000)
ALTER TABLE execution DROP CONSTRAINT IF EXISTS execution_modelcatalog_setup_id_fkey;
ALTER TABLE execution DROP CONSTRAINT IF EXISTS execution_modelcatalog_configuration_id_fkey;
ALTER TABLE thread_model DROP CONSTRAINT IF EXISTS thread_model_modelcatalog_setup_id_fkey;
ALTER TABLE thread_model DROP CONSTRAINT IF EXISTS thread_model_modelcatalog_configuration_id_fkey;

-- Drop modelcatalog_model_configuration_setup first
DROP TABLE modelcatalog_model_configuration_setup;

-- Drop modelcatalog_model_configuration (setup table gone, no remaining dependents)
DROP TABLE modelcatalog_model_configuration;

COMMIT;
