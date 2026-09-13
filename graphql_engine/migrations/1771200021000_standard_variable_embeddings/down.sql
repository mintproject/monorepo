DROP FUNCTION IF EXISTS search_standard_variables(vector(384), TEXT, INTEGER);
DROP INDEX IF EXISTS modelcatalog_standard_variable_embedding_hnsw;
ALTER TABLE modelcatalog_standard_variable DROP COLUMN IF EXISTS embedding;
ALTER TABLE modelcatalog_standard_variable DROP COLUMN IF EXISTS semantic_text;
