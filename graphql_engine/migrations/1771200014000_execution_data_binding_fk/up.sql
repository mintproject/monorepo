BEGIN;

-- Repoint execution_data_binding.model_io_id and execution_result.model_io_id
-- FK constraints from model_io to modelcatalog_dataset_specification.
-- Following pattern from migration 1771200001000 (parameter FK repoint).
--
-- model_io_id is part of the PK on both tables so orphaned rows must be deleted
-- (cannot be nulled).

-- =========================================================================
-- SECTION 1: Delete orphaned rows before adding new FK constraints
-- =========================================================================

-- Delete orphaned execution_data_binding rows
DELETE FROM execution_data_binding edb
WHERE NOT EXISTS (
    SELECT 1 FROM modelcatalog_dataset_specification ds WHERE ds.id = edb.model_io_id
);

-- Delete orphaned execution_result rows
DELETE FROM execution_result er
WHERE NOT EXISTS (
    SELECT 1 FROM modelcatalog_dataset_specification ds WHERE ds.id = er.model_io_id
);

-- =========================================================================
-- SECTION 2: Drop old FK constraints to model_io
-- Constraint names from 1662641297914_init/up.sql lines 485, 497
-- =========================================================================

ALTER TABLE execution_data_binding
    DROP CONSTRAINT execution_data_binding_model_io_id_fkey;

ALTER TABLE execution_result
    DROP CONSTRAINT execution_result_model_io_id_fkey;

-- =========================================================================
-- SECTION 3: Add new FK constraints to modelcatalog_dataset_specification
-- =========================================================================

ALTER TABLE execution_data_binding
    ADD CONSTRAINT execution_data_binding_modelcatalog_ds_fkey
    FOREIGN KEY (model_io_id) REFERENCES modelcatalog_dataset_specification(id)
    ON DELETE SET NULL;

ALTER TABLE execution_result
    ADD CONSTRAINT execution_result_modelcatalog_ds_fkey
    FOREIGN KEY (model_io_id) REFERENCES modelcatalog_dataset_specification(id)
    ON DELETE SET NULL;

COMMIT;
