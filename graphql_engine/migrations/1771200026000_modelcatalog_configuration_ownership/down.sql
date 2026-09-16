BEGIN;

ALTER TABLE modelcatalog_configuration
  DROP CONSTRAINT modelcatalog_configuration_model_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration
  ADD CONSTRAINT modelcatalog_configuration_model_configuration_id_fkey
  FOREIGN KEY (model_configuration_id)
  REFERENCES modelcatalog_configuration(id)
  ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_mc_configuration_owner;

ALTER TABLE modelcatalog_configuration
  DROP COLUMN owner_username;

COMMIT;
