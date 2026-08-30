-- Junction table: Parameter <-> VariablePresentation (adjustsVariable)
CREATE TABLE modelcatalog_parameter_adjusts_variable (
    parameter_id TEXT REFERENCES modelcatalog_parameter(id) ON DELETE CASCADE,
    variable_id TEXT REFERENCES modelcatalog_variable_presentation(id) ON DELETE CASCADE,
    PRIMARY KEY (parameter_id, variable_id)
);
