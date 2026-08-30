BEGIN;

-- Reverse Migration 2: Remove new FK constraints and modelcatalog_dataset_specification_id
-- column from model_io, and restore original FK constraints from execution_parameter_binding
-- and thread_model_parameter to model_parameter.
--
-- WARNING: Orphaned parameter binding rows that were DELETED by the up migration
-- cannot be restored here. This rollback only reverses the structural changes.
-- Any data deleted from execution_parameter_binding and thread_model_parameter
-- during the up migration is permanently lost unless restored from a pg_dump backup.

-- =========================================================================
-- SECTION 1: Drop new FK constraints to modelcatalog_parameter
-- =========================================================================

ALTER TABLE execution_parameter_binding
    DROP CONSTRAINT IF EXISTS execution_parameter_binding_modelcatalog_parameter_fkey;

ALTER TABLE thread_model_parameter
    DROP CONSTRAINT IF EXISTS thread_model_parameter_modelcatalog_parameter_fkey;

-- =========================================================================
-- SECTION 2: Restore original FK constraints to model_parameter
-- =========================================================================

ALTER TABLE execution_parameter_binding
    ADD CONSTRAINT execution_parameter_binding_model_parameter_id_fkey
    FOREIGN KEY (model_parameter_id) REFERENCES model_parameter(id);

ALTER TABLE thread_model_parameter
    ADD CONSTRAINT thread_model_parameter_parameter_id_fkey
    FOREIGN KEY (model_parameter_id) REFERENCES model_parameter(id);

-- =========================================================================
-- SECTION 3: Drop modelcatalog_dataset_specification_id column from model_io
-- Dropping the column also drops its index and FK constraint via CASCADE
-- =========================================================================

ALTER TABLE model_io
    DROP COLUMN IF EXISTS modelcatalog_dataset_specification_id;

COMMIT;
