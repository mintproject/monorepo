BEGIN;
ALTER TABLE modelcatalog_parameter
    DROP COLUMN IF EXISTS has_accepted_values;
COMMIT;
