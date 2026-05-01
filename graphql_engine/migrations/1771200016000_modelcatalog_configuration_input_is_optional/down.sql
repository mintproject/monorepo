BEGIN;
ALTER TABLE modelcatalog_configuration_input
    DROP COLUMN is_optional;
COMMIT;
