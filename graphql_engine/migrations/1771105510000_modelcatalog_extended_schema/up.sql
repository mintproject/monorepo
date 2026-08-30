BEGIN;

-- ============================================================================
-- SECTION 1: New entity tables (10 tables)
-- ============================================================================

-- 1. Person (sd:Person) - authors of model configurations
CREATE TABLE modelcatalog_person (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    name TEXT
);

-- 2. ModelCategory (sdm:ModelCategory) - hierarchical categories
CREATE TABLE modelcatalog_model_category (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    parent_category_id TEXT REFERENCES modelcatalog_model_category(id) ON DELETE SET NULL
);

-- 3. Region (sdm:Region) - hierarchical regions
CREATE TABLE modelcatalog_region (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    part_of_id TEXT REFERENCES modelcatalog_region(id) ON DELETE SET NULL
);

-- 4. Process (sdm:Process) - model processes
CREATE TABLE modelcatalog_process (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL
);

-- 5. TimeInterval (sdm:TimeInterval) - time intervals for outputs
CREATE TABLE modelcatalog_time_interval (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    interval_value TEXT,
    interval_unit TEXT
);

-- 6. CausalDiagram (sdm:CausalDiagram) - causal diagrams
CREATE TABLE modelcatalog_causal_diagram (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL
);

-- 7. Image (sd:Image) - images and diagrams
CREATE TABLE modelcatalog_image (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT
);

-- 8. VariablePresentation (sd:VariablePresentation) - variable metadata
CREATE TABLE modelcatalog_variable_presentation (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    has_long_name TEXT,
    has_short_name TEXT,
    has_standard_variable TEXT,
    uses_unit TEXT
);

-- 9. Intervention (sdm:Intervention) - interventions
CREATE TABLE modelcatalog_intervention (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT
);

-- 10. Grid (sdm:Grid) - grids (subclass of DatasetSpecification but distinct)
CREATE TABLE modelcatalog_grid (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    has_dimension TEXT,
    has_shape TEXT,
    has_spatial_resolution TEXT,
    has_coordinate_system TEXT,
    grid_type TEXT
);

-- ============================================================================
-- SECTION 2: ALTER TABLE - add columns to existing tables
-- ============================================================================

-- Add columns to modelcatalog_software_version (5 columns)
ALTER TABLE modelcatalog_software_version
    ADD COLUMN short_description TEXT,
    ADD COLUMN limitations TEXT,
    ADD COLUMN parameterization TEXT,
    ADD COLUMN runtime_estimation TEXT,
    ADD COLUMN theoretical_basis TEXT;

-- Add column to modelcatalog_model_configuration (1 column)
ALTER TABLE modelcatalog_model_configuration
    ADD COLUMN has_model_result_table TEXT;

-- Add columns to modelcatalog_model_configuration_setup (5 columns)
ALTER TABLE modelcatalog_model_configuration_setup
    ADD COLUMN author_id TEXT REFERENCES modelcatalog_person(id) ON DELETE SET NULL,
    ADD COLUMN calibration_interval TEXT,
    ADD COLUMN calibration_method TEXT,
    ADD COLUMN parameter_assignment_method TEXT,
    ADD COLUMN valid_until TEXT;

-- ============================================================================
-- SECTION 3: Junction tables (14 tables)
-- ============================================================================

-- Software/SoftwareVersion level junction tables (6 tables)

