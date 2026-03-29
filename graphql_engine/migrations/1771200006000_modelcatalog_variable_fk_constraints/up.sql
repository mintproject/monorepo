-- FK constraints from variable_presentation to StandardVariable and Unit tables (D-08)
--
-- IMPORTANT: This migration must only be applied AFTER the ETL (Plan 02) has
-- populated modelcatalog_standard_variable and modelcatalog_unit. Otherwise,
-- existing VP rows will violate the new FK constraints:
--   - 349 of 605 VP rows have non-null has_standard_variable values
--   - 476 of 605 VP rows have non-null uses_unit values
--
-- D-03 resolution: No modelcatalog_variable table is created. Research confirmed
-- 0 plain sd:Variable instances in the TriG data. The `variables` resource entry
-- in resource-registry.ts keeps hasuraTable: null.

-- FK: variable_presentation.has_standard_variable -> standard_variable.id (D-08)
-- 349 of 605 VP rows have non-null has_standard_variable values
-- DEFERRABLE INITIALLY DEFERRED allows batch loading within transactions
ALTER TABLE modelcatalog_variable_presentation
    ADD CONSTRAINT fk_vp_standard_variable
        FOREIGN KEY (has_standard_variable)
        REFERENCES modelcatalog_standard_variable(id)
        ON DELETE SET NULL
        DEFERRABLE INITIALLY DEFERRED;

-- FK: variable_presentation.uses_unit -> unit.id (D-08)
-- 476 of 605 VP rows have non-null uses_unit values
ALTER TABLE modelcatalog_variable_presentation
    ADD CONSTRAINT fk_vp_unit
        FOREIGN KEY (uses_unit)
        REFERENCES modelcatalog_unit(id)
        ON DELETE SET NULL
        DEFERRABLE INITIALLY DEFERRED;
