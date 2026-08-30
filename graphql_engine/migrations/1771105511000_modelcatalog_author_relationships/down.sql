-- Drop junction tables
DROP TABLE IF EXISTS modelcatalog_configuration_author;
DROP TABLE IF EXISTS modelcatalog_version_author;
DROP TABLE IF EXISTS modelcatalog_software_author;

-- Drop indexes on author_id columns
DROP INDEX IF EXISTS idx_mc_config_author;
DROP INDEX IF EXISTS idx_mc_version_author;
DROP INDEX IF EXISTS idx_mc_software_author;

-- Drop author_id columns
ALTER TABLE modelcatalog_model_configuration DROP COLUMN IF EXISTS author_id;
ALTER TABLE modelcatalog_software_version DROP COLUMN IF EXISTS author_id;
ALTER TABLE modelcatalog_software DROP COLUMN IF EXISTS author_id;
