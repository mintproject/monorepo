-- Software <-> ModelCategory junction table
CREATE TABLE modelcatalog_software_category (
    software_id TEXT REFERENCES modelcatalog_software(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES modelcatalog_model_category(id) ON DELETE CASCADE,
    PRIMARY KEY (software_id, category_id)
);

CREATE INDEX idx_mc_sw_cat_sw ON modelcatalog_software_category(software_id);
CREATE INDEX idx_mc_sw_cat_cat ON modelcatalog_software_category(category_id);
