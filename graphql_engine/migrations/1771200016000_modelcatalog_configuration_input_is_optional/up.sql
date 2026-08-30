BEGIN;
ALTER TABLE modelcatalog_configuration_input
    ADD COLUMN is_optional BOOLEAN NOT NULL DEFAULT FALSE;
COMMIT;
