BEGIN;

-- Reverse Migration 1: Remove FK columns from execution and thread_model
-- and restore the original NOT NULL FK constraints on model_id.
--
-- Note: Rows that had model_id populated will still have those values.
-- Backfilled modelcatalog_*_id values are lost on rollback.
-- The restored NOT NULL constraint may fail if any row has a null model_id
-- (which could happen if new rows were inserted during the migration window).

-- =========================================================================
-- SECTION 1: execution table - drop new FK columns and restore old constraint
-- =========================================================================

-- Dropping the columns also drops their indexes and FK constraints via CASCADE
ALTER TABLE execution
    DROP COLUMN IF EXISTS modelcatalog_configuration_id,
    DROP COLUMN IF EXISTS modelcatalog_setup_id;

-- Restore NOT NULL on model_id
ALTER TABLE execution
    ALTER COLUMN model_id SET NOT NULL;

-- Restore original FK constraint to model(id)
ALTER TABLE execution
    ADD CONSTRAINT execution_model_id_fkey
    FOREIGN KEY (model_id) REFERENCES model(id);

-- =========================================================================
-- SECTION 2: thread_model table - drop new FK columns and restore old constraint
-- =========================================================================

-- Dropping the columns also drops their indexes and FK constraints via CASCADE
ALTER TABLE thread_model
    DROP COLUMN IF EXISTS modelcatalog_configuration_id,
    DROP COLUMN IF EXISTS modelcatalog_setup_id;

-- Restore NOT NULL on model_id
ALTER TABLE thread_model
    ALTER COLUMN model_id SET NOT NULL;

-- Restore original FK constraint to model(id)
ALTER TABLE thread_model
    ADD CONSTRAINT thread_model_model_id_fkey
    FOREIGN KEY (model_id) REFERENCES model(id);

COMMIT;
