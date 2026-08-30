BEGIN;

-- Migration 1: FK Migration - Classify execution and thread_model rows
-- Adds nullable FK columns to execution and thread_model pointing to modelcatalog_*
-- tables, backfills them by string-match against existing modelcatalog_* rows,
-- then drops the old NOT NULL FK constraint on model_id while keeping the column.
--
-- Pre-conditions verified by user review of classify-fk-preview.sql:
--   - 6 ModelConfiguration matches
--   - 7 ModelConfigurationSetup matches
--   - 0 ORPHAN rows
--   - 0 execution rows affected (zero-impact)
--   - 0 thread_model rows affected (zero-impact)

-- =========================================================================
-- SECTION 1: execution table - add nullable FK columns
-- =========================================================================

ALTER TABLE execution
    ADD COLUMN modelcatalog_configuration_id TEXT
        REFERENCES modelcatalog_model_configuration(id) ON DELETE SET NULL,
    ADD COLUMN modelcatalog_setup_id TEXT
        REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE SET NULL;

-- Add indexes immediately (PostgreSQL does NOT auto-index FK columns)
CREATE INDEX idx_execution_mc_config ON execution(modelcatalog_configuration_id);
CREATE INDEX idx_execution_mc_setup ON execution(modelcatalog_setup_id);

-- Backfill: rows whose model_id matches a ModelConfiguration row
UPDATE execution e
SET modelcatalog_configuration_id = e.model_id
WHERE EXISTS (
    SELECT 1 FROM modelcatalog_model_configuration mc WHERE mc.id = e.model_id
);

-- Backfill: remaining unmatched rows against ModelConfigurationSetup
UPDATE execution e
SET modelcatalog_setup_id = e.model_id
WHERE modelcatalog_configuration_id IS NULL
AND EXISTS (
    SELECT 1 FROM modelcatalog_model_configuration_setup ms WHERE ms.id = e.model_id
);

-- =========================================================================
-- SECTION 2: thread_model table - add nullable FK columns
-- =========================================================================

ALTER TABLE thread_model
    ADD COLUMN modelcatalog_configuration_id TEXT
        REFERENCES modelcatalog_model_configuration(id) ON DELETE SET NULL,
    ADD COLUMN modelcatalog_setup_id TEXT
        REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE SET NULL;

-- Add indexes immediately
CREATE INDEX idx_thread_model_mc_config ON thread_model(modelcatalog_configuration_id);
CREATE INDEX idx_thread_model_mc_setup ON thread_model(modelcatalog_setup_id);

-- Backfill: rows whose model_id matches a ModelConfiguration row
UPDATE thread_model tm
SET modelcatalog_configuration_id = tm.model_id
WHERE EXISTS (
    SELECT 1 FROM modelcatalog_model_configuration mc WHERE mc.id = tm.model_id
);

-- Backfill: remaining unmatched rows against ModelConfigurationSetup
UPDATE thread_model tm
SET modelcatalog_setup_id = tm.model_id
WHERE modelcatalog_configuration_id IS NULL
AND EXISTS (
    SELECT 1 FROM modelcatalog_model_configuration_setup ms WHERE ms.id = tm.model_id
);

-- =========================================================================
-- SECTION 3: Drop old FK constraints and make model_id nullable
-- Constraint names verified from 1662641297914_init/up.sql
-- =========================================================================

-- Drop old FK constraint and make model_id nullable on execution
-- Column stays for backward compatibility; new rows will not populate it
ALTER TABLE execution
    DROP CONSTRAINT execution_model_id_fkey,
    ALTER COLUMN model_id DROP NOT NULL;

-- Drop old FK constraint and make model_id nullable on thread_model
-- Column stays for backward compatibility; new rows will not populate it
ALTER TABLE thread_model
    DROP CONSTRAINT thread_model_model_id_fkey,
    ALTER COLUMN model_id DROP NOT NULL;

COMMIT;
