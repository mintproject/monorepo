BEGIN;

-- ============================================================================
-- Add sd:author support to Software, SoftwareVersion, and ModelConfiguration
-- ============================================================================
-- sd:author is multi-valued across all 4 hierarchy levels. ModelConfigurationSetup
-- already has author_id + setup_author junction. This migration adds the same
-- pattern to the remaining 3 levels.

-- SECTION 1: Add author_id FK columns to 3 entity tables
-- ============================================================================

ALTER TABLE modelcatalog_software
    ADD COLUMN author_id TEXT REFERENCES modelcatalog_person(id) ON DELETE SET NULL;

ALTER TABLE modelcatalog_software_version
    ADD COLUMN author_id TEXT REFERENCES modelcatalog_person(id) ON DELETE SET NULL;

ALTER TABLE modelcatalog_model_configuration
    ADD COLUMN author_id TEXT REFERENCES modelcatalog_person(id) ON DELETE SET NULL;

-- SECTION 2: Junction tables for multi-valued authors
-- ============================================================================

CREATE TABLE modelcatalog_software_author (
    software_id TEXT REFERENCES modelcatalog_software(id) ON DELETE CASCADE,
    person_id TEXT REFERENCES modelcatalog_person(id) ON DELETE CASCADE,
    PRIMARY KEY (software_id, person_id)
);

CREATE TABLE modelcatalog_version_author (
    software_version_id TEXT REFERENCES modelcatalog_software_version(id) ON DELETE CASCADE,
    person_id TEXT REFERENCES modelcatalog_person(id) ON DELETE CASCADE,
    PRIMARY KEY (software_version_id, person_id)
);

CREATE TABLE modelcatalog_configuration_author (
    configuration_id TEXT REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    person_id TEXT REFERENCES modelcatalog_person(id) ON DELETE CASCADE,
    PRIMARY KEY (configuration_id, person_id)
);

-- SECTION 3: Indexes
-- ============================================================================

CREATE INDEX idx_mc_software_author ON modelcatalog_software(author_id);
CREATE INDEX idx_mc_version_author ON modelcatalog_software_version(author_id);
CREATE INDEX idx_mc_config_author ON modelcatalog_model_configuration(author_id);

CREATE INDEX idx_mc_sw_auth_sw ON modelcatalog_software_author(software_id);
CREATE INDEX idx_mc_sw_auth_person ON modelcatalog_software_author(person_id);
CREATE INDEX idx_mc_ver_auth_ver ON modelcatalog_version_author(software_version_id);
CREATE INDEX idx_mc_ver_auth_person ON modelcatalog_version_author(person_id);
CREATE INDEX idx_mc_cfg_auth_cfg ON modelcatalog_configuration_author(configuration_id);
CREATE INDEX idx_mc_cfg_auth_person ON modelcatalog_configuration_author(person_id);

COMMIT;
