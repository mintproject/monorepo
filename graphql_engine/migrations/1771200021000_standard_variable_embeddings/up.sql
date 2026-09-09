CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE modelcatalog_standard_variable
  ADD COLUMN IF NOT EXISTS semantic_text TEXT,
  ADD COLUMN IF NOT EXISTS embedding vector(384);

CREATE INDEX IF NOT EXISTS modelcatalog_standard_variable_embedding_hnsw
  ON modelcatalog_standard_variable USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION search_standard_variables(
  query_embedding vector(384),
  query_text TEXT,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (id TEXT, label TEXT, description TEXT, score DOUBLE PRECISION)
LANGUAGE sql STABLE AS $$
  SELECT sv.id, sv.label, sv.description,
    (0.7 * (1 - (sv.embedding <=> query_embedding)) +
     0.3 * ts_rank(to_tsvector('english', coalesce(sv.semantic_text, '')),
                   plainto_tsquery('english', query_text))) AS score
  FROM modelcatalog_standard_variable sv
  WHERE sv.embedding IS NOT NULL
  ORDER BY score DESC
  LIMIT result_limit;
$$;