-- 11. SoftwareVersion <-> ModelCategory
CREATE TABLE modelcatalog_software_version_category (
    software_version_id TEXT REFERENCES modelcatalog_software_version(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES modelcatalog_model_category(id) ON DELETE CASCADE,
    PRIMARY KEY (software_version_id, category_id)
);

-- 12. SoftwareVersion <-> Process
CREATE TABLE modelcatalog_software_version_process (
    software_version_id TEXT REFERENCES modelcatalog_software_version(id) ON DELETE CASCADE,
    process_id TEXT REFERENCES modelcatalog_process(id) ON DELETE CASCADE,
    PRIMARY KEY (software_version_id, process_id)
);

-- 13. SoftwareVersion <-> Grid
CREATE TABLE modelcatalog_software_version_grid (
    software_version_id TEXT REFERENCES modelcatalog_software_version(id) ON DELETE CASCADE,
    grid_id TEXT REFERENCES modelcatalog_grid(id) ON DELETE CASCADE,
    PRIMARY KEY (software_version_id, grid_id)
);

-- 14. SoftwareVersion <-> Image (via hasExplanationDiagram)
CREATE TABLE modelcatalog_software_version_image (
    software_version_id TEXT REFERENCES modelcatalog_software_version(id) ON DELETE CASCADE,
    image_id TEXT REFERENCES modelcatalog_image(id) ON DELETE CASCADE,
    PRIMARY KEY (software_version_id, image_id)
);

-- 15. SoftwareVersion <-> VariablePresentation (input variables)
CREATE TABLE modelcatalog_software_version_input_variable (
    software_version_id TEXT REFERENCES modelcatalog_software_version(id) ON DELETE CASCADE,
    variable_id TEXT REFERENCES modelcatalog_variable_presentation(id) ON DELETE CASCADE,
    PRIMARY KEY (software_version_id, variable_id)
);

-- 16. SoftwareVersion <-> VariablePresentation (output variables)
CREATE TABLE modelcatalog_software_version_output_variable (
    software_version_id TEXT REFERENCES modelcatalog_software_version(id) ON DELETE CASCADE,
    variable_id TEXT REFERENCES modelcatalog_variable_presentation(id) ON DELETE CASCADE,
    PRIMARY KEY (software_version_id, variable_id)
);

-- Configuration level junction tables (3 tables)

-- 17. ModelConfiguration <-> CausalDiagram
CREATE TABLE modelcatalog_configuration_causal_diagram (
    configuration_id TEXT REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    causal_diagram_id TEXT REFERENCES modelcatalog_causal_diagram(id) ON DELETE CASCADE,
    PRIMARY KEY (configuration_id, causal_diagram_id)
);

-- 18. ModelConfiguration <-> TimeInterval
CREATE TABLE modelcatalog_configuration_time_interval (
    configuration_id TEXT REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    time_interval_id TEXT REFERENCES modelcatalog_time_interval(id) ON DELETE CASCADE,
    PRIMARY KEY (configuration_id, time_interval_id)
);

-- 19. ModelConfiguration <-> Region
CREATE TABLE modelcatalog_configuration_region (
    configuration_id TEXT REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    region_id TEXT REFERENCES modelcatalog_region(id) ON DELETE CASCADE,
    PRIMARY KEY (configuration_id, region_id)
);

-- Setup level junction tables (3 tables)

-- 20. ModelConfigurationSetup <-> Person (multi-valued authors)
CREATE TABLE modelcatalog_setup_author (
    setup_id TEXT REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE,
    person_id TEXT REFERENCES modelcatalog_person(id) ON DELETE CASCADE,
    PRIMARY KEY (setup_id, person_id)
);

-- 21. ModelConfigurationSetup <-> VariablePresentation (calibrated variables)
CREATE TABLE modelcatalog_setup_calibrated_variable (
    setup_id TEXT REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE,
    variable_id TEXT REFERENCES modelcatalog_variable_presentation(id) ON DELETE CASCADE,
    PRIMARY KEY (setup_id, variable_id)
);

-- 22. ModelConfigurationSetup <-> VariablePresentation (calibration target variables)
CREATE TABLE modelcatalog_setup_calibration_target (
    setup_id TEXT REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE,
    variable_id TEXT REFERENCES modelcatalog_variable_presentation(id) ON DELETE CASCADE,
    PRIMARY KEY (setup_id, variable_id)
);

-- Parameter level junction table (1 table)

-- 23. Parameter <-> Intervention
CREATE TABLE modelcatalog_parameter_intervention (
    parameter_id TEXT REFERENCES modelcatalog_parameter(id) ON DELETE CASCADE,
    intervention_id TEXT REFERENCES modelcatalog_intervention(id) ON DELETE CASCADE,
    PRIMARY KEY (parameter_id, intervention_id)
);

-- CausalDiagram parts (1 polymorphic table)

-- 24. CausalDiagram <-> VariablePresentation|Process (diagram parts)
CREATE TABLE modelcatalog_diagram_part (
    causal_diagram_id TEXT REFERENCES modelcatalog_causal_diagram(id) ON DELETE CASCADE,
    part_id TEXT NOT NULL,
    part_type TEXT NOT NULL CHECK (part_type IN ('variable', 'process')),
    PRIMARY KEY (causal_diagram_id, part_id)
);

-- ============================================================================
-- SECTION 4: Indexes on FK columns
-- ============================================================================

-- Indexes on self-referential FKs in entity tables
CREATE INDEX idx_mc_category_parent ON modelcatalog_model_category(parent_category_id);
CREATE INDEX idx_mc_region_part_of ON modelcatalog_region(part_of_id);

-- Index on author_id FK in model_configuration_setup
CREATE INDEX idx_mc_setup_author ON modelcatalog_model_configuration_setup(author_id);

-- Indexes on junction table FKs - SoftwareVersion level (12 indexes)
CREATE INDEX idx_mc_sv_cat_sv ON modelcatalog_software_version_category(software_version_id);
CREATE INDEX idx_mc_sv_cat_cat ON modelcatalog_software_version_category(category_id);
CREATE INDEX idx_mc_sv_proc_sv ON modelcatalog_software_version_process(software_version_id);
CREATE INDEX idx_mc_sv_proc_proc ON modelcatalog_software_version_process(process_id);
CREATE INDEX idx_mc_sv_grid_sv ON modelcatalog_software_version_grid(software_version_id);
CREATE INDEX idx_mc_sv_grid_grid ON modelcatalog_software_version_grid(grid_id);
CREATE INDEX idx_mc_sv_img_sv ON modelcatalog_software_version_image(software_version_id);
CREATE INDEX idx_mc_sv_img_img ON modelcatalog_software_version_image(image_id);
CREATE INDEX idx_mc_sv_invar_sv ON modelcatalog_software_version_input_variable(software_version_id);
CREATE INDEX idx_mc_sv_invar_var ON modelcatalog_software_version_input_variable(variable_id);
CREATE INDEX idx_mc_sv_outvar_sv ON modelcatalog_software_version_output_variable(software_version_id);
CREATE INDEX idx_mc_sv_outvar_var ON modelcatalog_software_version_output_variable(variable_id);

-- Indexes on junction table FKs - Configuration level (6 indexes)
CREATE INDEX idx_mc_cfg_cd_cfg ON modelcatalog_configuration_causal_diagram(configuration_id);
CREATE INDEX idx_mc_cfg_cd_cd ON modelcatalog_configuration_causal_diagram(causal_diagram_id);
CREATE INDEX idx_mc_cfg_ti_cfg ON modelcatalog_configuration_time_interval(configuration_id);
CREATE INDEX idx_mc_cfg_ti_ti ON modelcatalog_configuration_time_interval(time_interval_id);
CREATE INDEX idx_mc_cfg_reg_cfg ON modelcatalog_configuration_region(configuration_id);
CREATE INDEX idx_mc_cfg_reg_reg ON modelcatalog_configuration_region(region_id);

-- Indexes on junction table FKs - Setup level (6 indexes)
CREATE INDEX idx_mc_setup_auth_setup ON modelcatalog_setup_author(setup_id);
CREATE INDEX idx_mc_setup_auth_person ON modelcatalog_setup_author(person_id);
CREATE INDEX idx_mc_setup_calvar_setup ON modelcatalog_setup_calibrated_variable(setup_id);
CREATE INDEX idx_mc_setup_calvar_var ON modelcatalog_setup_calibrated_variable(variable_id);
CREATE INDEX idx_mc_setup_caltgt_setup ON modelcatalog_setup_calibration_target(setup_id);
CREATE INDEX idx_mc_setup_caltgt_var ON modelcatalog_setup_calibration_target(variable_id);

-- Indexes on junction table FKs - Parameter level (2 indexes)
CREATE INDEX idx_mc_param_int_param ON modelcatalog_parameter_intervention(parameter_id);
CREATE INDEX idx_mc_param_int_int ON modelcatalog_parameter_intervention(intervention_id);

-- Indexes on CausalDiagram parts (2 indexes)
CREATE INDEX idx_mc_diagram_part_cd ON modelcatalog_diagram_part(causal_diagram_id);
CREATE INDEX idx_mc_diagram_part_part ON modelcatalog_diagram_part(part_id);

COMMIT;
