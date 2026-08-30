-- Rollback: remove FK constraints from variable_presentation

ALTER TABLE modelcatalog_variable_presentation
    DROP CONSTRAINT IF EXISTS fk_vp_unit;

ALTER TABLE modelcatalog_variable_presentation
    DROP CONSTRAINT IF EXISTS fk_vp_standard_variable;
