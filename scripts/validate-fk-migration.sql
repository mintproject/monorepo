-- FK Migration Post-Deployment Validation Script
-- Run this AFTER applying both Hasura migrations to validate results.
-- Pre-migration preview is in scripts/classify-fk-preview.sql (run that first).
-- Connect to production DB: kubectl exec -it mint-hasura-db-0 -n mint -- psql -U postgres

-- =============================================================================
-- SECTION 1: execution classification results
-- Expected: matched_config + matched_setup = total (or close to it).
-- Orphaned rows keep null FK -- they did not match any modelcatalog_* entry.
-- =============================================================================
SELECT
    COUNT(*) FILTER (WHERE modelcatalog_configuration_id IS NOT NULL) AS matched_config,
    COUNT(*) FILTER (WHERE modelcatalog_setup_id IS NOT NULL) AS matched_setup,
    COUNT(*) FILTER (WHERE modelcatalog_configuration_id IS NULL AND modelcatalog_setup_id IS NULL) AS orphaned,
    COUNT(*) AS total
FROM execution;

-- =============================================================================
-- SECTION 2: thread_model classification results
-- Expected: matched_config + matched_setup = total (or close to it).
-- Orphaned rows keep null FK -- they did not match any modelcatalog_* entry.
-- =============================================================================
SELECT
    COUNT(*) FILTER (WHERE modelcatalog_configuration_id IS NOT NULL) AS matched_config,
    COUNT(*) FILTER (WHERE modelcatalog_setup_id IS NOT NULL) AS matched_setup,
    COUNT(*) FILTER (WHERE modelcatalog_configuration_id IS NULL AND modelcatalog_setup_id IS NULL) AS orphaned,
    COUNT(*) AS total
FROM thread_model;

-- =============================================================================
-- SECTION 3: model_io -> modelcatalog_dataset_specification backfill results
-- Expected: matched = total (all model_io rows should match a dataset spec).
-- Unmatched rows will have null modelcatalog_dataset_specification_id.
-- =============================================================================
SELECT
    COUNT(*) FILTER (WHERE modelcatalog_dataset_specification_id IS NOT NULL) AS matched,
    COUNT(*) FILTER (WHERE modelcatalog_dataset_specification_id IS NULL) AS unmatched,
    COUNT(*) AS total
FROM model_io;

-- =============================================================================
-- SECTION 4: New FK constraints exist
-- Expected: 2 rows -- one for execution_parameter_binding, one for thread_model_parameter.
-- If 0 rows: migration 2 did not apply successfully.
-- =============================================================================
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conname IN (
    'execution_parameter_binding_modelcatalog_parameter_fkey',
    'thread_model_parameter_modelcatalog_parameter_fkey'
);
-- Expected: 2 rows

-- =============================================================================
-- SECTION 5: Old FK constraints are gone
-- Expected: empty result set (all four dropped by migration 1 and migration 2).
-- If any rows appear: migration did not apply cleanly.
-- =============================================================================
SELECT conname FROM pg_constraint
WHERE conname IN (
    'execution_model_id_fkey',
    'thread_model_model_id_fkey',
    'execution_parameter_binding_model_parameter_id_fkey',
    'thread_model_parameter_parameter_id_fkey'
);
-- Expected: empty result set (all four dropped)

-- =============================================================================
-- SECTION 6: Spot-check execution rows with their modelcatalog references
-- Review a sample of rows to confirm backfill quality.
-- Rows with null config_label and null setup_label are orphaned (no modelcatalog match).
-- =============================================================================
SELECT e.id, e.model_id, e.modelcatalog_configuration_id, e.modelcatalog_setup_id,
       mc.label AS config_label, ms.label AS setup_label
FROM execution e
LEFT JOIN modelcatalog_model_configuration mc ON mc.id = e.modelcatalog_configuration_id
LEFT JOIN modelcatalog_model_configuration_setup ms ON ms.id = e.modelcatalog_setup_id
LIMIT 10;
