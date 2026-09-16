CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE modelcatalog_configuration
  ADD COLUMN IF NOT EXISTS semantic_text TEXT,
  ADD COLUMN IF NOT EXISTS embedding vector(384);

CREATE INDEX IF NOT EXISTS modelcatalog_configuration_embedding_hnsw
  ON modelcatalog_configuration USING hnsw (embedding vector_cosine_ops);
