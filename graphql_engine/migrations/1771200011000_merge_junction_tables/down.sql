BEGIN;

-- ============================================================================
-- Reverse migration: Restore setup-side junction tables, re-FK configuration-side
-- junctions back to modelcatalog_model_configuration, and recreate old entity tables.
-- NOTE: This down migration assumes migration 1771200010000_merge_configuration_tables/down.sql
-- has already been run to restore modelcatalog_model_configuration and
-- modelcatalog_model_configuration_setup tables.
-- ============================================================================

-- SECTION 5 (reverse): Recreate old entity tables if not already done by 10000 down
-- (These tables would have been recreated by migration 10000 down.sql)

-- SECTION 4 (reverse): Rename configuration_* back to setup_*

-- 4b. modelcatalog_configuration_calibration_target -> modelcatalog_setup_calibration_target
ALTER TABLE modelcatalog_configuration_calibration_target
    DROP CONSTRAINT modelcatalog_configuration_calibration_target_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_calibration_target
    ADD CONSTRAINT modelcatalog_setup_calibration_target_setup_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE;

ALTER TABLE modelcatalog_configuration_calibration_target
    RENAME COLUMN configuration_id TO setup_id;

ALTER TABLE modelcatalog_configuration_calibration_target
    RENAME TO modelcatalog_setup_calibration_target;

-- 4a. modelcatalog_configuration_calibrated_variable -> modelcatalog_setup_calibrated_variable
ALTER TABLE modelcatalog_configuration_calibrated_variable
    DROP CONSTRAINT modelcatalog_configuration_calibrated_variable_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_calibrated_variable
    ADD CONSTRAINT modelcatalog_setup_calibrated_variable_setup_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE;

ALTER TABLE modelcatalog_configuration_calibrated_variable
    RENAME COLUMN configuration_id TO setup_id;

ALTER TABLE modelcatalog_configuration_calibrated_variable
    RENAME TO modelcatalog_setup_calibrated_variable;

-- SECTION 3 (reverse): Re-FK configuration-only junctions back to modelcatalog_model_configuration

ALTER TABLE modelcatalog_configuration_region
    DROP CONSTRAINT modelcatalog_configuration_region_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_region
    ADD CONSTRAINT modelcatalog_configuration_region_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE;

ALTER TABLE modelcatalog_configuration_time_interval
    DROP CONSTRAINT modelcatalog_configuration_time_interval_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_time_interval
    ADD CONSTRAINT modelcatalog_configuration_time_interval_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE;

ALTER TABLE modelcatalog_configuration_causal_diagram
    DROP CONSTRAINT modelcatalog_configuration_causal_diagram_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_causal_diagram
    ADD CONSTRAINT modelcatalog_configuration_causal_diagram_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE;

-- SECTION 2 (reverse): Restore category junctions

CREATE TABLE modelcatalog_modelconfiguration_category (
    model_configuration_id TEXT NOT NULL REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES modelcatalog_model_category(id) ON DELETE CASCADE,
    PRIMARY KEY (model_configuration_id, category_id)
);

CREATE TABLE modelcatalog_modelconfigurationsetup_category (
    model_configuration_setup_id TEXT NOT NULL REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES modelcatalog_model_category(id) ON DELETE CASCADE,
    PRIMARY KEY (model_configuration_setup_id, category_id)
);

-- Restore from merged table (config rows have NULL model_configuration_id, setup rows do not)
INSERT INTO modelcatalog_modelconfiguration_category (model_configuration_id, category_id)
SELECT mc.id, cc.category_id
FROM modelcatalog_configuration_category cc
JOIN modelcatalog_configuration mc ON mc.id = cc.configuration_id
WHERE mc.model_configuration_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO modelcatalog_modelconfigurationsetup_category (model_configuration_setup_id, category_id)
SELECT mc.id, cc.category_id
FROM modelcatalog_configuration_category cc
JOIN modelcatalog_configuration mc ON mc.id = cc.configuration_id
WHERE mc.model_configuration_id IS NOT NULL
ON CONFLICT DO NOTHING;

DROP INDEX IF EXISTS idx_mc_config_cat_cfg;
DROP INDEX IF EXISTS idx_mc_config_cat_cat;
DROP TABLE modelcatalog_configuration_category;

