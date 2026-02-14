BEGIN;

-- Drop tables in reverse dependency order
-- Junction tables first (depend on entity tables)
DROP TABLE IF EXISTS modelcatalog_setup_parameter;
DROP TABLE IF EXISTS modelcatalog_setup_output;
DROP TABLE IF EXISTS modelcatalog_setup_input;
DROP TABLE IF EXISTS modelcatalog_configuration_parameter;
DROP TABLE IF EXISTS modelcatalog_configuration_output;
DROP TABLE IF EXISTS modelcatalog_configuration_input;

-- Hierarchy tables in reverse order (child to parent)
DROP TABLE IF EXISTS modelcatalog_model_configuration_setup;
DROP TABLE IF EXISTS modelcatalog_model_configuration;
DROP TABLE IF EXISTS modelcatalog_software_version;
DROP TABLE IF EXISTS modelcatalog_software;

-- I/O and parameter tables (no dependencies on them after junction tables are dropped)
DROP TABLE IF EXISTS modelcatalog_parameter;
DROP TABLE IF EXISTS modelcatalog_dataset_specification;

COMMIT;
