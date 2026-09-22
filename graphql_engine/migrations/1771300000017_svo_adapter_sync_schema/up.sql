BEGIN;

-- Keep the MINT configuration contract aligned with the SVO adapter sync.
-- These are nullable because existing configurations may not yet have a
-- registered Tapis app.
ALTER TABLE public.modelcatalog_configuration
  ADD COLUMN IF NOT EXISTS tapis_app_id TEXT,
  ADD COLUMN IF NOT EXISTS tapis_app_version TEXT;

-- Store the dimension-level compatibility result alongside each derived edge.
-- The edge table is a rebuildable cache, so adding this column is non-breaking
-- for existing rows.
ALTER TABLE adapter.transform_edge
  ADD COLUMN IF NOT EXISTS compatibility_json JSONB;

COMMIT;
