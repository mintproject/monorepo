CREATE TABLE modelcatalog_modelconfiguration_category (
    model_configuration_id TEXT NOT NULL REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES modelcatalog_model_category(id) ON DELETE CASCADE,
    PRIMARY KEY (model_configuration_id, category_id)
);
CREATE INDEX idx_modelcatalog_modelconfiguration_category_mc_id ON modelcatalog_modelconfiguration_category(model_configuration_id);
CREATE INDEX idx_modelcatalog_modelconfiguration_category_cat_id ON modelcatalog_modelconfiguration_category(category_id);

CREATE TABLE modelcatalog_modelconfigurationsetup_category (
    model_configuration_setup_id TEXT NOT NULL REFERENCES modelcatalog_model_configuration_setup(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES modelcatalog_model_category(id) ON DELETE CASCADE,
    PRIMARY KEY (model_configuration_setup_id, category_id)
);
CREATE INDEX idx_modelcatalog_modelconfigurationsetup_category_mcs_id ON modelcatalog_modelconfigurationsetup_category(model_configuration_setup_id);
CREATE INDEX idx_modelcatalog_modelconfigurationsetup_category_cat_id ON modelcatalog_modelconfigurationsetup_category(category_id);
