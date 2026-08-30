-- StandardVariable entity table (D-01, D-09)
-- 303 instances in TriG; columns: id (URI PK), label, description
CREATE TABLE modelcatalog_standard_variable (
    id          TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    description TEXT
);
CREATE INDEX idx_mc_standard_variable_id ON modelcatalog_standard_variable(id);

-- Unit entity table (D-02, D-09)
-- 107 instances in TriG (typed as qudt:Unit); columns: id (URI PK), label
CREATE TABLE modelcatalog_unit (
    id    TEXT PRIMARY KEY,
    label TEXT NOT NULL
);
CREATE INDEX idx_mc_unit_id ON modelcatalog_unit(id);

-- Indexes on VP FK columns for query performance
CREATE INDEX idx_mc_vp_has_standard_variable ON modelcatalog_variable_presentation(has_standard_variable);
CREATE INDEX idx_mc_vp_uses_unit ON modelcatalog_variable_presentation(uses_unit);
