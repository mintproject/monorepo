BEGIN;
ALTER TABLE modelcatalog_parameter
    ADD COLUMN has_accepted_values TEXT[];
COMMIT;
