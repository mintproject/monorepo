BEGIN;

-- Core hierarchy tables: Software > SoftwareVersion > ModelConfiguration > ModelConfigurationSetup

CREATE TABLE modelcatalog_software (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    keywords TEXT,
    license TEXT,
    website TEXT,
    date_created TEXT,
    date_published TEXT,
    has_documentation TEXT,
    has_download_url TEXT,
    has_purpose TEXT
);

CREATE TABLE modelcatalog_software_version (
    id TEXT PRIMARY KEY,
    -- FK is nullable because some SoftwareVersion entities may not have an identifiable parent sdm#Model in the RDF data
    software_id TEXT REFERENCES modelcatalog_software(id) ON DELETE CASCADE,
    version_id TEXT,
    label TEXT NOT NULL,
    description TEXT,
    keywords TEXT,
    has_usage_notes TEXT,
    date_created TEXT,
    has_source_code TEXT
);

CREATE TABLE modelcatalog_model_configuration (
    id TEXT PRIMARY KEY,
    -- FK is nullable because some ModelConfiguration entities may not have an identifiable parent SoftwareVersion
    software_version_id TEXT REFERENCES modelcatalog_software_version(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    keywords TEXT,
    usage_notes TEXT,
    has_component_location TEXT,
    has_implementation_script_location TEXT,
    has_software_image TEXT
);

CREATE TABLE modelcatalog_model_configuration_setup (
    id TEXT PRIMARY KEY,
    -- FK is nullable because some ModelConfigurationSetup entities may not have an identifiable parent ModelConfiguration
    model_configuration_id TEXT REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    has_component_location TEXT,
    has_implementation_script_location TEXT,
    has_software_image TEXT,
    has_region TEXT
);

-- I/O and parameter entity tables

CREATE TABLE modelcatalog_dataset_specification (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    has_format TEXT,
    has_dimensionality INTEGER,
    position INTEGER
);

CREATE TABLE modelcatalog_parameter (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    has_data_type TEXT,
    has_default_value TEXT,
    has_minimum_accepted_value TEXT,
    has_maximum_accepted_value TEXT,
    has_fixed_value TEXT,
    position INTEGER,
    parameter_type TEXT -- to distinguish standard Parameter vs Adjustment
);

-- Junction tables for many-to-many relationships (ModelConfiguration level)

CREATE TABLE modelcatalog_configuration_input (
    configuration_id TEXT REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    input_id TEXT REFERENCES modelcatalog_dataset_specification(id) ON DELETE CASCADE,
    PRIMARY KEY (configuration_id, input_id)
);

CREATE TABLE modelcatalog_configuration_output (
    configuration_id TEXT REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    output_id TEXT REFERENCES modelcatalog_dataset_specification(id) ON DELETE CASCADE,
    PRIMARY KEY (configuration_id, output_id)
);

CREATE TABLE modelcatalog_configuration_parameter (
    configuration_id TEXT REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    parameter_id TEXT REFERENCES modelcatalog_parameter(id) ON DELETE CASCADE,
    PRIMARY KEY (configuration_id, parameter_id)
);

-- Junction tables for many-to-many relationships (ModelConfigurationSetup level)

CREATE TABLE modelcatalog_setup_input (
    setup_id TEXT REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE,
    input_id TEXT REFERENCES modelcatalog_dataset_specification(id) ON DELETE CASCADE,
    PRIMARY KEY (setup_id, input_id)
);

CREATE TABLE modelcatalog_setup_output (
    setup_id TEXT REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE,
    output_id TEXT REFERENCES modelcatalog_dataset_specification(id) ON DELETE CASCADE,
    PRIMARY KEY (setup_id, output_id)
);

CREATE TABLE modelcatalog_setup_parameter (
    setup_id TEXT REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE,
    parameter_id TEXT REFERENCES modelcatalog_parameter(id) ON DELETE CASCADE,
    PRIMARY KEY (setup_id, parameter_id)
);

-- Indexes on all foreign key columns for query performance
-- PostgreSQL does NOT auto-index foreign keys, so these are essential

-- Hierarchy FK indexes
CREATE INDEX idx_mc_sv_software ON modelcatalog_software_version(software_id);
CREATE INDEX idx_mc_cfg_version ON modelcatalog_model_configuration(software_version_id);
CREATE INDEX idx_mc_setup_config ON modelcatalog_model_configuration_setup(model_configuration_id);

-- Configuration junction table indexes
CREATE INDEX idx_mc_cfg_input_cfg ON modelcatalog_configuration_input(configuration_id);
CREATE INDEX idx_mc_cfg_input_input ON modelcatalog_configuration_input(input_id);
CREATE INDEX idx_mc_cfg_output_cfg ON modelcatalog_configuration_output(configuration_id);
CREATE INDEX idx_mc_cfg_output_output ON modelcatalog_configuration_output(output_id);
CREATE INDEX idx_mc_cfg_param_cfg ON modelcatalog_configuration_parameter(configuration_id);
CREATE INDEX idx_mc_cfg_param_param ON modelcatalog_configuration_parameter(parameter_id);

-- Setup junction table indexes
CREATE INDEX idx_mc_setup_input_setup ON modelcatalog_setup_input(setup_id);
CREATE INDEX idx_mc_setup_input_input ON modelcatalog_setup_input(input_id);
CREATE INDEX idx_mc_setup_output_setup ON modelcatalog_setup_output(setup_id);
CREATE INDEX idx_mc_setup_output_output ON modelcatalog_setup_output(output_id);
CREATE INDEX idx_mc_setup_param_setup ON modelcatalog_setup_parameter(setup_id);
CREATE INDEX idx_mc_setup_param_param ON modelcatalog_setup_parameter(parameter_id);

COMMIT;
