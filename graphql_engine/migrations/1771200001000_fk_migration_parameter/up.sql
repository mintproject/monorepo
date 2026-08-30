BEGIN;

-- Migration 2: FK Migration - Parameter table repointing and model_io FK addition
-- Repoints execution_parameter_binding and thread_model_parameter from model_parameter
-- to modelcatalog_parameter. Also adds a nullable FK column to model_io pointing to
-- modelcatalog_dataset_specification.
--
-- IMPORTANT: Orphaned rows in execution_parameter_binding and thread_model_parameter
-- (where model_parameter_id does NOT exist in modelcatalog_parameter) are DELETED
-- before adding the new FK constraint. They cannot be nulled because model_parameter_id
-- is part of the primary key on both tables.
--
-- Pre-conditions verified by user review of classify-fk-preview.sql:
--   - 0 orphaned parameter binding rows (no deletions needed)

-- =========================================================================
-- SECTION 1: model_io - add nullable FK column to modelcatalog_dataset_specification
-- =========================================================================

ALTER TABLE model_io
    ADD COLUMN modelcatalog_dataset_specification_id TEXT
        REFERENCES modelcatalog_dataset_specification(id) ON DELETE SET NULL;

-- Add index immediately (PostgreSQL does NOT auto-index FK columns)
CREATE INDEX idx_model_io_mc_ds ON model_io(modelcatalog_dataset_specification_id);

-- Backfill: model_io rows whose id matches a modelcatalog_dataset_specification row
UPDATE model_io mio
SET modelcatalog_dataset_specification_id = mio.id
WHERE EXISTS (
    SELECT 1 FROM modelcatalog_dataset_specification ds WHERE ds.id = mio.id
);

-- =========================================================================
-- SECTION 2: Delete orphaned parameter binding rows before adding new FK
-- These rows have no match in modelcatalog_parameter; they MUST be deleted
-- because model_parameter_id is part of the primary key and cannot be nulled.
-- =========================================================================

-- Delete orphaned rows from execution_parameter_binding
DELETE FROM execution_parameter_binding epb
WHERE NOT EXISTS (
    SELECT 1 FROM modelcatalog_parameter mp WHERE mp.id = epb.model_parameter_id
);

-- Delete orphaned rows from thread_model_parameter
DELETE FROM thread_model_parameter tmp
WHERE NOT EXISTS (
    SELECT 1 FROM modelcatalog_parameter mp WHERE mp.id = tmp.model_parameter_id
);

-- =========================================================================
-- SECTION 3: Drop old FK constraints to model_parameter
-- Constraint names verified from 1662641297914_init/up.sql
-- =========================================================================

ALTER TABLE execution_parameter_binding
    DROP CONSTRAINT execution_parameter_binding_model_parameter_id_fkey;

ALTER TABLE thread_model_parameter
    DROP CONSTRAINT thread_model_parameter_parameter_id_fkey;

-- =========================================================================
-- SECTION 4: Add new FK constraints to modelcatalog_parameter
-- Orphans have been deleted above so constraint addition will succeed.
-- =========================================================================

ALTER TABLE execution_parameter_binding
    ADD CONSTRAINT execution_parameter_binding_modelcatalog_parameter_fkey
    FOREIGN KEY (model_parameter_id) REFERENCES modelcatalog_parameter(id)
    ON DELETE SET NULL;

ALTER TABLE thread_model_parameter
    ADD CONSTRAINT thread_model_parameter_modelcatalog_parameter_fkey
    FOREIGN KEY (model_parameter_id) REFERENCES modelcatalog_parameter(id)
    ON DELETE SET NULL;

COMMIT;
