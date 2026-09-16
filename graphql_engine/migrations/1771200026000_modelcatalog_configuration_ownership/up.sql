BEGIN;

ALTER TABLE modelcatalog_configuration
  ADD COLUMN owner_username TEXT;

CREATE INDEX idx_mc_configuration_owner
  ON modelcatalog_configuration(owner_username);

-- Do not allow deleting a parent configuration while setups still reference it.
-- The previous CASCADE would remove all child configurations, including any
-- rows that may have been registered by another user.
ALTER TABLE modelcatalog_configuration
  DROP CONSTRAINT modelcatalog_configuration_model_configuration_id_fkey;

ALTER TABLE modelcatalog_configuration
  ADD CONSTRAINT modelcatalog_configuration_model_configuration_id_fkey
  FOREIGN KEY (model_configuration_id)
  REFERENCES modelcatalog_configuration(id)
  ON DELETE RESTRICT;

COMMIT;
