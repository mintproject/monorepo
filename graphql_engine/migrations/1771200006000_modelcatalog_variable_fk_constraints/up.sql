-- FK constraints from variable_presentation to StandardVariable and Unit tables (D-08)
--
-- Uses NOT VALID so the migration succeeds even when StandardVariable/Unit tables
-- are empty (before ETL runs). After ETL populates the tables, run:
--   ALTER TABLE modelcatalog_variable_presentation VALIDATE CONSTRAINT fk_vp_standard_variable;
--   ALTER TABLE modelcatalog_variable_presentation VALIDATE CONSTRAINT fk_vp_unit;
--
-- D-03 resolution: No modelcatalog_variable table is created. Research confirmed
-- 0 plain sd:Variable instances in the TriG data. The `variables` resource entry
-- in resource-registry.ts keeps hasuraTable: null.

-- FK: variable_presentation.has_standard_variable -> standard_variable.id (D-08)
-- NOT VALID skips checking existing rows; new inserts/updates are still enforced
ALTER TABLE modelcatalog_variable_presentation
    ADD CONSTRAINT fk_vp_standard_variable
        FOREIGN KEY (has_standard_variable)
        REFERENCES modelcatalog_standard_variable(id)
        ON DELETE SET NULL
        NOT VALID;

-- FK: variable_presentation.uses_unit -> unit.id (D-08)
ALTER TABLE modelcatalog_variable_presentation
    ADD CONSTRAINT fk_vp_unit
        FOREIGN KEY (uses_unit)
        REFERENCES modelcatalog_unit(id)
        ON DELETE SET NULL
        NOT VALID;
