DROP INDEX IF EXISTS modelcatalog_configuration_embedding_hnsw;
ALTER TABLE modelcatalog_configuration
  DROP COLUMN IF EXISTS embedding,
  DROP COLUMN IF EXISTS semantic_text;
