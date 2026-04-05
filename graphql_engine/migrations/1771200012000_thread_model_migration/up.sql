BEGIN;

-- ============================================================================
-- Migration: Backfill thread_model.modelcatalog_configuration_id and
-- execution.modelcatalog_configuration_id, consolidate modelcatalog_setup_id
-- into modelcatalog_configuration_id, add proper FK constraints to the unified
-- table, drop the modelcatalog_setup_id columns, and drop the old public.model
-- table and its dependents.
-- ============================================================================

-- ============================================================================
-- SECTION 1: Drop stale FK constraints on thread_model and execution
-- The FK constraints added by migration 1771200000000 referenced the old tables
-- (modelcatalog_model_configuration and modelcatalog_model_configuration_setup)
-- which no longer exist after migration 1771200011000. If those FKs were not
-- automatically dropped via CASCADE, drop them explicitly here.
-- ============================================================================

-- Drop FK constraints that reference dropped tables (if they still exist)
ALTER TABLE thread_model
    DROP CONSTRAINT IF EXISTS thread_model_modelcatalog_configuration_id_fkey;

ALTER TABLE thread_model
    DROP CONSTRAINT IF EXISTS thread_model_modelcatalog_setup_id_fkey;

ALTER TABLE execution
    DROP CONSTRAINT IF EXISTS execution_modelcatalog_configuration_id_fkey;

ALTER TABLE execution
    DROP CONSTRAINT IF EXISTS execution_modelcatalog_setup_id_fkey;

-- ============================================================================
-- SECTION 2: Backfill thread_model.modelcatalog_configuration_id from public.model
-- public.model.model_configuration column contains the modelcatalog URI that
-- maps to modelcatalog_configuration.id (previously modelcatalog_model_configuration.id)
-- ============================================================================

UPDATE thread_model tm
SET modelcatalog_configuration_id = m.model_configuration
FROM public.model m
WHERE m.id = tm.model_id
  AND tm.modelcatalog_configuration_id IS NULL
  AND tm.model_id IS NOT NULL;

-- ============================================================================
-- SECTION 3: Backfill execution.modelcatalog_configuration_id from public.model
-- ============================================================================

UPDATE execution e
SET modelcatalog_configuration_id = m.model_configuration
FROM public.model m
WHERE m.id = e.model_id
  AND e.modelcatalog_configuration_id IS NULL
  AND e.model_id IS NOT NULL;

-- ============================================================================
-- SECTION 4: Merge modelcatalog_setup_id into modelcatalog_configuration_id
-- Both config and setup rows now live in modelcatalog_configuration, so any
-- row that was linked via modelcatalog_setup_id should move to
-- modelcatalog_configuration_id.
-- ============================================================================

UPDATE thread_model
SET modelcatalog_configuration_id = modelcatalog_setup_id
WHERE modelcatalog_configuration_id IS NULL
  AND modelcatalog_setup_id IS NOT NULL;

UPDATE execution
SET modelcatalog_configuration_id = modelcatalog_setup_id
WHERE modelcatalog_configuration_id IS NULL
  AND modelcatalog_setup_id IS NOT NULL;

-- ============================================================================
-- SECTION 5: Add FK constraints to modelcatalog_configuration (unified table)
-- ============================================================================

ALTER TABLE thread_model
    ADD CONSTRAINT thread_model_mc_config_fk
        FOREIGN KEY (modelcatalog_configuration_id)
        REFERENCES modelcatalog_configuration(id) ON DELETE SET NULL;

ALTER TABLE execution
    ADD CONSTRAINT execution_mc_config_fk
        FOREIGN KEY (modelcatalog_configuration_id)
        REFERENCES modelcatalog_configuration(id) ON DELETE SET NULL;

-- ============================================================================
-- SECTION 6: Drop modelcatalog_setup_id columns (no longer needed)
-- ============================================================================

ALTER TABLE thread_model DROP COLUMN IF EXISTS modelcatalog_setup_id;
ALTER TABLE execution DROP COLUMN IF EXISTS modelcatalog_setup_id;

-- Drop the now-orphaned indexes on setup_id (if they exist)
DROP INDEX IF EXISTS idx_thread_model_mc_setup;
DROP INDEX IF EXISTS idx_execution_mc_setup;

-- ============================================================================
-- SECTION 7: Drop public.model and its dependents
-- Dependent tables: model_input, model_output, model_parameter
-- model_io should NOT be dropped — thread_model_io still references it.
-- ============================================================================

DROP TABLE IF EXISTS model_input;
DROP TABLE IF EXISTS model_output;
DROP TABLE IF EXISTS model_parameter;
DROP TABLE public.model;

COMMIT;