-- SECTION 1 (reverse): Restore setup-side junctions and re-FK configuration-side back

-- 1d. Restore modelcatalog_setup_author
CREATE TABLE modelcatalog_setup_author (
    setup_id TEXT REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE,
    person_id TEXT REFERENCES modelcatalog_person(id) ON DELETE CASCADE,
    PRIMARY KEY (setup_id, person_id)
);

INSERT INTO modelcatalog_setup_author (setup_id, person_id)
SELECT ca.configuration_id, ca.person_id
FROM modelcatalog_configuration_author ca
JOIN modelcatalog_configuration mc ON mc.id = ca.configuration_id
WHERE mc.model_configuration_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE modelcatalog_configuration_author
    DROP CONSTRAINT modelcatalog_configuration_author_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_author
    ADD CONSTRAINT modelcatalog_configuration_author_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE;

DELETE FROM modelcatalog_configuration_author ca
WHERE EXISTS (
    SELECT 1 FROM modelcatalog_configuration mc
    WHERE mc.id = ca.configuration_id AND mc.model_configuration_id IS NOT NULL
);

-- 1c. Restore modelcatalog_setup_parameter
CREATE TABLE modelcatalog_setup_parameter (
    setup_id TEXT REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE,
    parameter_id TEXT REFERENCES modelcatalog_parameter(id) ON DELETE CASCADE,
    PRIMARY KEY (setup_id, parameter_id)
);

INSERT INTO modelcatalog_setup_parameter (setup_id, parameter_id)
SELECT cp.configuration_id, cp.parameter_id
FROM modelcatalog_configuration_parameter cp
JOIN modelcatalog_configuration mc ON mc.id = cp.configuration_id
WHERE mc.model_configuration_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE modelcatalog_configuration_parameter
    DROP CONSTRAINT modelcatalog_configuration_parameter_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_parameter
    ADD CONSTRAINT modelcatalog_configuration_parameter_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE;

DELETE FROM modelcatalog_configuration_parameter cp
WHERE EXISTS (
    SELECT 1 FROM modelcatalog_configuration mc
    WHERE mc.id = cp.configuration_id AND mc.model_configuration_id IS NOT NULL
);

-- 1b. Restore modelcatalog_setup_output
CREATE TABLE modelcatalog_setup_output (
    setup_id TEXT REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE,
    output_id TEXT REFERENCES modelcatalog_dataset_specification(id) ON DELETE CASCADE,
    PRIMARY KEY (setup_id, output_id)
);

INSERT INTO modelcatalog_setup_output (setup_id, output_id)
SELECT co.configuration_id, co.output_id
FROM modelcatalog_configuration_output co
JOIN modelcatalog_configuration mc ON mc.id = co.configuration_id
WHERE mc.model_configuration_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE modelcatalog_configuration_output
    DROP CONSTRAINT modelcatalog_configuration_output_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_output
    ADD CONSTRAINT modelcatalog_configuration_output_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE;

DELETE FROM modelcatalog_configuration_output co
WHERE EXISTS (
    SELECT 1 FROM modelcatalog_configuration mc
    WHERE mc.id = co.configuration_id AND mc.model_configuration_id IS NOT NULL
);

-- 1a. Restore modelcatalog_setup_input
CREATE TABLE modelcatalog_setup_input (
    setup_id TEXT REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE,
    input_id TEXT REFERENCES modelcatalog_dataset_specification(id) ON DELETE CASCADE,
    PRIMARY KEY (setup_id, input_id)
);

INSERT INTO modelcatalog_setup_input (setup_id, input_id)
SELECT ci.configuration_id, ci.input_id
FROM modelcatalog_configuration_input ci
JOIN modelcatalog_configuration mc ON mc.id = ci.configuration_id
WHERE mc.model_configuration_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE modelcatalog_configuration_input
    DROP CONSTRAINT modelcatalog_configuration_input_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration_input
    ADD CONSTRAINT modelcatalog_configuration_input_configuration_id_fkey
        FOREIGN KEY (configuration_id) REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE;

DELETE FROM modelcatalog_configuration_input ci
WHERE EXISTS (
    SELECT 1 FROM modelcatalog_configuration mc
    WHERE mc.id = ci.configuration_id AND mc.model_configuration_id IS NOT NULL
);

COMMIT;
