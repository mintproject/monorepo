BEGIN;

-- Repoint thread_model_io.model_io_id FK from public.model_io to
-- modelcatalog_dataset_specification. Mirrors 1771200014000 which handled
-- execution_data_binding and execution_result. thread_model_io was missed
-- in that migration; UI now writes modelcatalog_dataset_specification.id
-- into thread_model_io.model_io_id and the legacy FK rejects every insert.
--
-- model_io_id is part of the PK on thread_model_io (model_io_id,
-- thread_model_id, dataslice_id) so orphaned rows must be deleted before
-- the new FK is added (cannot be nulled).

-- =========================================================================
-- SECTION 1: Delete orphaned rows before adding new FK constraint
-- =========================================================================

DELETE FROM thread_model_io tmio
WHERE NOT EXISTS (
    SELECT 1 FROM modelcatalog_dataset_specification ds
    WHERE ds.id = tmio.model_io_id
);

-- =========================================================================
-- SECTION 2: Drop old FK constraint to public.model_io
-- Constraint name from 1662641297914_init/up.sql line 561
-- =========================================================================

ALTER TABLE thread_model_io
    DROP CONSTRAINT thread_model_io_model_io_id_fkey;

-- =========================================================================
-- SECTION 3: Add new FK constraint to modelcatalog_dataset_specification
-- =========================================================================

ALTER TABLE thread_model_io
    ADD CONSTRAINT thread_model_io_modelcatalog_ds_fkey
    FOREIGN KEY (model_io_id) REFERENCES modelcatalog_dataset_specification(id)
    ON DELETE SET NULL;

COMMIT;
