-- Junction table: DatasetSpecification <-> VariablePresentation (hasPresentation)
CREATE TABLE modelcatalog_dataset_specification_presentation (
    dataset_specification_id TEXT REFERENCES modelcatalog_dataset_specification(id) ON DELETE CASCADE,
    presentation_id TEXT REFERENCES modelcatalog_variable_presentation(id) ON DELETE CASCADE,
    PRIMARY KEY (dataset_specification_id, presentation_id)
);
