-- FK Migration Classification Preview
-- Run this BEFORE applying any migration to review what will happen.
-- This script is READ-ONLY -- it makes no changes to the database.
-- Connect to production DB: kubectl exec -it mint-hasura-db-0 -n mint -- psql -U postgres

-- =============================================================================
-- SECTION 1: Classification summary
-- Shows how many model rows match ModelConfiguration, ModelConfigurationSetup,
-- or are orphans (no match in modelcatalog_* tables).
-- =============================================================================
SELECT
    CASE
        WHEN mc.id IS NOT NULL THEN 'ModelConfiguration'
        WHEN ms.id IS NOT NULL THEN 'ModelConfigurationSetup'
        ELSE 'ORPHAN'
    END AS classification,
    COUNT(*) AS row_count
FROM model m
LEFT JOIN modelcatalog_model_configuration mc ON mc.id = m.id
LEFT JOIN modelcatalog_model_configuration_setup ms ON ms.id = m.id
GROUP BY 1
ORDER BY 1;

-- =============================================================================
-- SECTION 2: Detailed classification - every model row and its match
-- Orphaned rows (no match in modelcatalog_* tables) keep null FK per user decision.
-- Review report shows each old model row -> matched modelcatalog row -> classification type.
-- =============================================================================
SELECT
    m.id AS model_id,
    m.name AS model_name,
    mc.id AS config_match,
    mc.label AS config_label,
    ms.id AS setup_match,
    ms.label AS setup_label,
    CASE
        WHEN mc.id IS NOT NULL THEN 'ModelConfiguration'
        WHEN ms.id IS NOT NULL THEN 'ModelConfigurationSetup'
        ELSE 'ORPHAN'
    END AS classification
FROM model m
LEFT JOIN modelcatalog_model_configuration mc ON mc.id = m.id
LEFT JOIN modelcatalog_model_configuration_setup ms ON ms.id = m.id
ORDER BY classification, m.id;

-- =============================================================================
-- SECTION 3: Execution table impact preview
-- Shows how many execution rows will get each classification after backfill.
-- =============================================================================

-- Execution table breakdown
SELECT
    CASE
        WHEN mc.id IS NOT NULL THEN 'ModelConfiguration'
        WHEN ms.id IS NOT NULL THEN 'ModelConfigurationSetup'
        ELSE 'ORPHAN (null FK)'
    END AS classification,
    COUNT(*) AS execution_count
FROM execution e
JOIN model m ON m.id = e.model_id
LEFT JOIN modelcatalog_model_configuration mc ON mc.id = m.id
LEFT JOIN modelcatalog_model_configuration_setup ms ON ms.id = m.id
GROUP BY 1
ORDER BY 1;

-- Thread model table breakdown
SELECT
    CASE
        WHEN mc.id IS NOT NULL THEN 'ModelConfiguration'
        WHEN ms.id IS NOT NULL THEN 'ModelConfigurationSetup'
        ELSE 'ORPHAN (null FK)'
    END AS classification,
    COUNT(*) AS thread_model_count
FROM thread_model tm
JOIN model m ON m.id = tm.model_id
LEFT JOIN modelcatalog_model_configuration mc ON mc.id = m.id
LEFT JOIN modelcatalog_model_configuration_setup ms ON ms.id = m.id
GROUP BY 1
ORDER BY 1;

-- =============================================================================
-- SECTION 4: Parameter binding orphans (will be DELETED by migration 2)
-- These rows reference model_parameter_id values that do not exist in
-- modelcatalog_parameter. Because model_parameter_id is part of the primary
-- key in both tables, orphaned rows cannot be nulled -- they will be deleted.
-- Review these counts carefully before approving the parameter migration.
-- =============================================================================

SELECT COUNT(*) AS orphaned_execution_param_bindings
FROM execution_parameter_binding epb
WHERE NOT EXISTS (
    SELECT 1 FROM modelcatalog_parameter mp WHERE mp.id = epb.model_parameter_id
);

SELECT COUNT(*) AS orphaned_thread_model_params
FROM thread_model_parameter tmp
WHERE NOT EXISTS (
    SELECT 1 FROM modelcatalog_parameter mp WHERE mp.id = tmp.model_parameter_id
);
